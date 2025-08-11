const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

class SupabaseDBService {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL ;
        this.supabaseKey = process.env.SUPABASE_ANON_KEY ;
        
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
            const phoneNumber = callData.phoneNumber || callData.phone_number;
            
            if (!phoneNumber) {
                throw new Error('Phone number is required for call creation');
            }

            // Ensure phone number record exists (UPSERT)
            let phoneNumberId = null;
            try {
                // Try to find existing phone number
                const { data: existingPhone, error: findError } = await this.client
                    .from('phone_numbers')
                    .select('id')
                    .eq('phone_number', phoneNumber)
                    .single();

                if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
                    throw findError;
                }

                if (existingPhone) {
                    phoneNumberId = existingPhone.id;
                } else {
                    // Create new phone number record using UPSERT
                    const { data: newPhone, error: createError } = await this.client
                        .from('phone_numbers')
                        .upsert([{
                            phone_number: phoneNumber,
                            phone_type: 'mobile',
                            is_primary: true,
                            do_not_call: false
                        }], {
                            onConflict: 'phone_number',
                            ignoreDuplicates: false
                        })
                        .select('id')
                        .single();

                    if (createError) throw createError;
                    phoneNumberId = newPhone.id;
                }
            } catch (error) {
                console.error('Error ensuring phone number exists:', error.message);
                // Continue without phone_number_id if there's an error
            }

            // Prepare call data with all possible fields
            const insertData = {
                phone_number: phoneNumber,
                phone_number_id: phoneNumberId,
                chat_id: callData.chatId, // Keep for backward compatibility
                chat_group_id: callData.chatGroupId, // Keep for backward compatibility
                status: callData.status || 'active',
                // Sequence tracking fields
                call_attempts: callData.call_attempts || 1,
                last_call_time: callData.last_call_time || new Date().toISOString(),
                next_call_time: callData.next_call_time,
                sequence_status: callData.sequence_status || 'active',
                created_at: callData.created_at || new Date().toISOString()
            };

            // Add ElevenLabs specific fields if available
            if (callData.elevenlabs_conversation_id) {
                insertData.elevenlabs_conversation_id = callData.elevenlabs_conversation_id;
            }
            if (callData.agent_id) {
                insertData.agent_id = callData.agent_id;
            }
            if (callData.agent_name) {
                insertData.agent_name = callData.agent_name;
            }
            if (callData.call_result) {
                insertData.call_result = callData.call_result;
            }
            if (callData.answered !== undefined) {
                insertData.answered = callData.answered;
            }
            if (callData.duration_seconds) {
                insertData.duration_seconds = callData.duration_seconds;
            }
            if (callData.message_count) {
                insertData.message_count = callData.message_count;
            }
            if (callData.start_time) {
                insertData.start_time = callData.start_time;
            }
            if (callData.call_summary_title) {
                insertData.call_summary_title = callData.call_summary_title;
            }
            if (callData.transcript_summary) {
                insertData.transcript_summary = callData.transcript_summary;
            }
            if (callData.is_external_call !== undefined) {
                insertData.is_external_call = callData.is_external_call;
            }

            // Remove undefined values
            Object.keys(insertData).forEach(key => {
                if (insertData[key] === undefined) {
                    delete insertData[key];
                }
            });

            // Try to insert with all fields first
            let { data, error } = await this.client
                .from('calls')
                .insert([insertData])
                .select()
                .single();

            if (error && error.message.includes('column') && error.message.includes('does not exist')) {
                console.log('⚠️ Some columns missing, trying with basic fields only');
                
                // Fallback: insert with only basic fields
                const basicInsertData = {
                    phone_number: insertData.phone_number,
                    phone_number_id: insertData.phone_number_id,
                    status: insertData.status,
                    created_at: insertData.created_at
                };

                // Add fields that might exist
                if (insertData.elevenlabs_conversation_id) {
                    basicInsertData.elevenlabs_conversation_id = insertData.elevenlabs_conversation_id;
                }

                const { data: basicData, error: basicError } = await this.client
                    .from('calls')
                    .insert([basicInsertData])
                    .select()
                    .single();

                if (basicError) throw basicError;
                data = basicData;
            } else if (error) {
                throw error;
            }
            
            console.log(`✅ Call created with ID: ${data.id}, phone_number_id: ${phoneNumberId}`);
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
     * Delete all transcriptions for a specific call
     * @param {string} callId - Call ID
     * @returns {Promise<number>} Number of deleted records
     */
    async deleteTranscriptionsForCall(callId) {
        try {
            const { data, error } = await this.client
                .from('transcriptions')
                .delete()
                .eq('call_id', callId)
                .select();

            if (error) throw error;
            
            console.log(`🗑️ Deleted ${data.length} transcription records for call ${callId}`);
            return data.length;
        } catch (error) {
            console.error('Error deleting transcriptions:', error.message);
            throw new Error(`Failed to delete transcriptions: ${error.message}`);
        }
    }

    /**
     * Create transcriptions (alias for insertTranscriptions)
     * @param {Array} transcriptionData - Array of transcription objects
     * @returns {Promise<Array>} Inserted transcription records
     */
    async createTranscriptions(transcriptionData) {
        return this.insertTranscriptions(transcriptionData);
    }

    /**
     * Delete transcriptions by call ID (alias for deleteTranscriptionsForCall)
     * @param {string} callId - Call ID
     * @returns {Promise<number>} Number of deleted records
     */
    async deleteTranscriptionsByCallId(callId) {
        return this.deleteTranscriptionsForCall(callId);
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
     * Get booking analysis by call ID
     * @param {string} callId - Call ID
     * @returns {Promise<Object|null>} Booking analysis data or null
     */
    async getBookingAnalysisByCallId(callId) {
        try {
            const { data, error } = await this.client
                .from('booking_analysis')
                .select('*')
                .eq('call_id', callId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned
                    return null;
                }
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error('Error getting booking analysis by call ID:', error.message);
            return null;
        }
    }

    /**
     * Get calls with optional filtering
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of calls
     */
    async getCalls(filters = {}) {
        try {
            let query = this.client
                .from('calls')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.phone) {
                query = query.ilike('phone_number', `%${filters.phone}%`);
            }

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            if (filters.date) {
                // Convert date to ISO string for comparison
                const dateObj = new Date(filters.date);
                const startOfDay = dateObj.toISOString();
                const endOfDay = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000).toISOString();
                query = query.gte('created_at', startOfDay).lt('created_at', endOfDay);
            }

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error getting calls:', error.message);
            throw new Error(`Failed to get calls: ${error.message}`);
        }
    }

    /**
     * Get calls with advanced filtering including analysis data
     * @param {Object} filters - Advanced filter options
     * @returns {Promise<Array>} Array of calls with analysis data
     */
    async getCallsWithAdvancedFilters(filters = {}) {
        try {
            // Use the new calls_with_analysis view for comprehensive data
            let query = this.client
                .from('calls_with_analysis')
                .select('*')
                .order('start_time', { ascending: false })
                .order('created_at', { ascending: false });

            // Apply basic filters
            if (filters.phone) {
                query = query.ilike('phone_number', `%${filters.phone}%`);
            }

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            // Apply call_result filter (new enhanced status)
            if (filters.callResult) {
                query = query.eq('call_result', filters.callResult);
            }

            // Apply answered filter
            if (filters.answered !== undefined) {
                query = query.eq('answered', filters.answered);
            }

            // Apply contact filters
            if (filters.contactName) {
                query = query.or(`first_name.ilike.%${filters.contactName}%,last_name.ilike.%${filters.contactName}%`);
            }

            if (filters.company) {
                query = query.ilike('company_name', `%${filters.company}%`);
            }

            // Apply date range filters
            if (filters.dateStart) {
                const startDate = new Date(filters.dateStart);
                query = query.gte('created_at', startDate.toISOString());
            }

            if (filters.dateEnd) {
                const endDate = new Date(filters.dateEnd);
                endDate.setDate(endDate.getDate() + 1); // Include the entire end date
                query = query.lt('created_at', endDate.toISOString());
            }

            // Apply duration filter
            if (filters.duration) {
                const durationRanges = {
                    '0-1': { min: 0, max: 60 },
                    '1-5': { min: 60, max: 300 },
                    '5-10': { min: 300, max: 600 },
                    '10+': { min: 600, max: null }
                };

                const range = durationRanges[filters.duration];
                if (range) {
                    if (range.max) {
                        query = query.gte('duration_seconds', range.min).lt('duration_seconds', range.max);
                    } else {
                        query = query.gte('duration_seconds', range.min);
                    }
                }
            }

            // Apply analysis filters
            if (filters.meetingBooked !== undefined && filters.meetingBooked !== null) {
                const meetingBookedBool = filters.meetingBooked === true || filters.meetingBooked === 'true';
                query = query.eq('meeting_booked', meetingBookedBool);
            }

            if (filters.personInterested !== undefined && filters.personInterested !== null) {
                const personInterestedBool = filters.personInterested === true || filters.personInterested === 'true';
                query = query.eq('person_interested', personInterestedBool);
            }

            if (filters.personUpset !== undefined && filters.personUpset !== null) {
                const personUpsetBool = filters.personUpset === true || filters.personUpset === 'true';
                query = query.eq('person_very_upset', personUpsetBool);
            }

            // Apply pagination
            if (filters.page && filters.limit) {
                const offset = (filters.page - 1) * filters.limit;
                query = query.range(offset, offset + filters.limit - 1);
            } else if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const { data: calls, error, count } = await query;

            if (error) throw error;

            // Node.js sort fallback to ensure proper date ranking
            const sortedCalls = (calls || []).sort((a, b) => 
                new Date(b.start_time || b.created_at) - new Date(a.start_time || a.created_at)
            );

            // If we have analysis filters, we need to filter by analysis data
            if (filters.meetingBooked || filters.personInterested || filters.personUpset) {
                const filteredCalls = [];

                for (const call of sortedCalls) {
                    try {
                        const analysis = await this.getBookingAnalysisByCallId(call.id);
                        
                        // Apply analysis filters
                        let includeCall = true;
                        
                        if (filters.meetingBooked !== null && filters.meetingBooked !== undefined) {
                            const meetingBookedBool = filters.meetingBooked === true || filters.meetingBooked === 'true';
                            // Only include if analysis exists and matches the filter
                            if (!analysis || analysis.meeting_booked !== meetingBookedBool) {
                                includeCall = false;
                            }
                        }
                        
                        if (filters.personInterested !== null && filters.personInterested !== undefined) {
                            const personInterestedBool = filters.personInterested === true || filters.personInterested === 'true';
                            // Only include if analysis exists and matches the filter
                            if (!analysis || analysis.person_interested !== personInterestedBool) {
                                includeCall = false;
                            }
                        }
                        
                        if (filters.personUpset !== null && filters.personUpset !== undefined) {
                            const personUpsetBool = filters.personUpset === true || filters.personUpset === 'true';
                            // Only include if analysis exists and matches the filter
                            if (!analysis || analysis.person_very_upset !== personUpsetBool) {
                                includeCall = false;
                            }
                        }
                        
                        if (includeCall) {
                            filteredCalls.push(call);
                        }
                    } catch (error) {
                        console.warn(`Error checking analysis for call ${call.id}:`, error.message);
                        // If we can't get analysis, exclude the call when analysis filters are applied
                        // This ensures we only show calls that actually have the requested analysis data
                    }
                }
                
                return {
                    calls: filteredCalls,
                    total: filteredCalls.length
                };
            }

            return {
                calls: sortedCalls,
                total: sortedCalls.length
            };
        } catch (error) {
            console.error('Error getting calls with advanced filters:', error.message);
            throw new Error(`Failed to get calls with advanced filters: ${error.message}`);
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
     * Get call by ElevenLabs conversation ID
     * @param {string} conversationId - ElevenLabs conversation ID
     * @returns {Promise<Object|null>} Call record or null if not found
     */
    async getCallByConversationId(conversationId) {
        try {
            console.log(`🔍 Looking for conversation ID: ${conversationId}`);
            
            // First try with the new column name
            let { data, error } = await this.client
                .from('calls')
                .select('*')
                .eq('elevenlabs_conversation_id', conversationId)
                .single();

            if (error && error.code === 'PGRST116') {
                console.log(`❌ Conversation ${conversationId} not found in database`);
                return null; // Not found
            }
            if (error && error.message.includes('column calls.elevenlabs_conversation_id does not exist')) {
                // Fallback: try to find by phone number and other fields
                console.log('⚠️ elevenlabs_conversation_id column not found, using fallback search');
                return null; // For now, return null to create new record
            }
            if (error) {
                console.error(`❌ Database error for conversation ${conversationId}:`, error.message);
                throw error;
            }

            console.log(`✅ Found existing call for conversation ${conversationId}: ${data.id}`);
            return data;
        } catch (error) {
            console.error(`❌ Error getting call by conversation ID ${conversationId}:`, error.message);
            // Don't throw error, just return null to create new record
            return null;
        }
    }

    /**
     * Update call record
     * @param {string} callId - Call ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated call record
     */
    async updateCall(callId, updateData) {
        try {
            const { data, error } = await this.client
                .from('calls')
                .update(updateData)
                .eq('id', callId)
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Call ${callId} updated successfully`);
            return data;
        } catch (error) {
            console.error('Error updating call:', error.message);
            throw new Error(`Failed to update call: ${error.message}`);
        }
    }

    /**
     * Get all calls for a specific phone number (for sequence tracking)
     * @param {string} phoneNumber - Phone number to query
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of calls for the phone number
     */
    async getCallsByPhoneNumber(phoneNumber, options = {}) {
        try {
            let query = this.client
                .from('calls')
                .select('*')
                .eq('phone_number', phoneNumber)
                .order('created_at', { ascending: false });

            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.status) {
                query = query.eq('status', options.status);
            }

            const { data, error } = await query;

            if (error) throw error;

            console.log(`✅ Retrieved ${data.length} calls for phone number ${phoneNumber}`);
            return data;
        } catch (error) {
            console.error('Error getting calls by phone number:', error.message);
            throw new Error(`Failed to get calls by phone number: ${error.message}`);
        }
    }

    /**
     * Get sequence statistics for a phone number
     * @param {string} phoneNumber - Phone number to analyze
     * @returns {Promise<Object>} Sequence statistics
     */
    async getSequenceStatisticsByPhoneNumber(phoneNumber) {
        try {
            const calls = await this.getCallsByPhoneNumber(phoneNumber);
            
            const stats = {
                phone_number: phoneNumber,
                total_calls: calls.length,
                successful_calls: 0,
                failed_calls: 0,
                average_duration: 0,
                total_duration: 0,
                last_call_time: null,
                next_call_time: null,
                sequence_status: 'inactive'
            };

            if (calls.length > 0) {
                calls.forEach(call => {
                    if (call.call_result === 'answered') {
                        stats.successful_calls++;
                    } else {
                        stats.failed_calls++;
                    }

                    if (call.duration_seconds) {
                        stats.total_duration += call.duration_seconds;
                    }
                });

                stats.average_duration = stats.total_duration / calls.length;
                stats.last_call_time = calls[0].created_at; // Most recent call
                
                // Find the most recent call with next_call_time
                const callWithNextTime = calls.find(call => call.next_call_time);
                if (callWithNextTime) {
                    stats.next_call_time = callWithNextTime.next_call_time;
                    stats.sequence_status = callWithNextTime.sequence_status || 'active';
                }
            }

            return stats;
        } catch (error) {
            console.error('Error getting sequence statistics:', error.message);
            throw new Error(`Failed to get sequence statistics: ${error.message}`);
        }
    }

    /**
     * Update sequence tracking for a call
     * @param {string} callId - Call ID
     * @param {Object} sequenceData - Sequence tracking data
     * @returns {Promise<Object>} Updated call record
     */
    async updateSequenceTracking(callId, sequenceData) {
        try {
            const updateData = {
                call_attempts: sequenceData.call_attempts,
                last_call_time: sequenceData.last_call_time,
                next_call_time: sequenceData.next_call_time,
                sequence_status: sequenceData.sequence_status,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('calls')
                .update(updateData)
                .eq('id', callId)
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Sequence tracking updated for call ${callId}`);
            return data;
        } catch (error) {
            console.error('Error updating sequence tracking:', error.message);
            throw new Error(`Failed to update sequence tracking: ${error.message}`);
        }
    }

    /**
     * Get call statistics
     * @returns {Promise<Object>} Call statistics
     */
    async getCallStatistics() {
        try {
            // Get basic call statistics
            const { data: calls, error: callsError } = await this.client
                .from('calls')
                .select('status, call_result, duration_seconds, is_external_call');

            if (callsError) throw callsError;

            const stats = {
                total_calls: calls.length,
                internal_calls: 0,
                external_calls: 0,
                successful_calls: 0,
                failed_calls: 0,
                average_duration: 0,
                total_duration: 0
            };

            calls.forEach(call => {
                if (call.is_external_call) {
                    stats.external_calls++;
                } else {
                    stats.internal_calls++;
                }

                if (call.call_result === 'answered') {
                    stats.successful_calls++;
                } else {
                    stats.failed_calls++;
                }

                if (call.duration_seconds) {
                    stats.total_duration += call.duration_seconds;
                }
            });

            stats.average_duration = stats.total_calls > 0 ? stats.total_duration / stats.total_calls : 0;

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

    /**
     * Get call by ID
     * @param {string} callId - Call ID
     * @returns {Promise<Object|null>} Call details or null if not found
     */
    async getCallById(callId) {
        try {
            const { data, error } = await this.client
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned
                    return null;
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error getting call by ID:', error.message);
            throw new Error(`Failed to get call by ID: ${error.message}`);
        }
    }

    /**
     * Delete calls based on criteria
     * @param {Object} criteria - Criteria for deletion
     * @returns {Promise<number>} Number of deleted calls
     */
    async deleteCallsByCriteria(criteria) {
        try {
            let query = this.client
                .from('calls')
                .delete();

            // Apply criteria
            if (criteria.elevenlabs_conversation_id === null) {
                query = query.is('elevenlabs_conversation_id', null);
            }
            if (criteria.phone_number) {
                query = query.eq('phone_number', criteria.phone_number);
            }

            const { data, error } = await query;

            if (error) throw error;

            console.log(`✅ Deleted ${data?.length || 0} calls matching criteria`);
            return data?.length || 0;
        } catch (error) {
            console.error('Error deleting calls by criteria:', error.message);
            throw new Error(`Failed to delete calls by criteria: ${error.message}`);
        }
    }

    /**
     * Get call analytics for dashboard
     * @returns {Promise<Object>} Analytics data
     */
    async getCallAnalytics() {
        try {
            // Get basic statistics
            const stats = await this.getCallStatistics();
            
            // Get booking analysis statistics
            const { data: bookingAnalysis, error: bookingError } = await this.client
                .from('booking_analysis')
                .select('meeting_booked, person_interested, person_very_upset');

            if (bookingError) throw bookingError;

            // Calculate booking metrics
            const bookingStats = {
                total_analyses: bookingAnalysis.length,
                meetings_booked: 0,
                people_interested: 0,
                people_upset: 0
            };

            bookingAnalysis.forEach(analysis => {
                if (analysis.meeting_booked) bookingStats.meetings_booked++;
                if (analysis.person_interested) bookingStats.people_interested++;
                if (analysis.person_very_upset) bookingStats.people_upset++;
            });

            // Calculate success rate
            const successRate = stats.total_calls > 0 ? 
                Math.round((stats.successful_calls / stats.total_calls) * 100) : 0;

            // Calculate average duration in minutes
            const avgDurationMinutes = Math.round(stats.average_duration / 60);

            // Get recent activity (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data: recentCalls, error: recentError } = await this.client
                .from('calls')
                .select('created_at, call_result')
                .gte('created_at', sevenDaysAgo.toISOString());

            if (recentError) throw recentError;

            const recentStats = {
                calls_last_7_days: recentCalls.length,
                new_calls: recentCalls.filter(call => call.call_result === 'answered').length
            };

            return {
                // Basic stats
                totalCalls: stats.total_calls,
                successRate: successRate,
                avgDuration: avgDurationMinutes,
                meetingsBooked: bookingStats.meetings_booked,
                
                // Recent activity
                newCalls: recentStats.new_calls,
                callsLast7Days: recentStats.calls_last_7_days,
                
                // Trends (placeholder for now)
                successRateChange: 0, // Would need historical data
                newMeetings: bookingStats.meetings_booked, // Simplified for now
                
                // Detailed breakdowns
                internalCalls: stats.internal_calls,
                externalCalls: stats.external_calls,
                successfulCalls: stats.successful_calls,
                failedCalls: stats.failed_calls,
                
                // Booking analysis
                peopleInterested: bookingStats.people_interested,
                peopleUpset: bookingStats.people_upset,
                totalAnalyses: bookingStats.total_analyses
            };
        } catch (error) {
            console.error('Error getting call analytics:', error.message);
            throw new Error(`Failed to get call analytics: ${error.message}`);
        }
    }

    /**
     * Get all calls (for bulk operations)
     * @returns {Promise<Array>} Array of all calls
     */
    async getAllCalls() {
        try {
            const { data, error } = await this.client
                .from('calls_with_analysis')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error getting all calls:', error.message);
            throw new Error(`Failed to get all calls: ${error.message}`);
        }
    }

    // ===== CONTACTS MANAGEMENT =====

    /**
     * Create a new contact
     * @param {Object} contactData - Contact data
     * @returns {Promise<Object>} Created contact
     */
    async createContact(contactData) {
        try {
            const { data, error } = await this.client
                .from('contacts')
                .insert([contactData])
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Contact created with ID: ${data.id}`);
            return data;
        } catch (error) {
            console.error('Error creating contact:', error.message);
            throw new Error(`Failed to create contact: ${error.message}`);
        }
    }

    /**
     * Get contacts with optional filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of contacts
     */
    async getContacts(filters = {}) {
        try {
            let query = this.client
                .from('contacts')
                .select('*')
                .order('created_at', { ascending: false });

            if (filters.name) {
                query = query.or(`first_name.ilike.%${filters.name}%,last_name.ilike.%${filters.name}%`);
            }

            if (filters.email) {
                query = query.ilike('email', `%${filters.email}%`);
            }

            if (filters.company) {
                query = query.ilike('company_name', `%${filters.company}%`);
            }

            if (filters.doNotCall !== undefined) {
                query = query.eq('do_not_call', filters.doNotCall);
            }

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error getting contacts:', error.message);
            throw new Error(`Failed to get contacts: ${error.message}`);
        }
    }

    /**
     * Get contact by ID with phone numbers
     * @param {string} contactId - Contact ID
     * @returns {Promise<Object>} Contact with phone numbers
     */
    async getContactById(contactId) {
        try {
            // Get contact
            const { data: contact, error: contactError } = await this.client
                .from('contacts')
                .select('*')
                .eq('id', contactId)
                .single();

            if (contactError) throw contactError;

            // Get phone numbers for this contact
            const { data: phoneNumbers, error: phoneError } = await this.client
                .from('phone_numbers')
                .select('*')
                .eq('contact_id', contactId)
                .order('is_primary', { ascending: false });

            if (phoneError) throw phoneError;

            return {
                ...contact,
                phone_numbers: phoneNumbers || []
            };
        } catch (error) {
            console.error('Error getting contact:', error.message);
            throw new Error(`Failed to get contact: ${error.message}`);
        }
    }

    /**
     * Update contact
     * @param {string} contactId - Contact ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated contact
     */
    async updateContact(contactId, updateData) {
        try {
            const { data, error } = await this.client
                .from('contacts')
                .update(updateData)
                .eq('id', contactId)
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Contact updated: ${contactId}`);
            return data;
        } catch (error) {
            console.error('Error updating contact:', error.message);
            throw new Error(`Failed to update contact: ${error.message}`);
        }
    }

    /**
     * Delete contact
     * @param {string} contactId - Contact ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteContact(contactId) {
        try {
            const { error } = await this.client
                .from('contacts')
                .delete()
                .eq('id', contactId);

            if (error) throw error;
            
            console.log(`✅ Contact deleted: ${contactId}`);
            return true;
        } catch (error) {
            console.error('Error deleting contact:', error.message);
            throw new Error(`Failed to delete contact: ${error.message}`);
        }
    }

    // ===== PHONE NUMBERS MANAGEMENT =====

    /**
     * Create a new phone number
     * @param {Object} phoneData - Phone number data
     * @returns {Promise<Object>} Created phone number
     */
    async createPhoneNumber(phoneData) {
        try {
            const { data, error } = await this.client
                .from('phone_numbers')
                .insert([phoneData])
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Phone number created with ID: ${data.id}`);
            return data;
        } catch (error) {
            console.error('Error creating phone number:', error.message);
            throw new Error(`Failed to create phone number: ${error.message}`);
        }
    }

    /**
     * Get phone numbers with optional filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of phone numbers
     */
    async getPhoneNumbers(filters = {}) {
        try {
            // Get phone numbers from the phone_numbers table only
            let query = this.client
                .from('phone_numbers')
                .select(`
                    *,
                    contacts (
                        id,
                        first_name,
                        last_name,
                        email,
                        company_name,
                        position
                    )
                `)
                .order('created_at', { ascending: false });

            if (filters.phoneNumber) {
                query = query.ilike('phone_number', `%${filters.phoneNumber}%`);
            }

            if (filters.contactId) {
                query = query.eq('contact_id', filters.contactId);
            }

            if (filters.phoneType) {
                query = query.eq('phone_type', filters.phoneType);
            }

            if (filters.doNotCall !== undefined) {
                query = query.eq('do_not_call', filters.doNotCall);
            }

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error getting phone numbers:', error.message);
            throw new Error(`Failed to get phone numbers: ${error.message}`);
        }
    }

    async generatePhoneNumbersFromCalls(filters = {}) {
        try {
            // Get unique phone numbers from calls
            const { data: calls, error: callsError } = await this.client
                .from('calls')
                .select('phone_number')
                .neq('phone_number', 'unknown')
                .order('created_at', { ascending: false });

            if (callsError) throw callsError;

            // Get unique phone numbers
            const uniquePhoneNumbers = [...new Set(calls.map(call => call.phone_number))];
            
            // Create phone number records for each unique number
            const phoneNumberRecords = [];
            for (const phoneNumber of uniquePhoneNumbers) {
                // Check if phone number already exists
                const { data: existingPhone, error: checkError } = await this.client
                    .from('phone_numbers')
                    .select('id')
                    .eq('phone_number', phoneNumber)
                    .single();

                if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
                    console.error(`Error checking phone number ${phoneNumber}:`, checkError);
                    continue;
                }

                if (!existingPhone) {
                    // Create new phone number record
                    const phoneRecord = {
                        phone_number: phoneNumber,
                        phone_type: 'mobile',
                        is_primary: true,
                        do_not_call: false
                    };

                    const { data: createdPhone, error: createError } = await this.client
                        .from('phone_numbers')
                        .insert([phoneRecord])
                        .select('*')
                        .single();

                    if (createError) {
                        console.error(`Error creating phone number ${phoneNumber}:`, createError);
                        continue;
                    }

                    phoneNumberRecords.push(createdPhone);
                } else {
                    // Get existing phone number with full details
                    const { data: existingPhoneFull, error: getError } = await this.client
                        .from('phone_numbers')
                        .select(`
                            *,
                            contacts (
                                id,
                                first_name,
                                last_name,
                                email,
                                company_name,
                                position
                            )
                        `)
                        .eq('id', existingPhone.id)
                        .single();

                    if (!getError) {
                        phoneNumberRecords.push(existingPhoneFull);
                    }
                }
            }

            // Apply filters to the generated phone numbers
            let filteredPhoneNumbers = phoneNumberRecords;

            if (filters.phoneNumber) {
                filteredPhoneNumbers = filteredPhoneNumbers.filter(pn => 
                    pn.phone_number.toLowerCase().includes(filters.phoneNumber.toLowerCase())
                );
            }

            if (filters.phoneType) {
                filteredPhoneNumbers = filteredPhoneNumbers.filter(pn => 
                    pn.phone_type === filters.phoneType
                );
            }

            if (filters.doNotCall !== undefined) {
                filteredPhoneNumbers = filteredPhoneNumbers.filter(pn => 
                    pn.do_not_call === filters.doNotCall
                );
            }

            return filteredPhoneNumbers;

        } catch (error) {
            console.error('Error generating phone numbers from calls:', error.message);
            return [];
        }
    }

    /**
     * Get phone number by ID
     * @param {string} phoneId - Phone number ID
     * @returns {Promise<Object>} Phone number with contact info
     */
    async getPhoneNumberById(phoneId) {
        try {
            const { data, error } = await this.client
                .from('phone_numbers')
                .select(`
                    *,
                    contacts (
                        id,
                        first_name,
                        last_name,
                        email,
                        company_name,
                        position
                    )
                `)
                .eq('id', phoneId)
                .single();

            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('Error getting phone number:', error.message);
            throw new Error(`Failed to get phone number: ${error.message}`);
        }
    }

    /**
     * Update phone number
     * @param {string} phoneId - Phone number ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated phone number
     */
    async updatePhoneNumber(phoneId, updateData) {
        try {
            const { data, error } = await this.client
                .from('phone_numbers')
                .update(updateData)
                .eq('id', phoneId)
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Phone number updated: ${phoneId}`);
            return data;
        } catch (error) {
            console.error('Error updating phone number:', error.message);
            throw new Error(`Failed to update phone number: ${error.message}`);
        }
    }

    /**
     * Delete phone number
     * @param {string} phoneId - Phone number ID
     * @returns {Promise<boolean>} Success status
     */
    async deletePhoneNumber(phoneId) {
        try {
            const { error } = await this.client
                .from('phone_numbers')
                .delete()
                .eq('id', phoneId);

            if (error) throw error;
            
            console.log(`✅ Phone number deleted: ${phoneId}`);
            return true;
        } catch (error) {
            console.error('Error deleting phone number:', error.message);
            throw new Error(`Failed to delete phone number: ${error.message}`);
        }
    }

    // ===== CALLS BY CONTACT/PHONE =====

    /**
     * Get calls by contact ID
     * @param {string} contactId - Contact ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of calls for the contact
     */
    async getCallsByContactId(contactId, options = {}) {
        try {
            let query = this.client
                .from('calls_with_analysis')
                .select('*')
                .eq('contact_id', contactId)
                .order('created_at', { ascending: false });

            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.page && options.limit) {
                const offset = (options.page - 1) * options.limit;
                query = query.range(offset, offset + options.limit - 1);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error getting calls by contact:', error.message);
            throw new Error(`Failed to get calls by contact: ${error.message}`);
        }
    }

    /**
     * Get calls by phone number ID
     * @param {string} phoneNumberId - Phone number ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of calls for the phone number
     */
    async getCallsByPhoneNumberId(phoneNumberId, options = {}) {
        try {
            // First, try to get the phone number record to get the actual phone number
            const { data: phoneRecord, error: phoneError } = await this.client
                .from('phone_numbers')
                .select('phone_number')
                .eq('id', phoneNumberId)
                .single();

            if (phoneError) {
                console.log(`Phone number record not found for ID: ${phoneNumberId}, trying direct phone number lookup`);
                // If phone number record doesn't exist, we can't proceed
                return [];
            }

            const phoneNumber = phoneRecord.phone_number;

            // Try to get calls by phone_number_id first
            let query = this.client
                .from('calls')
                .select('*')
                .eq('phone_number_id', phoneNumberId)
                .order('created_at', { ascending: false });

            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.page && options.limit) {
                const offset = (options.page - 1) * options.limit;
                query = query.range(offset, offset + options.limit - 1);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            // If we found calls by phone_number_id, return them
            if (data && data.length > 0) {
                return data;
            }

            // If no calls found by phone_number_id, try to find calls by phone_number directly
            console.log(`No calls found by phone_number_id, trying direct phone number search: ${phoneNumber}`);
            
            let fallbackQuery = this.client
                .from('calls')
                .select('*')
                .eq('phone_number', phoneNumber)
                .order('created_at', { ascending: false });

            if (options.limit) {
                fallbackQuery = fallbackQuery.limit(options.limit);
            }

            if (options.page && options.limit) {
                const offset = (options.page - 1) * options.limit;
                fallbackQuery = fallbackQuery.range(offset, offset + options.limit - 1);
            }

            const { data: fallbackData, error: fallbackError } = await fallbackQuery;

            if (fallbackError) throw fallbackError;
            
            return fallbackData || [];
        } catch (error) {
            console.error('Error getting calls by phone number:', error.message);
            throw new Error(`Failed to get calls by phone number: ${error.message}`);
        }
    }

    // ===== SEQUENCE MANAGEMENT =====

    /**
     * Create a new sequence
     * @param {Object} sequenceData - Sequence data
     * @returns {Promise<Object>} Created sequence
     */
    async createSequence(sequenceData) {
        try {
            const { data, error } = await this.client
                .from('sequences')
                .insert([sequenceData])
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Sequence created with ID: ${data.id}`);
            return data;
        } catch (error) {
            console.error('Error creating sequence:', error.message);
            throw new Error(`Failed to create sequence: ${error.message}`);
        }
    }

    /**
     * Get sequences with optional filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of sequences
     */
    async getSequences(filters = {}) {
        try {
            let query = this.client
                .from('sequences')
                .select('*')
                .order('created_at', { ascending: false });

            if (filters.name) {
                query = query.ilike('name', `%${filters.name}%`);
            }

            if (filters.isActive !== undefined) {
                query = query.eq('is_active', filters.isActive);
            }

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error getting sequences:', error.message);
            throw new Error(`Failed to get sequences: ${error.message}`);
        }
    }

    /**
     * Add phone number to sequence
     * @param {string} sequenceId - Sequence ID
     * @param {string} phoneNumberId - Phone number ID
     * @returns {Promise<Object>} Created sequence entry
     */
    async addPhoneNumberToSequence(sequenceId, phoneNumberId) {
        try {
            const { data, error } = await this.client
                .from('sequence_entries')
                .insert([{
                    sequence_id: sequenceId,
                    phone_number_id: phoneNumberId,
                    status: 'active'
                }])
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Phone number added to sequence: ${phoneNumberId}`);
            return data;
        } catch (error) {
            console.error('Error adding phone number to sequence:', error.message);
            throw new Error(`Failed to add phone number to sequence: ${error.message}`);
        }
    }

    // ===== SEQUENCE MANAGEMENT LOGIC =====

    /**
     * Get sequence entries that are ready for calling
     * @param {number} limit - Maximum number of entries to return
     * @returns {Promise<Array>} Array of sequence entries ready for calling
     */
    async getReadySequenceEntries(limit = 10) {
        try {
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
        } catch (error) {
            console.error('Error getting ready sequence entries:', error.message);
            throw new Error(`Failed to get ready sequence entries: ${error.message}`);
        }
    }

    /**
     * Update sequence entry after a call attempt
     * @param {string} entryId - Sequence entry ID
     * @param {Object} callResult - Result of the call attempt
     * @returns {Promise<Object>} Updated sequence entry
     */
    async updateSequenceEntryAfterCall(entryId, callResult) {
        try {
            // Get current entry with business hours
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

            if (entryError) throw entryError;

            const sequence = entry.sequences;
            const currentAttempt = entry.current_attempt + 1;
            const maxAttempts = sequence.max_attempts;
            const retryDelayHours = sequence.retry_delay_hours;

            let newStatus = 'active';
            let nextCallTime = null;

            // Determine next status and call time based on call result
            if (callResult.successful) {
                // Call was successful, mark as completed
                newStatus = 'completed';
            } else if (currentAttempt >= maxAttempts) {
                // Max attempts reached
                newStatus = 'max_attempts_reached';
            } else {
                // Schedule next call with business hours consideration
                const businessHours = {
                    timezone: sequence.timezone || 'UTC',
                    business_hours_start: sequence.business_hours_start || '09:00:00',
                    business_hours_end: sequence.business_hours_end || '17:00:00',
                    exclude_weekends: sequence.exclude_weekends !== false // Default to true
                };
                
                // Use business hours service if available, otherwise fallback to simple calculation
                try {
                    const BusinessHoursService = require('./business-hours');
                    const businessHoursService = new BusinessHoursService();
                    await businessHoursService.initialize();
                    
                    const now = new Date();
                    const nextCall = businessHoursService.addHoursRespectingBusinessHours(now, retryDelayHours, businessHours);
                    nextCallTime = nextCall.toISOString();
                } catch (error) {
                    console.error('Error using business hours service, falling back to simple calculation:', error.message);
                    // Fallback to simple calculation
                    const nextCall = new Date();
                    nextCall.setHours(nextCall.getHours() + retryDelayHours);
                    nextCallTime = nextCall.toISOString();
                }
            }

            // Update the sequence entry
            const { data, error } = await this.client
                .from('sequence_entries')
                .update({
                    current_attempt: currentAttempt,
                    next_call_time: nextCallTime,
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', entryId)
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Sequence entry updated: ${entryId}, status: ${newStatus}, attempt: ${currentAttempt}`);
            return data;
        } catch (error) {
            console.error('Error updating sequence entry:', error.message);
            throw new Error(`Failed to update sequence entry: ${error.message}`);
        }
    }

    /**
     * Update a sequence entry with custom data
     * @param {string} entryId - Sequence entry ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated sequence entry
     */
    async updateSequenceEntry(entryId, updateData) {
        try {
            const { data, error } = await this.client
                .from('sequence_entries')
                .update(updateData)
                .eq('id', entryId)
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Sequence entry updated: ${entryId}`);
            return data;
        } catch (error) {
            console.error('Error updating sequence entry:', error.message);
            throw new Error(`Failed to update sequence entry: ${error.message}`);
        }
    }

    /**
     * Find all active sequence entries for a given phone number
     * @param {string} phoneNumber - Phone number to search for
     * @returns {Promise<Array>} Array of active sequence entries
     */
    async findActiveSequenceEntriesForPhoneNumber(phoneNumber) {
        try {
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
            
            console.log(`✅ Found ${data.length} active sequence entries for ${phoneNumber}`);
            return data || [];
        } catch (error) {
            console.error('Error finding active sequence entries for phone number:', error.message);
            return [];
        }
    }

    /**
     * Get sequence entries with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of sequence entries
     */
    async getSequenceEntries(filters = {}) {
        try {
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

            if (filters.sequenceId) {
                query = query.eq('sequence_id', filters.sequenceId);
            }

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            if (filters.phoneNumberId) {
                query = query.eq('phone_number_id', filters.phoneNumberId);
            }

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            if (filters.page && filters.limit) {
                const offset = (filters.page - 1) * filters.limit;
                query = query.range(offset, offset + filters.limit - 1);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error getting sequence entries:', error.message);
            throw new Error(`Failed to get sequence entries: ${error.message}`);
        }
    }

    /**
     * Get sequence by ID
     * @param {string} sequenceId - Sequence ID
     * @returns {Promise<Object>} Sequence details
     */
    async getSequenceById(sequenceId) {
        try {
            const { data, error } = await this.client
                .from('sequences')
                .select('*')
                .eq('id', sequenceId)
                .single();

            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('Error getting sequence by ID:', error.message);
            throw new Error(`Failed to get sequence: ${error.message}`);
        }
    }

    /**
     * Update sequence
     * @param {string} sequenceId - Sequence ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated sequence
     */
    async updateSequence(sequenceId, updateData) {
        try {
            const { data, error } = await this.client
                .from('sequences')
                .update(updateData)
                .eq('id', sequenceId)
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Sequence updated: ${sequenceId}`);
            return data;
        } catch (error) {
            console.error('Error updating sequence:', error.message);
            throw new Error(`Failed to update sequence: ${error.message}`);
        }
    }

    /**
     * Delete sequence
     * @param {string} sequenceId - Sequence ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteSequence(sequenceId) {
        try {
            const { error } = await this.client
                .from('sequences')
                .delete()
                .eq('id', sequenceId);

            if (error) throw error;
            
            console.log(`✅ Sequence deleted: ${sequenceId}`);
            return true;
        } catch (error) {
            console.error('Error deleting sequence:', error.message);
            throw new Error(`Failed to delete sequence: ${error.message}`);
        }
    }

    /**
     * Get sequence statistics
     * @param {string} sequenceId - Optional sequence ID to filter by
     * @returns {Promise<Object>} Sequence statistics
     */
    async getSequenceStatisticsForSequence(sequenceId = null) {
        try {
            let query = this.client
                .from('sequence_entries')
                .select(`
                    status,
                    current_attempt,
                    sequences (
                        id,
                        name,
                        max_attempts
                    )
                `);

            if (sequenceId) {
                query = query.eq('sequence_id', sequenceId);
            }

            const { data, error } = await query;

            if (error) throw error;

            const stats = {
                total_entries: data.length,
                active_entries: 0,
                completed_entries: 0,
                max_attempts_reached: 0,
                stopped_entries: 0,
                average_attempts: 0,
                sequences: {}
            };

            let totalAttempts = 0;

            data.forEach(entry => {
                stats[`${entry.status}_entries`]++;
                totalAttempts += entry.current_attempt;

                // Group by sequence
                const sequenceName = entry.sequences?.name || 'Unknown';
                if (!stats.sequences[sequenceName]) {
                    stats.sequences[sequenceName] = {
                        total: 0,
                        active: 0,
                        completed: 0,
                        max_attempts_reached: 0
                    };
                }
                stats.sequences[sequenceName].total++;
                stats.sequences[sequenceName][`${entry.status}_entries`]++;
            });

            stats.average_attempts = data.length > 0 ? Math.round(totalAttempts / data.length * 100) / 100 : 0;

            return stats;
        } catch (error) {
            console.error('Error getting sequence statistics:', error.message);
            throw new Error(`Failed to get sequence statistics: ${error.message}`);
        }
    }

    /**
     * Pause or resume a sequence
     * @param {string} sequenceId - Sequence ID
     * @param {boolean} isActive - Whether to activate or deactivate
     * @returns {Promise<Object>} Updated sequence
     */
    async updateSequenceStatus(sequenceId, isActive) {
        try {
            const { data, error } = await this.client
                .from('sequences')
                .update({
                    is_active: isActive,
                    updated_at: new Date().toISOString()
                })
                .eq('id', sequenceId)
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Sequence status updated: ${sequenceId}, active: ${isActive}`);
            return data;
        } catch (error) {
            console.error('Error updating sequence status:', error.message);
            throw new Error(`Failed to update sequence status: ${error.message}`);
        }
    }

    /**
     * Get batch calling queue (entries ready for calling)
     * @param {number} limit - Maximum concurrent calls (default 10)
     * @returns {Promise<Array>} Array of entries ready for calling
     */
    async getBatchCallingQueue(limit = 10) {
        try {
            const readyEntries = await this.getReadySequenceEntries(limit);
            
            // Filter out entries where phone number is marked as do_not_call
            const validEntries = readyEntries.filter(entry => 
                !entry.phone_numbers?.do_not_call && 
                !entry.phone_numbers?.contacts?.do_not_call
            );

            return validEntries.slice(0, limit);
        } catch (error) {
            console.error('Error getting batch calling queue:', error.message);
            throw new Error(`Failed to get batch calling queue: ${error.message}`);
        }
    }

    

    /**
     * Get sequence entry by phone number
     * @param {string} phoneNumber - Phone number to search for
     * @returns {Promise<Object>} Sequence entry
     */
    async getSequenceEntryByPhoneNumber(phoneNumber) {
        try {
            const { data, error } = await this.client
                .from('sequence_entries')
                .select(`
                    *,
                    phone_numbers (
                        id,
                        phone_number
                    )
                `)
                .eq('phone_numbers.phone_number', phoneNumber)
                .eq('status', 'active')
                .single();

            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('Error getting sequence entry by phone number:', error.message);
            return null;
        }
    }

    // ===== CSV UPLOAD PROCESSING =====

    /**
     * Process CSV upload for contacts and phone numbers
     * @param {string} csvContent - CSV file content
     * @returns {Promise<Object>} Upload result with statistics
     */
    async processCSVUpload(csvContent) {
        try {
            const lines = csvContent.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                throw new Error('CSV must have at least a header row and one data row');
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const dataRows = lines.slice(1);

            console.log(`📁 Processing CSV with ${dataRows.length} rows`);

            const result = {
                total_rows: dataRows.length,
                contacts_created: 0,
                phone_numbers_created: 0,
                errors: [],
                duplicates: 0
            };

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                const values = row.split(',').map(v => v.trim());
                
                try {
                    const rowData = this.parseCSVRow(headers, values, i + 2);
                    const uploadResult = await this.processContactRow(rowData);
                    
                    if (uploadResult.contact_created) result.contacts_created++;
                    if (uploadResult.phone_created) result.phone_numbers_created++;
                    if (uploadResult.duplicate) result.duplicates++;
                    
                } catch (error) {
                    result.errors.push(`Row ${i + 2}: ${error.message}`);
                }
            }

            console.log(`✅ CSV processing complete: ${result.contacts_created} contacts, ${result.phone_numbers_created} phone numbers`);
            return result;

        } catch (error) {
            console.error('Error processing CSV upload:', error.message);
            throw new Error(`Failed to process CSV: ${error.message}`);
        }
    }

    /**
     * Process XLSX upload for contacts and phone numbers
     * @param {Buffer} xlsxBuffer - XLSX file buffer
     * @returns {Promise<Object>} Upload result with statistics
     */
    async processXLSXUpload(xlsxBuffer) {
        try {
            const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            if (!worksheet) {
                throw new Error('No worksheet found in XLSX file');
            }

            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length < 2) {
                throw new Error('XLSX must have at least a header row and one data row');
            }

            const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
            const dataRows = jsonData.slice(1);

            console.log(`📁 Processing XLSX with ${dataRows.length} rows`);

            const result = {
                total_rows: dataRows.length,
                contacts_created: 0,
                phone_numbers_created: 0,
                errors: [],
                duplicates: 0
            };

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                const values = row.map(v => String(v || '').trim());
                
                try {
                    const rowData = this.parseCSVRow(headers, values, i + 2);
                    const uploadResult = await this.processContactRow(rowData);
                    
                    if (uploadResult.contact_created) result.contacts_created++;
                    if (uploadResult.phone_created) result.phone_numbers_created++;
                    if (uploadResult.duplicate) result.duplicates++;
                    
                } catch (error) {
                    result.errors.push(`Row ${i + 2}: ${error.message}`);
                }
            }

            console.log(`✅ XLSX processing complete: ${result.contacts_created} contacts, ${result.phone_numbers_created} phone numbers`);
            return result;

        } catch (error) {
            console.error('Error processing XLSX upload:', error.message);
            throw new Error(`Failed to process XLSX: ${error.message}`);
        }
    }

    /**
     * Process CSV upload and add to sequence
     * @param {string} csvContent - CSV file content
     * @param {string} sequenceId - Sequence ID to add phone numbers to
     * @returns {Promise<Object>} Upload result with statistics
     */
    async processCSVUploadToSequence(csvContent, sequenceId) {
        try {
            // First process the CSV normally
            const uploadResult = await this.processCSVUpload(csvContent);
            
            // Then add all phone numbers to the sequence
            const phoneNumbers = await this.getPhoneNumbers();
            const phoneNumberIds = (phoneNumbers || []).map(p => p.id);
            const sequenceResult = await this.addPhoneNumbersToSequence(sequenceId, phoneNumberIds);
            
            uploadResult.sequence_additions = sequenceResult.added;
            uploadResult.sequence_errors = sequenceResult.errors;
            
            return uploadResult;

        } catch (error) {
            console.error('Error processing CSV upload to sequence:', error.message);
            throw new Error(`Failed to process CSV upload to sequence: ${error.message}`);
        }
    }

    /**
     * Process XLSX upload and add to sequence
     * @param {Buffer} xlsxBuffer - XLSX file buffer
     * @param {string} sequenceId - Sequence ID to add phone numbers to
     * @returns {Promise<Object>} Upload result with statistics
     */
    async processXLSXUploadToSequence(xlsxBuffer, sequenceId) {
        try {
            // First process the XLSX normally
            const uploadResult = await this.processXLSXUpload(xlsxBuffer);
            
            // Then add all phone numbers to the sequence
            const phoneNumbers = await this.getPhoneNumbers();
            const phoneNumberIds = (phoneNumbers || []).map(p => p.id);
            const sequenceResult = await this.addPhoneNumbersToSequence(sequenceId, phoneNumberIds);
            
            uploadResult.sequence_additions = sequenceResult.added;
            uploadResult.sequence_errors = sequenceResult.errors;
            
            return uploadResult;

        } catch (error) {
            console.error('Error processing XLSX upload to sequence:', error.message);
            throw new Error(`Failed to process XLSX upload to sequence: ${error.message}`);
        }
    }

    /**
     * Parse a CSV row into structured data
     * @param {Array} headers - CSV headers
     * @param {Array} values - CSV values
     * @param {number} rowNumber - Row number for error reporting
     * @returns {Object} Parsed row data
     */
    parseCSVRow(headers, values, rowNumber) {
        const data = {};
        
        headers.forEach((header, index) => {
            data[header] = values[index] || '';
        });

        // Validate required fields
        if (!data.first_name && !data.last_name) {
            throw new Error('At least first_name or last_name is required');
        }

        if (!data.phone_number) {
            throw new Error('phone_number is required');
        }

        // Validate phone number format - accept with or without + prefix
        const phoneNumber = data.phone_number;
        const internationalPattern = /^(\+?[1-9]\d{1,14})$/;
        
        if (!internationalPattern.test(phoneNumber)) {
            throw new Error('Phone number must be in international format (e.g., +1234567890 or 1234567890)');
        }
        
        // Ensure phone number has + prefix for consistency
        data.phone_number = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

        return {
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            email: data.email || '',
            company_name: data.company_name || '',
            position: data.position || '',
            notes: data.notes || '',
            phone_number: data.phone_number,
            phone_type: data.phone_type || 'mobile',
            is_primary: data.is_primary === 'true' || data.is_primary === '1',
            do_not_call: data.do_not_call === 'true' || data.do_not_call === '1'
        };
    }

    /**
     * Process a single contact row from CSV
     * @param {Object} rowData - Parsed row data
     * @returns {Promise<Object>} Processing result
     */
    async processContactRow(rowData) {
        const result = {
            contact_created: false,
            phone_created: false,
            duplicate: false,
            blocked: false,
            partial_import: false,
            message: ''
        };

        try {
            // Normalize phone number format
            const normalizedPhone = this.normalizePhoneNumber(rowData.phone_number);
            if (!normalizedPhone) {
                result.blocked = true;
                result.message = 'Invalid phone number format';
                return result;
            }

            // Check if phone number already exists
            const { data: existingPhone, error: checkPhoneError } = await this.client
                .from('phone_numbers')
                .select('id, contact_id')
                .eq('phone_number', normalizedPhone)
                .single();

            if (checkPhoneError && checkPhoneError.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw checkPhoneError;
            }

            if (existingPhone) {
                // Phone number exists - block import
                result.duplicate = true;
                result.blocked = true;
                result.message = `Phone number ${normalizedPhone} already exists`;
                return result;
            }

            // Create contact if name provided
            let contactId = null;
            if (rowData.first_name || rowData.last_name) {
                const contactData = {
                    first_name: rowData.first_name,
                    last_name: rowData.last_name,
                    email: rowData.email,
                    company_name: rowData.company_name,
                    position: rowData.position,
                    notes: rowData.notes,
                    do_not_call: rowData.do_not_call
                };

                const { data: contact, error: contactError } = await this.client
                    .from('contacts')
                    .insert([contactData])
                    .select()
                    .single();

                if (contactError) throw contactError;
                
                contactId = contact.id;
                result.contact_created = true;
            }

            // Create phone number using UPSERT to prevent race conditions
            const phoneData = {
                contact_id: contactId,
                phone_number: normalizedPhone,
                phone_type: rowData.phone_type || 'mobile',
                is_primary: rowData.is_primary || true,
                do_not_call: rowData.do_not_call || false
            };

            const { data: phone, error: createPhoneError } = await this.client
                .from('phone_numbers')
                .upsert([phoneData], {
                    onConflict: 'phone_number',
                    ignoreDuplicates: false
                })
                .select()
                .single();

            if (createPhoneError) throw createPhoneError;
            
            result.phone_created = true;
            result.message = 'Contact and phone number created successfully';
            return result;

        } catch (error) {
            console.error('Error processing contact row:', error.message);
            result.blocked = true;
            result.message = `Error: ${error.message}`;
            return result;
        }
    }

    /**
     * Normalize phone number format
     * @param {string} phoneNumber - Raw phone number
     * @returns {string|null} Normalized phone number or null if invalid
     */
    normalizePhoneNumber(phoneNumber) {
        if (!phoneNumber) return null;
        
        // Remove all non-digit characters except +
        let normalized = phoneNumber.replace(/[^\d+]/g, '');
        
        // Handle international format
        if (normalized.startsWith('+')) {
            // Keep as is for international numbers
            return normalized;
        } else if (normalized.startsWith('1') && normalized.length === 11) {
            // US number starting with 1
            return `+${normalized}`;
        } else if (normalized.length === 10) {
            // US number without country code
            return `+1${normalized}`;
        } else if (normalized.length >= 10) {
            // Assume it's a valid number, add + if not present
            return normalized.startsWith('+') ? normalized : `+${normalized}`;
        }
        
        return null; // Invalid format
    }

    /**
     * Add multiple phone numbers to a sequence
     * @param {string} sequenceId - Sequence ID
     * @param {Array} phoneNumbers - Array of phone number objects
     * @returns {Promise<Object>} Result with added count and errors
     */
    async addPhoneNumbersToSequence(sequenceId, phoneNumberIds) {
        const result = { added: 0, errors: [] };
        const ids = Array.isArray(phoneNumberIds) ? phoneNumberIds : [];
        for (const id of ids) {
            try {
                await this.addPhoneNumberToSequence(sequenceId, id);
                result.added++;
            } catch (error) {
                result.errors.push(`PhoneNumberId ${id}: ${error.message}`);
            }
        }
        return result;
    }
}

module.exports = SupabaseDBService; 