const getSupabaseClient = require('../db/dbClient');
const BusinessHoursService = require('../business-hours');

/**
 * SequenceService centralizes sequence-entry state transitions after a call
 * and schedules next attempts respecting business hours.
 */
class SequenceService {
  constructor() {
    this.client = getSupabaseClient();
    this.businessHoursService = new BusinessHoursService();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;
    await this.businessHoursService.initialize();
    this.initialized = true;
    return true;
  }

  /**
   * Update sequence entry after a call attempt
   * - Computes status transitions (completed, max_attempts_reached, active)
   * - Calculates next_call_time honoring business hours and retry delay
   * @param {string} entryId
   * @param {Object} callResult - { successful: boolean }
   * @returns {Promise<Object>} updated sequence entry
   */
  async updateAfterCall(entryId, callResult) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Fetch entry with parent sequence config
    const { data: entry, error: entryError } = await this.client
      .from('sequence_entries')
      .select(`
        *,
        sequences (
          id,
          name,
          max_attempts,
          retry_delay_hours,
          timezone,
          business_hours_start,
          business_hours_end,
          exclude_weekends
        )
      `)
      .eq('id', entryId)
      .single();

    if (entryError) throw new Error(entryError.message || 'Failed to load sequence entry');

    const sequence = entry.sequences || {};
    const currentAttempt = (entry.current_attempt || 0) + 1;
    const maxAttempts = sequence.max_attempts;
    const retryDelayHours = sequence.retry_delay_hours;

    let newStatus = 'active';
    let nextCallTime = null;

    // Determine next status and call time
    if (callResult && callResult.successful) {
      newStatus = 'completed';
    } else if (typeof maxAttempts === 'number' && currentAttempt >= maxAttempts) {
      newStatus = 'max_attempts_reached';
    } else {
      const businessHours = {
        timezone: sequence.timezone || 'UTC',
        business_hours_start: sequence.business_hours_start || '09:00:00',
        business_hours_end: sequence.business_hours_end || '17:00:00',
        exclude_weekends: sequence.exclude_weekends !== false,
      };

      try {
        const now = new Date();
        const nextCall = this.businessHoursService.addHoursRespectingBusinessHours(
          now,
          retryDelayHours,
          businessHours
        );
        nextCallTime = nextCall ? nextCall.toISOString() : null;
      } catch (error) {
        // Fallback: simple hours add
        const nextCall = new Date();
        nextCall.setHours(nextCall.getHours() + (retryDelayHours || 24));
        nextCallTime = nextCall.toISOString();
      }
    }

    const { data, error } = await this.client
      .from('sequence_entries')
      .update({
        current_attempt: currentAttempt,
        next_call_time: nextCallTime,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw new Error(error.message || 'Failed to update sequence entry');

    console.log(`✅ SequenceService: updated entry ${entryId} -> status=${newStatus}, attempt=${currentAttempt}`);
    return data;
  }
}

module.exports = SequenceService;

