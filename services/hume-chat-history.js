const axios = require('axios');

class HumeChatHistoryService {
    constructor() {
        this.apiKey = process.env.HUME_API_KEY || 'hume1_***';
        this.baseUrl = 'https://api.hume.ai/v0/evi';
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'X-Hume-Api-Key': this.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Get chat events for a specific chat ID
     * @param {string} chatId - The chat ID from HumeAI
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of chat events
     */
    async getChatEvents(chatId, options = {}) {
        try {
            const params = {
                page_number: options.pageNumber || 0,
                page_size: options.pageSize || 100,
                ascending_order: options.ascendingOrder || false
            };

            const response = await this.client.get(`/chats/${chatId}/events`, { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching chat events:', error.message);
            throw new Error(`Failed to fetch chat events: ${error.message}`);
        }
    }

    /**
     * Get chat events for a specific chat group ID
     * @param {string} chatGroupId - The chat group ID from HumeAI
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of chat events
     */
    async getChatGroupEvents(chatGroupId, options = {}) {
        try {
            const params = {
                page_number: options.pageNumber || 0,
                page_size: options.pageSize || 100,
                ascending_order: options.ascendingOrder || false
            };

            const response = await this.client.get(`/chat_groups/${chatGroupId}/events`, { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching chat group events:', error.message);
            throw new Error(`Failed to fetch chat group events: ${error.message}`);
        }
    }

    /**
     * Get all chats (paginated)
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of chats
     */
    async getChats(options = {}) {
        try {
            const params = {
                page_number: options.pageNumber || 0,
                page_size: options.pageSize || 10,
                ascending_order: options.ascendingOrder || false
            };

            const response = await this.client.get('/chats', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching chats:', error.message);
            throw new Error(`Failed to fetch chats: ${error.message}`);
        }
    }

    /**
     * Get all chat groups (paginated)
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of chat groups
     */
    async getChatGroups(options = {}) {
        try {
            const params = {
                page_number: options.pageNumber || 0,
                page_size: options.pageSize || 10,
                ascending_order: options.ascendingOrder || false
            };

            const response = await this.client.get('/chat_groups', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching chat groups:', error.message);
            throw new Error(`Failed to fetch chat groups: ${error.message}`);
        }
    }

    /**
     * Generate transcript from chat events
     * @param {Array} chatEvents - Array of chat events from HumeAI
     * @returns {string} Formatted transcript
     */
    generateTranscript(chatEvents) {
        try {
            // Filter events for user and assistant messages
            const relevantChatEvents = chatEvents.filter(
                (chatEvent) => chatEvent.type === "USER_MESSAGE" || chatEvent.type === "AGENT_MESSAGE"
            );

            // Map each relevant event to a formatted line
            const transcriptLines = relevantChatEvents.map((chatEvent) => {
                const role = chatEvent.role === "USER" ? "User" : "Assistant";
                const timestamp = new Date(chatEvent.timestamp).toLocaleString();
                return `[${timestamp}] ${role}: ${chatEvent.messageText}`;
            });

            // Join all lines into a single transcript string
            return transcriptLines.join("\n");
        } catch (error) {
            console.error('Error generating transcript:', error.message);
            throw new Error(`Failed to generate transcript: ${error.message}`);
        }
    }

    /**
     * Extract transcription data for database storage
     * @param {Array} chatEvents - Array of chat events from HumeAI
     * @returns {Array} Array of transcription objects for database
     */
    extractTranscriptionData(chatEvents, callId) {
        try {
            const relevantChatEvents = chatEvents.filter(
                (chatEvent) => chatEvent.type === "USER_MESSAGE" || chatEvent.type === "AGENT_MESSAGE"
            );

            return relevantChatEvents.map((chatEvent) => ({
                call_id: callId,
                speaker: chatEvent.role === "USER" ? "user" : "assistant",
                message: chatEvent.messageText,
                timestamp: new Date(chatEvent.timestamp),
                event_type: chatEvent.type === "USER_MESSAGE" ? "user_message" : "assistant_message"
            }));
        } catch (error) {
            console.error('Error extracting transcription data:', error.message);
            throw new Error(`Failed to extract transcription data: ${error.message}`);
        }
    }

    /**
     * Extract event data for database storage
     * @param {Array} chatEvents - Array of chat events from HumeAI
     * @returns {Array} Array of event objects for database
     */
    extractEventData(chatEvents, callId) {
        try {
            return chatEvents.map((chatEvent) => ({
                call_id: callId,
                event_type: chatEvent.type,
                event_data: chatEvent,
                timestamp: new Date(chatEvent.timestamp)
            }));
        } catch (error) {
            console.error('Error extracting event data:', error.message);
            throw new Error(`Failed to extract event data: ${error.message}`);
        }
    }

    /**
     * Get complete conversation data for a call
     * @param {string} chatId - The chat ID
     * @param {string} callId - The call ID for database storage
     * @returns {Promise<Object>} Complete conversation data
     */
    async getConversationData(chatId, callId) {
        try {
            // Get all chat events
            const chatEvents = await this.getChatEvents(chatId, {
                pageSize: 1000, // Get all events
                ascendingOrder: true // Chronological order
            });

            // Generate transcript
            const transcript = this.generateTranscript(chatEvents);

            // Extract data for database storage
            const transcriptionData = this.extractTranscriptionData(chatEvents, callId);
            const eventData = this.extractEventData(chatEvents, callId);

            return {
                chatId,
                callId,
                transcript,
                transcriptionData,
                eventData,
                totalEvents: chatEvents.length,
                totalMessages: transcriptionData.length
            };
        } catch (error) {
            console.error('Error getting conversation data:', error.message);
            throw new Error(`Failed to get conversation data: ${error.message}`);
        }
    }

    /**
     * Test the service connection
     * @returns {Promise<boolean>} True if connection is successful
     */
    async testConnection() {
        try {
            const chats = await this.getChats({ pageSize: 1 });
            console.log('✅ HumeAI Chat History Service connection successful');
            return true;
        } catch (error) {
            console.error('❌ HumeAI Chat History Service connection failed:', error.message);
            return false;
        }
    }
}

module.exports = HumeChatHistoryService; 