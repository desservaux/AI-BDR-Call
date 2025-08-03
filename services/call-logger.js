const HumeChatHistoryService = require('./hume-chat-history');
const SupabaseDBService = require('./supabase-db');

class CallLoggerService {
    constructor() {
        this.humeService = new HumeChatHistoryService();
        this.dbService = new SupabaseDBService();
        this.activeCalls = new Map(); // Track active calls
        this.callEventQueue = new Map(); // Queue events for processing
    }

    /**
     * Start logging a new call
     * @param {Object} callData - Call data from Twilio
     * @returns {Promise<Object>} Created call record
     */
    async startCallLogging(callData) {
        try {
            console.log(`📞 Starting call logging for: ${callData.phoneNumber}`);
            
            // Create call record in database
            const dbCallData = {
                phoneNumber: callData.phoneNumber,
                chatId: callData.chatId,
                chatGroupId: callData.chatGroupId,
                status: 'active'
            };

            const createdCall = await this.dbService.createCall(dbCallData);
            
            // Track active call
            this.activeCalls.set(callData.chatId, {
                callId: createdCall.id,
                phoneNumber: callData.phoneNumber,
                chatId: callData.chatId,
                chatGroupId: callData.chatGroupId,
                startTime: new Date(),
                events: []
            });

            // Initialize event queue for this call
            this.callEventQueue.set(callData.chatId, []);

            console.log(`✅ Call logging started for call ID: ${createdCall.id}`);
            return createdCall;
        } catch (error) {
            console.error('Error starting call logging:', error.message);
            throw new Error(`Failed to start call logging: ${error.message}`);
        }
    }

    /**
     * End call logging and process final data
     * @param {string} chatId - Chat ID from HumeAI
     * @param {string} status - Final call status (completed, failed)
     * @returns {Promise<Object>} Final call data with transcriptions
     */
    async endCallLogging(chatId, status = 'completed') {
        try {
            console.log(`📞 Ending call logging for chat ID: ${chatId}`);
            
            const activeCall = this.activeCalls.get(chatId);
            if (!activeCall) {
                throw new Error(`No active call found for chat ID: ${chatId}`);
            }

            // Update call status in database
            await this.dbService.updateCallStatus(activeCall.callId, status);

            // Process conversation data from HumeAI
            console.log('📝 Processing conversation data from HumeAI...');
            const conversationData = await this.humeService.getConversationData(chatId, activeCall.callId);

            // Store transcriptions in database
            if (conversationData.transcriptionData.length > 0) {
                await this.dbService.insertTranscriptions(conversationData.transcriptionData);
                console.log(`✅ Stored ${conversationData.transcriptionData.length} transcription records`);
            }

            // Store events in database
            if (conversationData.eventData.length > 0) {
                await this.dbService.insertEvents(conversationData.eventData);
                console.log(`✅ Stored ${conversationData.eventData.length} event records`);
            }

            // Clean up tracking
            this.activeCalls.delete(chatId);
            this.callEventQueue.delete(chatId);

            console.log(`✅ Call logging completed for call ID: ${activeCall.callId}`);
            
            return {
                callId: activeCall.callId,
                chatId: chatId,
                status: status,
                totalEvents: conversationData.totalEvents,
                totalMessages: conversationData.totalMessages,
                transcript: conversationData.transcript
            };
        } catch (error) {
            console.error('Error ending call logging:', error.message);
            throw new Error(`Failed to end call logging: ${error.message}`);
        }
    }

    /**
     * Log a real-time event (for future real-time implementation)
     * @param {string} chatId - Chat ID
     * @param {Object} eventData - Event data
     */
    async logRealTimeEvent(chatId, eventData) {
        try {
            const activeCall = this.activeCalls.get(chatId);
            if (!activeCall) {
                console.warn(`No active call found for chat ID: ${chatId}`);
                return;
            }

            // Add to event queue
            const eventQueue = this.callEventQueue.get(chatId) || [];
            eventQueue.push({
                timestamp: new Date(),
                eventData: eventData
            });
            this.callEventQueue.set(chatId, eventQueue);

            // Store event in active call tracking
            activeCall.events.push(eventData);

            console.log(`📝 Logged real-time event for call: ${activeCall.callId}`);
        } catch (error) {
            console.error('Error logging real-time event:', error.message);
        }
    }

