const SupabaseDBService = require('./supabase-db');
const elevenLabsService = require('./elevenlabs');
const BusinessHoursService = require('./business-hours');

class SequenceManagerService {
    constructor() {
        this.dbService = new SupabaseDBService();
        this.businessHoursService = new BusinessHoursService();
        this.initialized = false;
    }

    /**
     * Initialize the sequence manager service
     * @returns {Promise<boolean>} True if initialization is successful
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Sequence Manager Service...');
            
            // Test database connection
            const dbTest = await this.dbService.testConnection();
            if (!dbTest) {
                throw new Error('Database service not available');
            }

            // Initialize business hours service
            await this.businessHoursService.initialize();

            console.log('✅ Sequence Manager Service initialized successfully');
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Sequence Manager Service:', error.message);
            return false;
        }
    }

    /**
     * Process ready sequence entries and initiate calls
     * This is the "Caller" logic - initiates calls and immediately schedules next attempts
     * @param {number} limit - Maximum number of entries to process
     * @returns {Promise<Object>} Processing results
     */
    async processReadySequenceEntries(limit = 10) {
        if (!this.initialized) {
            throw new Error('Sequence Manager Service not initialized');
        }

        try {
            console.log(`🚀 Processing ready sequence entries (limit: ${limit})...`);
            
            // Get ready entries from database
            const readyEntries = await this.dbService.getReadySequenceEntries(limit);
            
            if (readyEntries.length === 0) {
                console.log('✅ No ready sequence entries found');
                return {
                    processed: 0,
                    calls_initiated: 0,
                    errors: []
                };
            }

            console.log(`📞 Found ${readyEntries.length} ready entries, initiating calls...`);
            
            const results = {
                processed: 0,
                calls_initiated: 0,
                errors: []
            };

            // Process each ready entry
            for (const entry of readyEntries) {
                try {
                    results.processed++;
                    
                    // Skip if sequence is paused/inactive
                    if (!entry.sequences?.is_active) {
                        console.log(`⏸️ Skipping ${entry.phone_numbers?.phone_number || entry.id} - sequence is paused`);
                        continue;
                    }

                    // Skip if phone number is marked as do_not_call
                    if (entry.phone_numbers?.do_not_call || entry.phone_numbers?.contacts?.do_not_call) {
                        console.log(`⚠️ Skipping ${entry.phone_numbers.phone_number} - marked as do not call`);
                        continue;
                    }

                    // Skip if max attempts reached
                    if (entry.current_attempt >= entry.sequences.max_attempts) {
                        console.log(`⚠️ Skipping ${entry.phone_numbers.phone_number} - max attempts reached`);
                        continue;
                    }


                    // Attempt to claim the entry to avoid concurrent processing
                    const envLockSeconds = parseInt(process.env.SEQUENCE_CALLER_LOCK_SECONDS || '120', 10);
                    const lockSeconds = Number.isFinite(envLockSeconds) && envLockSeconds > 0 ? envLockSeconds : 120;
                    const claimed = await this.dbService.claimSequenceEntry(entry.id, lockSeconds);
					if (!claimed) {
						console.log(`⏭️ Skipping entry ${entry.id} - already claimed by another worker`);
						continue;
					}

					const phoneNumber = entry.phone_numbers.phone_number;
                    console.log(`📞 Initiating call to ${phoneNumber} (attempt ${entry.current_attempt + 1}/${entry.sequences.max_attempts})`);

                    // Make the call via ElevenLabs (fire and forget) with correct signature
                    const agentId = process.env.ELEVENLABS_AGENT_ID;
                    const agentPhoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
                    if (!agentId || !agentPhoneNumberId) {
                        throw new Error('Missing ELEVENLABS_AGENT_ID or ELEVENLABS_PHONE_NUMBER_ID environment variables');
                    }
					// Compute personalization variables
					const tz = entry.sequences?.timezone || 'UTC';
					const firstName = (entry.phone_numbers?.contacts?.first_name || '').trim() || null;
					const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(new Date());

					// Optional personalized message
					const personalizedMessage = firstName
						? `Hi ${firstName}, this is your AI assistant calling via ElevenLabs.`
						: 'Hello! This is your AI assistant calling via ElevenLabs.';

					const callResult = await elevenLabsService.makeOutboundCall(
						agentId,
						agentPhoneNumberId,
						phoneNumber,
						{
							message: personalizedMessage,
							dynamic_variables: {
								name_test: firstName,
								weekday: weekday
							},
							source_info: { source: 'sequence-caller', sequence_id: entry.sequences.id, sequence_entry_id: entry.id }
						}
					);
                    
                    if (callResult.success) {
                        results.calls_initiated++;
                        console.log(`✅ Call initiated successfully to ${phoneNumber}`);
                    } else {
                        console.log(`❌ Failed to initiate call to ${phoneNumber}: ${callResult.error}`);
                        results.errors.push(`Call to ${phoneNumber}: ${callResult.error}`);
                    }

                    // Immediately update sequence entry with next attempt scheduling
                    const nextAttempt = entry.current_attempt + 1;
                    
                    // Get business hours from sequence
                    const businessHours = {
                        timezone: entry.sequences.timezone || 'UTC',
                        business_hours_start: entry.sequences.business_hours_start || '09:00:00',
                        business_hours_end: entry.sequences.business_hours_end || '17:00:00',
                        exclude_weekends: entry.sequences.exclude_weekends !== false // Default to true
                    };
                    
                    const nextCallTime = this.calculateNextCallTimeSimple(entry.sequences.retry_delay_hours, businessHours);
                    
                    await this.dbService.updateSequenceEntryAfterCall(entry.id, {
                        successful: callResult.success,
                        current_attempt: nextAttempt,
                        next_call_time: nextCallTime,
                        status: nextAttempt >= entry.sequences.max_attempts ? 'max_attempts_reached' : 'active'
                    });

                    console.log(`📅 Scheduled next attempt for ${phoneNumber} at ${nextCallTime}`);

                } catch (error) {
                    console.error(`❌ Error processing sequence entry ${entry.id}:`, error.message);
                    results.errors.push(`Entry ${entry.id}: ${error.message}`);
                }
            }

            console.log(`✅ Sequence processing complete: ${results.processed} processed, ${results.calls_initiated} calls initiated`);
            return results;

        } catch (error) {
            console.error('❌ Error processing ready sequence entries:', error.message);
            throw error;
        }
    }

