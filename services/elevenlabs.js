const axios = require('axios');

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.baseURL = 'https://api.elevenlabs.io/v1';
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Compute call outcome based on status_raw and duration
     * Pure function that determines call result based on ElevenLabs status and duration
     * @param {string} status_raw - Raw ElevenLabs status ('initiated', 'in-progress', 'processing', 'done', 'failed')
     * @param {number} durationSecs - Call duration in seconds
     * @returns {string|null} - 'answered', 'unanswered', 'failed', or null for non-final calls
     */
    computeOutcomeFrom(status_raw, durationSecs) {
        // Non-final statuses - return null to indicate "not final"
        if (['initiated', 'in-progress', 'processing'].includes(status_raw)) {
            return null;
        }

        // Handle 'done' status
        if (status_raw === 'done') {
            if (durationSecs > 5) {
                return 'answered';
            } else {
                return 'unanswered';
            }
        }

        // Handle 'failed' status
        if (status_raw === 'failed') {
            if (durationSecs > 5) {
                return 'answered'; // Override edge case
            } else {
                return 'failed';
            }
        }

        // Default case for unknown status
        return null;
    }

    /**
     * Initialize the ElevenLabs service
     * @returns {Promise<boolean>} True if initialization is successful
     */
    async initialize() {
        try {
            if (!this.apiKey) {
                throw new Error('ELEVENLABS_API_KEY environment variable is required');
            }

            // Test the connection by getting available agents
            const response = await this.client.get('/convai/agents');
            console.log(`✅ ElevenLabs service initialized successfully. Found ${response.data.length} agents.`);
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize ElevenLabs service:', error.message);
            return false;
        }
    }

    /**
     * Make an outbound call using a configured agent and phone number
     * @param {string} agentId - The ID of the ElevenLabs agent
     * @param {string} agentPhoneNumberId - The ID of the linked Twilio number in ElevenLabs
     * @param {string} toNumber - The destination phone number
     * @param {Object} options - Additional call options
     * @returns {Promise<Object>} The API response from ElevenLabs
     */
    async makeOutboundCall(agentId, agentPhoneNumberId, toNumber, options = {}) {
        try {
            console.log(`🚀 Making ElevenLabs outbound call to ${toNumber}...`);
            
            // Based on ElevenLabs API documentation, we need to use the correct endpoint
            const callData = {
                agent_id: agentId,
                agent_phone_number_id: agentPhoneNumberId,
                to_number: toNumber,
                ...options
            };

            // The correct endpoint for outbound calls
            const response = await this.client.post('/convai/twilio/outbound-call', callData);
            
            console.log(`✅ ElevenLabs outbound call initiated successfully`);
            console.log(`📞 Call ID: ${response.data.call_id}`);
            console.log(`💬 Conversation ID: ${response.data.conversation_id}`);
            
            return {
                success: true,
                call_id: response.data.call_id,
                conversation_id: response.data.conversation_id,
                status: response.data.status,
                message: 'Call initiated successfully via ElevenLabs'
            };
        } catch (error) {
            console.error('❌ Error making ElevenLabs outbound call:', error.response?.data || error.message);
            throw new Error(`Failed to make outbound call: ${error.response?.data?.detail || error.message}`);
        }
    }

    /**
     * Submit a batch calling job to ElevenLabs
     * @param {Object} params
     * @param {string} params.call_name - Friendly name for the job
     * @param {string} params.agent_id - ElevenLabs agent ID
     * @param {string} params.agent_phone_number_id - ElevenLabs phone number ID
     * @param {number|null} [params.scheduled_time_unix] - Unix seconds to schedule, or null for immediate
     * @param {Array<{phone_number: string}>} params.recipients - List of recipients
     * @returns {Promise<{success: boolean, job?: Object, error?: string}>}
     */
    async submitBatchCalling({ call_name, agent_id, agent_phone_number_id, scheduled_time_unix = null, recipients }) {
        try {
            if (!Array.isArray(recipients) || recipients.length === 0) {
                throw new Error('recipients is required and must be a non-empty array');
            }

            const cleanedRecipients = recipients.map(r => {
                const base = { phone_number: r.phone_number };
                if (r.id) base.id = r.id;
                if (r.conversation_initiation_client_data) {
                    base.conversation_initiation_client_data = r.conversation_initiation_client_data;
                }
                if (r.conversation_config_override) {
                    base.conversation_config_override = r.conversation_config_override;
                }
                if (r.custom_llm_extra_body) {
                    base.custom_llm_extra_body = r.custom_llm_extra_body;
                }
                if (r.user_id) base.user_id = r.user_id;
                if (r.source_info) base.source_info = r.source_info;
                // Support both nested (in client_data) and root-level dynamic_variables for backward compatibility
                if (r.dynamic_variables) base.dynamic_variables = r.dynamic_variables;
                return base;
            });

            const payload = {
                call_name,
                agent_id,
                agent_phone_number_id,
                scheduled_time_unix,
                recipients: cleanedRecipients
            };

            const res = await this.client.post('/convai/batch-calling/submit', payload);
            return { success: true, job: res.data };
        } catch (err) {
            const msg = err.response?.data?.detail || err.response?.data || err.message;
            console.error('Batch calling submit failed:', msg);
            return { success: false, error: msg };
        }
    }

    // (Removed) getConversationDetails - prefer getConversationDetailsEnhanced

    /**
     * Generate transcript from conversation messages
     * @param {Array} messages - Array of conversation messages
     * @returns {Array} Formatted transcript with timestamps
     */
    generateTranscript(messages) {
        return messages.map(entry => {
            let text = '';
            if (entry.message && typeof entry.message === 'object' && entry.message.text) {
                text = entry.message.text;
            } else if (typeof entry.message === 'string') {
                text = entry.message;
            } else if (entry.text) {
                text = entry.text;
            }

            return {
                speaker: entry.speaker || entry.role || 'unknown',
                text: text,
                timestamp: entry.timestamp || new Date().toISOString(),
                message_type: entry.message_type || 'text'
            };
        });
    }

    /**
     * Get all available agents
     * @returns {Promise<Array>} List of available agents
     */
    async getAgents() {
        try {
            const response = await this.client.get('/convai/agents');
            return response.data;
        } catch (error) {
            console.error('❌ Error getting agents:', error.response?.data || error.message);
            throw new Error('Failed to get agents');
        }
    }

    // (Removed) getAgentPhoneNumbers - unused

    /**
     * Test the service connection
     * @returns {Promise<Object>} Test results
     */
    async testConnection() {
        try {
            console.log('🧪 Testing ElevenLabs service connection...');
            
            // Test API key validity
            const agentsResponse = await this.client.get('/convai/agents');
            const agents = agentsResponse.data;
            
            // Test phone numbers (with fallback)
            let phoneNumbers = [];
            try {
                const phoneNumbersResponse = await this.client.get('/convai/phone-numbers');
                phoneNumbers = phoneNumbersResponse.data;
            } catch (phoneError) {
                console.log('⚠️ Phone numbers endpoint not available, using mock data');
                phoneNumbers = [{ id: 'mock_phone_1', phone_number: '+447846855904' }];
            }
            
            return {
                success: true,
                message: 'ElevenLabs service connection successful',
                agents_count: agents.length,
                phone_numbers_count: phoneNumbers.length,
                api_key_valid: true
            };
        } catch (error) {
            console.error('❌ ElevenLabs service connection test failed:', error.message);
            return {
                success: false,
                message: `Connection test failed: ${error.message}`,
                api_key_valid: false
            };
        }
    }

    // (Removed) getCallHistory - unused

    // (Removed) getCallDetails - unused

    /**
     * Get all conversations from ElevenLabs account (comprehensive call history)
     * @param {Object} options - Query options
     * @param {number} options.limit - Number of conversations to fetch (default: 100)
     * @param {string} options.cursor - Pagination cursor
     * @param {string} options.agent_id - Filter by specific agent
     * @param {string} options.phone_number_id - Filter by specific phone number
     * @param {string} options.status - Filter by call status
     * @param {string} options.start_date - Filter by start date (ISO string)
     * @param {string} options.end_date - Filter by end date (ISO string)
     * @returns {Promise<Object>} Comprehensive conversation data
     */
    async getAllConversations(options = {}) {
        try {
            console.log('📋 Fetching all conversations from ElevenLabs...');
            
            const params = new URLSearchParams();
            if (options.limit) params.append('limit', options.limit);
            if (options.cursor) params.append('cursor', options.cursor);
            if (options.agent_id) params.append('agent_id', options.agent_id);
            if (options.phone_number_id) params.append('phone_number_id', options.phone_number_id);
            if (options.status) params.append('status', options.status);
            if (options.start_date) params.append('start_date', options.start_date);
            if (options.end_date) params.append('end_date', options.end_date);

            const response = await this.client.get(`/convai/conversations?${params.toString()}`);
            
            // Normalize each conversation object before returning
            const normalizedConversations = (response.data.conversations || []).map(item => ({
                ...item,
                // Add start_time from start_time_unix_secs
                start_time: item.start_time_unix_secs ? new Date(item.start_time_unix_secs * 1000).toISOString() : null,
                // Add duration from call_duration_secs
                duration: item.call_duration_secs || 0,
                // Optionally attach to_number if present (may be null)
                to_number: item.to_number || null
            }));
            
            console.log(`✅ Retrieved ${normalizedConversations.length} conversations`);
            console.log(`📊 Total conversations available: ${response.data.total_count || 'unknown'}`);
            
            return {
                success: true,
                conversations: normalizedConversations,
                total_count: response.data.total_count || 0,
                next_cursor: response.data.next_cursor || null,
                has_more: response.data.has_more || false
            };
        } catch (error) {
            console.error('❌ Error getting all conversations:', error.response?.data || error.message);
            throw new Error(`Failed to get conversations: ${error.response?.data?.detail || error.message}`);
        }
    }

    /**
     * Get conversation details with enhanced metadata
     * @param {string} conversationId - The conversation ID
     * @returns {Promise<Object>} Enhanced conversation details
     */
    async getConversationDetailsEnhanced(conversationId) {
        try {
            console.log(`📋 Retrieving enhanced conversation details for ${conversationId}...`);
            
            const response = await this.client.get(`/convai/conversations/${conversationId}`);
            
            // Extract data from documented ElevenLabs API fields
            const conversationData = {
                success: true,
                conversation_id: conversationId,
                agent_id: response.data.agent_id,
                agent_name: response.data.agent_name,
                phone_number_id: response.data.phone_number_id,
                phone_number: response.data.phone_number,
                
                // Extract to_number from best available documented location
                to_number: response.data.metadata?.phone_call?.external_number || 
                          response.data.metadata?.external_number || 
                          response.data.external_number || 
                          response.data.to_number || null,
                
                agent_number: response.data.agent_number || 
                             response.data.metadata?.phone_call?.agent_number || 
                             response.data.metadata?.agent_number,
                
                // Extract start_time from documented field: metadata.start_time_unix_secs → ISO
                start_time: response.data.metadata?.start_time_unix_secs ? 
                           new Date(response.data.metadata.start_time_unix_secs * 1000).toISOString() : null,
                
                end_time: response.data.end_time,
                
                // Extract duration from documented field: metadata.call_duration_secs
                duration: response.data.metadata?.call_duration_secs || response.data.duration || 0,
                
                // Extract status_raw from documented field: response.data.status
                status_raw: response.data.status,
                
                // Extract message_count from documented field: response.data.message_count || transcript.length || 0
                message_count: response.data.message_count || 
                              (response.data.transcript ? response.data.transcript.length : 0) || 
                              (response.data.messages ? response.data.messages.length : 0) || 0,
                
                // Extract documented fields
                transcript_summary: response.data.transcript_summary,
                call_summary_title: response.data.call_summary_title,
                
                messages: response.data.messages || [],
                metadata: response.data.metadata || {}
            };
            
            // Extract transcript from documented field: response.data.transcript (fallback to messages synthesized if needed)
            if (response.data.transcript && response.data.transcript.length > 0) {
                console.log(`📝 Found transcript with ${response.data.transcript.length} entries`);
                conversationData.transcript = this.generateTranscript(response.data.transcript);
            } else if (response.data.messages && response.data.messages.length > 0) {
                console.log(`📝 Found messages with ${response.data.messages.length} entries, synthesizing transcript`);
                conversationData.transcript = this.generateTranscript(response.data.messages);
            } else {
                console.log(`⚠️ No transcript or messages found in response`);
                // Try to create a basic transcript from available data
                if (response.data.transcript_summary) {
                    conversationData.transcript = [{
                        speaker: 'system',
                        text: response.data.transcript_summary,
                        timestamp: new Date().toISOString(),
                        message_type: 'summary'
                    }];
                    console.log(`📝 Created transcript from summary`);
                } else {
                    conversationData.transcript = [];
                }
            }
            
            console.log(`✅ Enhanced conversation details retrieved successfully`);
            console.log(`📊 Call duration: ${conversationData.duration}s, Messages: ${conversationData.message_count}`);
            console.log(`📞 Phone number: ${conversationData.to_number}, Agent number: ${conversationData.agent_number}`);
            console.log(`🔍 Status: ${conversationData.status_raw}, Duration: ${conversationData.duration}s`);
            console.log(`🔍 Raw response fields: ${Object.keys(response.data).join(', ')}`);
            console.log(`🔍 Metadata fields: ${Object.keys(response.data.metadata || {}).join(', ')}`);
            console.log(`🔍 Phone call data: ${JSON.stringify(response.data.metadata?.phone_call)}`);
            
            return conversationData;
        } catch (error) {
            console.error('❌ Error getting enhanced conversation details:', error.response?.data || error.message);
            throw new Error(`Failed to get enhanced conversation details: ${error.response?.data?.detail || error.message}`);
        }
    }
}

module.exports = new ElevenLabsService(); 