    /**
     * Get active calls
     * @returns {Array} List of active calls
     */
    getActiveCalls() {
        return Array.from(this.activeCalls.values());
    }

    /**
     * Get call status
     * @param {string} chatId - Chat ID
     * @returns {Object|null} Call status or null if not found
     */
    getCallStatus(chatId) {
        const activeCall = this.activeCalls.get(chatId);
        if (!activeCall) {
            return null;
        }

        return {
            callId: activeCall.callId,
            phoneNumber: activeCall.phoneNumber,
            chatId: activeCall.chatId,
            startTime: activeCall.startTime,
            duration: Date.now() - activeCall.startTime.getTime(),
            eventCount: activeCall.events.length,
            status: 'active'
        };
    }

    /**
     * Process call with chat metadata (from webhook)
     * @param {Object} chatMetadata - Chat metadata from HumeAI webhook
     * @param {string} phoneNumber - Phone number for the call
     * @returns {Promise<Object>} Created call record
     */
    async processCallWithChatMetadata(chatMetadata, phoneNumber) {
        try {
            console.log('📞 Processing call with chat metadata:', chatMetadata);
            
            const callData = {
                phoneNumber: phoneNumber,
                chatId: chatMetadata.chat_id,
                chatGroupId: chatMetadata.chat_group_id
            };

            return await this.startCallLogging(callData);
        } catch (error) {
            console.error('Error processing call with chat metadata:', error.message);
            throw error;
        }
    }

    /**
     * Clean up stale calls (calls that have been active too long)
     * @param {number} maxDurationMs - Maximum duration in milliseconds (default: 30 minutes)
     */
    async cleanupStaleCalls(maxDurationMs = 30 * 60 * 1000) {
        try {
            const now = Date.now();
            const staleCalls = [];

            for (const [chatId, activeCall] of this.activeCalls.entries()) {
                const duration = now - activeCall.startTime.getTime();
                if (duration > maxDurationMs) {
                    staleCalls.push({ chatId, activeCall });
                }
            }

            for (const { chatId, activeCall } of staleCalls) {
                console.log(`🧹 Cleaning up stale call: ${activeCall.callId}`);
                try {
                    await this.endCallLogging(chatId, 'failed');
                } catch (error) {
                    console.error(`Error cleaning up stale call ${activeCall.callId}:`, error.message);
                    // Force cleanup even if ending fails
                    this.activeCalls.delete(chatId);
                    this.callEventQueue.delete(chatId);
                }
            }

            if (staleCalls.length > 0) {
                console.log(`✅ Cleaned up ${staleCalls.length} stale calls`);
            }
        } catch (error) {
            console.error('Error during stale call cleanup:', error.message);
        }
    }

    /**
     * Get call statistics
     * @returns {Promise<Object>} Call statistics
     */
    async getCallStatistics() {
        try {
            const dbStats = await this.dbService.getCallStatistics();
            const activeCallCount = this.activeCalls.size;

            return {
                ...dbStats,
                activeCalls: activeCallCount,
                totalWithActive: dbStats.total + activeCallCount
            };
        } catch (error) {
            console.error('Error getting call statistics:', error.message);
            throw error;
        }
    }

    /**
     * Test the service
     * @returns {Promise<boolean>} True if service is working
     */
    async testService() {
        try {
            console.log('🧪 Testing Call Logger Service...');
            
            const humeTest = await this.humeService.testConnection();
            const dbTest = await this.dbService.testConnection();
            
            if (humeTest && dbTest) {
                console.log('✅ Call Logger Service is ready');
                return true;
            } else {
                console.log('❌ Call Logger Service has connection issues');
                return false;
            }
        } catch (error) {
            console.error('❌ Call Logger Service test failed:', error.message);
            return false;
        }
    }
}

module.exports = CallLoggerService; 