    /**
     * Handle successful call cleanup
     * This is the "Cleanup" logic - triggered when a call duration exceeds threshold
     * @param {string} phoneNumber - Phone number that had a successful call
     * @returns {Promise<Object>} Cleanup results
     */
    async handleSuccessfulCall(phoneNumber) {
        if (!this.initialized) {
            throw new Error('Sequence Manager Service not initialized');
        }

        try {
            console.log(`🧹 Handling successful call cleanup for ${phoneNumber}...`);
            
            // Find all active sequence entries for this phone number
            const activeEntries = await this.dbService.findActiveSequenceEntriesForPhoneNumber(phoneNumber);
            
            if (activeEntries.length === 0) {
                console.log(`✅ No active sequence entries found for ${phoneNumber}`);
                return {
                    entries_updated: 0,
                    phone_number_updated: false,
                    contact_updated: false
                };
            }

            console.log(`📝 Found ${activeEntries.length} active sequence entries for ${phoneNumber}`);

            const results = {
                entries_updated: 0,
                phone_number_updated: false,
                contact_updated: false
            };

            // Update all active sequence entries to completed
            for (const entry of activeEntries) {
                try {
                    await this.dbService.updateSequenceEntry(entry.id, {
                        status: 'completed',
                        updated_at: new Date().toISOString()
                    });
                    results.entries_updated++;
                    console.log(`✅ Updated sequence entry ${entry.id} to completed`);
                } catch (error) {
                    console.error(`❌ Error updating sequence entry ${entry.id}:`, error.message);
                }
            }

            // Update phone number to do_not_call = true
            try {
                const phoneNumbers = await this.dbService.getPhoneNumbers({
                    phoneNumber: phoneNumber
                });

                if (phoneNumbers.length > 0) {
                    const phoneNumberId = phoneNumbers[0].id;
                    await this.dbService.updatePhoneNumber(phoneNumberId, {
                        do_not_call: true,
                        updated_at: new Date().toISOString()
                    });
                    results.phone_number_updated = true;
                    console.log(`✅ Updated phone number ${phoneNumber} to do_not_call = true`);

                    // Also update linked contact if exists
                    if (phoneNumbers[0].contact_id) {
                        await this.dbService.updateContact(phoneNumbers[0].contact_id, {
                            do_not_call: true,
                            updated_at: new Date().toISOString()
                        });
                        results.contact_updated = true;
                        console.log(`✅ Updated contact ${phoneNumbers[0].contact_id} to do_not_call = true`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error updating phone number ${phoneNumber}:`, error.message);
            }

            console.log(`✅ Successful call cleanup complete for ${phoneNumber}: ${results.entries_updated} entries updated`);
            return results;

        } catch (error) {
            console.error('❌ Error handling successful call cleanup:', error.message);
            throw error;
        }
    }

    /**
     * Calculate next call time based on retry delay and business hours
     * @param {number} retryDelayHours - Hours to wait before next attempt
     * @param {Object} businessHours - Business hours configuration (optional)
     * @returns {string} ISO string for next call time
     */
    calculateNextCallTimeSimple(retryDelayHours = 24, businessHours = null) {
        const now = new Date();
        
        if (businessHours) {
            // Use business hours service to calculate next call time
            const nextCall = this.businessHoursService.addHoursRespectingBusinessHours(now, retryDelayHours, businessHours);
            return nextCall.toISOString();
        } else {
            // Fallback to simple calculation
            const nextCall = new Date(now);
            nextCall.setHours(nextCall.getHours() + retryDelayHours);
            return nextCall.toISOString();
        }
    }
}

module.exports = new SequenceManagerService(); 