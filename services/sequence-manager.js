const SupabaseDBService = require('./supabase-db');

class SequenceManagerService {
    constructor() {
        this.dbService = new SupabaseDBService();
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

            console.log('✅ Sequence Manager Service initialized successfully');
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Sequence Manager Service:', error.message);
            return false;
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
            
            const stats = await this.dbService.getSequenceStatistics(phoneNumber);
            
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
    async calculateNextCallTime(callData, analysisData) {
        if (!this.initialized) {
            throw new Error('Sequence Manager Service not initialized');
        }

        try {
            console.log(`📅 Calculating next call time for ${callData.phone_number}...`);
            
            // Get current sequence statistics
            const stats = await this.getSequenceStatistics(callData.phone_number);
            const currentAttempts = stats.total_calls + 1;
            
            // Calculate next call time based on analysis and sequence rules
            const nextCallData = this.applySequenceRules(callData, analysisData, currentAttempts);
            
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
     * @returns {Object} Next call scheduling data
     */
    applySequenceRules(callData, analysisData, attemptNumber) {
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
            nextCallTime = new Date(now.getTime() + interval);
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