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
					const claimed = await this.dbService.claimSequenceEntry(entry.id);
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
                    const callResult = await elevenLabsService.makeOutboundCall(
                        agentId,
                        agentPhoneNumberId,
                        phoneNumber,
                        { message: 'Hello! This is your AI assistant calling via ElevenLabs.' }
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

    /**
     * Get all phone numbers with active sequences
     * @returns {Promise<Array>} Array of phone numbers with sequence data
     */
    async getActiveSequences() {
        if (!this.initialized) {
            throw new Error('Sequence Manager Service not initialized');
        }

        try {
            console.log('📋 Getting active sequences...');
            
            // Try to get calls with sequence tracking
            let { data: calls, error } = await this.dbService.client
                .from('calls')
                .select('phone_number, sequence_status, next_call_time, call_attempts')
                .not('sequence_status', 'is', null)
                .order('next_call_time', { ascending: true });

            if (error && error.message.includes('column calls.sequence_status does not exist')) {
                console.log('⚠️ Sequence tracking columns not available, returning empty list');
                return [];
            }
            if (error) throw error;

            // Group by phone number and get sequence info
            const sequences = {};
            calls.forEach(call => {
                if (!sequences[call.phone_number]) {
                    sequences[call.phone_number] = {
                        phone_number: call.phone_number,
                        sequence_status: call.sequence_status,
                        next_call_time: call.next_call_time,
                        total_attempts: 0,
                        last_attempt: null
                    };
                }
                sequences[call.phone_number].total_attempts += call.call_attempts || 1;
                if (!sequences[call.phone_number].last_attempt || call.created_at > sequences[call.phone_number].last_attempt) {
                    sequences[call.phone_number].last_attempt = call.created_at;
                }
            });

            const activeSequences = Object.values(sequences).filter(seq => 
                seq.sequence_status === 'active' && seq.next_call_time
            );

            console.log(`✅ Found ${activeSequences.length} active sequences`);
            return activeSequences;
        } catch (error) {
            console.error('❌ Error getting active sequences:', error.message);
            throw error;
        }
    }

    /**
     * Get sequence statistics for a specific phone number
     * @param {string} phoneNumber - Phone number to analyze
     * @returns {Promise<Object>} Sequence statistics
     */
    async getSequenceStatistics(phoneNumber) {
        if (!this.initialized) {
            throw new Error('Sequence Manager Service not initialized');
        }

        try {
            console.log(`📊 Getting sequence statistics for ${phoneNumber}...`);
            
            const stats = await this.dbService.getSequenceStatisticsByPhoneNumber(phoneNumber);
            
            console.log(`✅ Sequence statistics retrieved for ${phoneNumber}`);
            return stats;
        } catch (error) {
            console.error('❌ Error getting sequence statistics:', error.message);
            throw error;
        }
    }

    /**
     * Update sequence tracking for a call
     * @param {string} callId - Call ID
     * @param {Object} sequenceData - Sequence data
     * @returns {Promise<Object>} Updated call record
     */
    async updateSequenceTracking(callId, sequenceData) {
        if (!this.initialized) {
            throw new Error('Sequence Manager Service not initialized');
        }

        try {
            console.log(`🔄 Updating sequence tracking for call ${callId}...`);
            
            const updatedCall = await this.dbService.updateSequenceTracking(callId, sequenceData);
            
            console.log(`✅ Sequence tracking updated for call ${callId}`);
            return updatedCall;
        } catch (error) {
            console.error('❌ Error updating sequence tracking:', error.message);
            throw error;
        }
    }

    /**
     * Calculate next call time based on sequence rules
     * @param {Object} callData - Current call data
     * @param {Object} analysisData - Analysis results from Gemini
     * @returns {Promise<Object>} Next call scheduling data
     */
    async calculateNextCallTimeAdvanced(callData, analysisData) {
        if (!this.initialized) {
            throw new Error('Sequence Manager Service not initialized');
        }

        try {
            console.log(`📅 Calculating next call time for ${callData.phone_number}...`);
            
            // Get current sequence statistics
            const stats = await this.getSequenceStatistics(callData.phone_number);
            const currentAttempts = stats.total_calls + 1;
            
            // Get business hours from sequence (if available)
            let businessHours = null;
            if (callData.sequence_id) {
                try {
                    const sequence = await this.dbService.getSequenceById(callData.sequence_id);
                    if (sequence) {
                        businessHours = {
                            timezone: sequence.timezone || 'UTC',
                            business_hours_start: sequence.business_hours_start || '09:00:00',
                            business_hours_end: sequence.business_hours_end || '17:00:00',
                            exclude_weekends: sequence.exclude_weekends !== false // Default to true
                        };
                    }
                } catch (error) {
                    console.log('Could not get sequence business hours, using default calculation');
                }
            }
            
            // Calculate next call time based on analysis and sequence rules
            const nextCallData = this.applySequenceRules(callData, analysisData, currentAttempts, businessHours);
            
            console.log(`✅ Next call calculated: ${nextCallData.next_call_time} (attempt ${currentAttempts})`);
            return nextCallData;
        } catch (error) {
            console.error('❌ Error calculating next call time:', error.message);
            throw error;
        }
    }

    /**
     * Apply sequence rules to determine next call scheduling
     * @param {Object} callData - Current call data
     * @param {Object} analysisData - Analysis results
     * @param {number} attemptNumber - Current attempt number
     * @param {Object} businessHours - Business hours configuration (optional)
     * @returns {Object} Next call scheduling data
     */
    applySequenceRules(callData, analysisData, attemptNumber, businessHours = null) {
        const now = new Date();
        let nextCallTime = null;
        let sequenceStatus = 'active';
        
        // Default sequence rules
        const sequenceRules = {
            max_attempts: 5,
            intervals: {
                1: 24 * 60 * 60 * 1000, // 1 day
                2: 3 * 24 * 60 * 60 * 1000, // 3 days
                3: 7 * 24 * 60 * 60 * 1000, // 1 week
                4: 14 * 24 * 60 * 60 * 1000, // 2 weeks
                5: 30 * 24 * 60 * 60 * 1000 // 1 month
            }
        };

        // Check if meeting was booked
        if (analysisData && analysisData.meeting_booked) {
            sequenceStatus = 'completed';
            console.log('✅ Meeting booked - sequence completed');
        }
        // Check if person is very upset
        else if (analysisData && analysisData.person_very_upset) {
            sequenceStatus = 'stopped';
            console.log('⚠️ Person very upset - sequence stopped');
        }
        // Check if max attempts reached
        else if (attemptNumber >= sequenceRules.max_attempts) {
            sequenceStatus = 'max_attempts_reached';
            console.log(`⚠️ Max attempts (${sequenceRules.max_attempts}) reached`);
        }
        // Schedule next call
        else {
            const interval = sequenceRules.intervals[attemptNumber] || sequenceRules.intervals[5];
            const hoursToAdd = interval / (1000 * 60 * 60); // Convert milliseconds to hours
            
            if (businessHours) {
                // Use business hours service to calculate next call time
                nextCallTime = this.businessHoursService.addHoursRespectingBusinessHours(now, hoursToAdd, businessHours);
            } else {
                // Fallback to simple calculation
                nextCallTime = new Date(now.getTime() + interval);
            }
            console.log(`📅 Next call scheduled for attempt ${attemptNumber + 1}`);
        }

        return {
            call_attempts: attemptNumber,
            last_call_time: now.toISOString(),
            next_call_time: nextCallTime ? nextCallTime.toISOString() : null,
            sequence_status: sequenceStatus
        };
    }

    /**
     * Get calls ready for next sequence attempt
     * @returns {Promise<Array>} Array of calls ready for next attempt
     */
    async getCallsReadyForNextAttempt() {
        if (!this.initialized) {
            throw new Error('Sequence Manager Service not initialized');
        }

        try {
            console.log('🔍 Finding calls ready for next sequence attempt...');
            
            const now = new Date();
            let { data: calls, error } = await this.dbService.client
                .from('calls')
                .select('*')
                .eq('sequence_status', 'active')
                .not('next_call_time', 'is', null)
                .lte('next_call_time', now.toISOString())
                .order('next_call_time', { ascending: true });

            if (error && error.message.includes('column calls.sequence_status does not exist')) {
                console.log('⚠️ Sequence tracking columns not available, returning empty list');
                return [];
            }
            if (error) throw error;

            console.log(`✅ Found ${calls.length} calls ready for next attempt`);
            return calls;
        } catch (error) {
            console.error('❌ Error getting calls ready for next attempt:', error.message);
            throw error;
        }
    }

    /**
     * Test the sequence manager service
     * @returns {Promise<Object>} Test results
     */
    async testService() {
        try {
            console.log('🧪 Testing Sequence Manager Service...');
            
            const initResult = await this.initialize();
            if (!initResult) {
                throw new Error('Service initialization failed');
            }

            // Test getting active sequences
            const activeSequences = await this.getActiveSequences();
            
            // Test sequence rules calculation
            const sampleCallData = {
                phone_number: '+1234567890',
                status: 'completed'
            };
            
            const sampleAnalysisData = {
                meeting_booked: false,
                person_interested: true,
                person_very_upset: false
            };
            
            const nextCallData = this.applySequenceRules(sampleCallData, sampleAnalysisData, 1);
            
            return {
                success: true,
                message: 'Sequence Manager Service test successful',
                active_sequences_count: activeSequences.length,
                sample_next_call: nextCallData
            };
        } catch (error) {
            console.error('❌ Sequence Manager Service test failed:', error.message);
            return {
                success: false,
                message: `Test failed: ${error.message}`
            };
        }
    }
}

module.exports = new SequenceManagerService(); 