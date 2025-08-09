const getSupabaseClient = require('./dbClient');

class SequenceEntriesRepo {
  constructor() {
    this.client = getSupabaseClient();
  }

  async getReadySequenceEntries(limit = 10) {
    const now = new Date().toISOString();
    const { data, error } = await this.client
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
        ),
        phone_numbers (
          id,
          phone_number,
          do_not_call,
          contacts (
            id,
            first_name,
            last_name,
            company_name
          )
        )
      `)
      .eq('status', 'active')
      .lte('next_call_time', now)
      .order('next_call_time', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async updateSequenceEntry(entryId, updateData) {
    const { data, error } = await this.client
      .from('sequence_entries')
      .update(updateData)
      .eq('id', entryId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findActiveSequenceEntriesForPhoneNumber(phoneNumber) {
    const { data, error } = await this.client
      .from('sequence_entries')
      .select(`
        *,
        sequences (
          id,
          name,
          max_attempts,
          retry_delay_hours
        ),
        phone_numbers (
          id,
          phone_number,
          do_not_call,
          contacts (
            id,
            first_name,
            last_name,
            company_name
          )
        )
      `)
      .eq('phone_numbers.phone_number', phoneNumber)
      .eq('status', 'active');
    if (error) throw error;
    return data || [];
  }

  async getSequenceEntries(filters = {}) {
    let query = this.client
      .from('sequence_entries')
      .select(`
        *,
        sequences (
          id,
          name,
          description,
          max_attempts,
          retry_delay_hours,
          is_active
        ),
        phone_numbers (
          id,
          phone_number,
          do_not_call,
          contacts (
            id,
            first_name,
            last_name,
            company_name
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (filters.sequenceId) query = query.eq('sequence_id', filters.sequenceId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.phoneNumberId) query = query.eq('phone_number_id', filters.phoneNumberId);
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.page && filters.limit) {
      const offset = (filters.page - 1) * filters.limit;
      query = query.range(offset, offset + filters.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
}

module.exports = SequenceEntriesRepo;

