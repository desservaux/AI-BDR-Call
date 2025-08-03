const { createClient } = require('@supabase/supabase-js');

class SupabaseDBService {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL || 'https://elvnlecliyhdlflzmzeh.supabase.co';
        this.supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdm5sZWNsaXloZGxmbHptemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MjEyODgsImV4cCI6MjA2OTI5NzI4OH0.SOds2z36iJuHv4tSusH1vlSqUNLM6oT9oFpBy2bL624';
        
        this.client = createClient(this.supabaseUrl, this.supabaseKey);
    }

    /**
     * Test database connection
     * @returns {Promise<boolean>} True if connection is successful
     */
    async testConnection() {
        try {
            const { data, error } = await this.client
                .from('calls')
                .select('count')
                .limit(1);
            
            if (error) throw error;
            
            console.log('✅ Supabase connection successful');
            return true;
        } catch (error) {
            console.error('❌ Supabase connection failed:', error.message);
            return false;
        }
    }

    /**
     * Create a new call record
     * @param {Object} callData - Call data
     * @returns {Promise<Object>} Created call record
     */
    async createCall(callData) {
        try {
            const { data, error } = await this.client
                .from('calls')
                .insert([{
                    phone_number: callData.phoneNumber,
                    chat_id: callData.chatId,
                    chat_group_id: callData.chatGroupId,
                    status: callData.status || 'active'
                }])
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Call created with ID: ${data.id}`);
            return data;
        } catch (error) {
            console.error('Error creating call:', error.message);
            throw new Error(`Failed to create call: ${error.message}`);
        }
    }

    /**
     * Update call status and end time
     * @param {string} callId - Call ID
     * @param {string} status - New status
     * @returns {Promise<Object>} Updated call record
     */
    async updateCallStatus(callId, status) {
        try {
            const updateData = { status };
            
            if (status === 'completed' || status === 'failed') {
                updateData.end_time = new Date().toISOString();
            }

            const { data, error } = await this.client
                .from('calls')
                .update(updateData)
                .eq('id', callId)
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Call ${callId} status updated to: ${status}`);
            return data;
        } catch (error) {
            console.error('Error updating call status:', error.message);
            throw new Error(`Failed to update call status: ${error.message}`);
        }
    }

    /**
     * Insert transcription data
     * @param {Array} transcriptionData - Array of transcription objects
     * @returns {Promise<Array>} Inserted transcription records
     */
    async insertTranscriptions(transcriptionData) {
        try {
            const { data, error } = await this.client
                .from('transcriptions')
                .insert(transcriptionData)
                .select();

            if (error) throw error;
            
            console.log(`✅ Inserted ${data.length} transcription records`);
            return data;
        } catch (error) {
            console.error('Error inserting transcriptions:', error.message);
            throw new Error(`Failed to insert transcriptions: ${error.message}`);
        }
    }

    /**
     * Insert event data
     * @param {Array} eventData - Array of event objects
     * @returns {Promise<Array>} Inserted event records
     */
    async insertEvents(eventData) {
        try {
            const { data, error } = await this.client
                .from('events')
                .insert(eventData)
                .select();

            if (error) throw error;
            
            console.log(`✅ Inserted ${data.length} event records`);
            return data;
        } catch (error) {
            console.error('Error inserting events:', error.message);
            throw new Error(`Failed to insert events: ${error.message}`);
        }
    }

    /**
     * Insert booking analysis
     * @param {Object} bookingData - Booking analysis data
     * @returns {Promise<Object>} Inserted booking analysis record
     */
    async insertBookingAnalysis(bookingData) {
        try {
            const { data, error } = await this.client
                .from('booking_analysis')
                .insert([bookingData])
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Booking analysis inserted for call: ${bookingData.call_id}`);
            return data;
        } catch (error) {
            console.error('Error inserting booking analysis:', error.message);
            throw new Error(`Failed to insert booking analysis: ${error.message}`);
        }
    }

    /**
     * Get all calls with optional filtering
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of calls
     */
    async getCalls(filters = {}) {
        try {
            let query = this.client
                .from('calls_with_outcome')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.phoneNumber) {
                query = query.ilike('phone_number', `%${filters.phoneNumber}%`);
            }

            if (filters.bookingOutcome) {
                query = query.eq('booking_outcome', filters.bookingOutcome);
            }

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }

            if (filters.endDate) {
                query = query.lte('created_at', filters.endDate);
            }

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('Error getting calls:', error.message);
            throw new Error(`Failed to get calls: ${error.message}`);
        }
    }

    /**
     * Get call details with transcriptions
     * @param {string} callId - Call ID
     * @returns {Promise<Object>} Call details with transcriptions
     */
    async getCallDetails(callId) {
        try {
            // Get call info
            const { data: callData, error: callError } = await this.client
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (callError) throw callError;

            // Get transcriptions
            const { data: transcriptionData, error: transcriptionError } = await this.client
                .from('transcriptions')
                .select('*')
                .eq('call_id', callId)
                .order('timestamp', { ascending: true });

            if (transcriptionError) throw transcriptionError;

            // Get booking analysis
            const { data: bookingData, error: bookingError } = await this.client
                .from('booking_analysis')
                .select('*')
                .eq('call_id', callId)
                .single();

            if (bookingError && bookingError.code !== 'PGRST116') {
                throw bookingError;
            }

            return {
                call: callData,
                transcriptions: transcriptionData,
                bookingAnalysis: bookingData
            };
        } catch (error) {
            console.error('Error getting call details:', error.message);
            throw new Error(`Failed to get call details: ${error.message}`);
        }
    }

    /**
     * Get call statistics
     * @returns {Promise<Object>} Call statistics
     */
    async getCallStatistics() {
        try {
            const { data, error } = await this.client
                .from('calls_with_outcome')
                .select('booking_outcome, count')
                .select('booking_outcome');

            if (error) throw error;

            const stats = {
                total: 0,
                yes: 0,
                no: 0,
                unknown: 0
            };

            data.forEach(call => {
                stats.total++;
                if (call.booking_outcome === 'yes') stats.yes++;
                else if (call.booking_outcome === 'no') stats.no++;
                else stats.unknown++;
            });

            return stats;
        } catch (error) {
            console.error('Error getting call statistics:', error.message);
            throw new Error(`Failed to get call statistics: ${error.message}`);
        }
    }

    /**
     * Export call data
     * @param {Object} filters - Export filters
     * @returns {Promise<Array>} Export data
     */
    async exportCallData(filters = {}) {
        try {
            const calls = await this.getCalls(filters);
            
            return calls.map(call => ({
                id: call.id,
                phone_number: call.phone_number,
                start_time: call.start_time,
                end_time: call.end_time,
                duration: call.duration,
                status: call.status,
                booking_outcome: call.booking_outcome,
                confidence_score: call.confidence_score,
                created_at: call.created_at
            }));
        } catch (error) {
            console.error('Error exporting call data:', error.message);
            throw new Error(`Failed to export call data: ${error.message}`);
        }
    }
}

module.exports = SupabaseDBService; 