const elevenLabsService = require('./elevenlabs');
const SupabaseDBService = require('./supabase-db');

class CallLoggerService {
    constructor() {
        this.elevenLabsService = elevenLabsService; // Use the exported instance
        this.dbService = new SupabaseDBService();
        this.activeCalls = new Map(); // Track active calls
        this.callEventQueue = new Map(); // Queue events for processing
    }

    /**
     * Start logging a new call
     * @param {Object} callData - Call data from ElevenLabs
     * @returns {Promise<Object>} Created call record
     */
    async startCallLogging(callData) {
        try {
            console.log(`📞 Starting call logging for: ${callData.phoneNumber}`);
            
            // Create call record in database
            const dbCallData = {
                phoneNumber: callData.phoneNumber,
                elevenlabs_conversation_id: callData.conversationId,
                status: 'active'
            };

            const createdCall = await this.dbService.createCall(dbCallData);
            
            // Track active call
            this.activeCalls.set(callData.conversationId, {
                callId: createdCall.id,
                phoneNumber: callData.phoneNumber,
                conversationId: callData.conversationId,
                callSid: callData.callSid,
                startTime: new Date(),
                events: []
            });

            // Initialize event queue for this call
            this.callEventQueue.set(callData.conversationId, []);

            console.log(`✅ Call logging started for call ID: ${createdCall.id}`);
            return createdCall;
        } catch (error) {
            console.error('Error starting call logging:', error.message);
            throw new Error(`Failed to start call logging: ${error.message}`);
        }
    }

    /**
     * End call logging and process final data
     * @param {string} conversationId - Conversation ID from ElevenLabs
     * @param {string} status - Final call status (completed, failed)
     * @returns {Promise<Object>} Final call data with transcriptions
     */
    async endCallLogging(conversationId, status = 'completed') {
        try {
            console.log(`📞 Ending call logging for conversation ID: ${conversationId}`);
            
            const activeCall = this.activeCalls.get(conversationId);
            if (!activeCall) {
                throw new Error(`No active call found for conversation ID: ${conversationId}`);
            }

            // Update call status in database
            await this.dbService.updateCallStatus(activeCall.callId, status);

            // Process conversation data from ElevenLabs
            console.log('📝 Processing conversation data from ElevenLabs...');
            const conversationData = await this.elevenLabsService.getConversationDetails(conversationId);

            // Store transcriptions in database
            if (conversationData.transcript && conversationData.transcript.length > 0) {
                const transcriptionData = conversationData.transcript.map(message => ({
                    call_id: activeCall.callId,
                    speaker: message.speaker,
                    message: message.text,
                    timestamp: message.timestamp,
                    event_type: message.message_type
                }));
                
                await this.dbService.insertTranscriptions(transcriptionData);
                console.log(`✅ Stored ${transcriptionData.length} transcription records`);
            }

            // Store events in database (ElevenLabs doesn't provide separate events, so we store messages as events)
            if (conversationData.messages && conversationData.messages.length > 0) {
                const eventData = conversationData.messages.map(message => ({
                    call_id: activeCall.callId,
                    event_type: message.message_type || 'message',
                    event_data: JSON.stringify(message),
                    timestamp: message.timestamp || new Date().toISOString()
                }));
                
                await this.dbService.insertEvents(eventData);
                console.log(`✅ Stored ${eventData.length} event records`);
            }

            // Clean up tracking
            this.activeCalls.delete(conversationId);
            this.callEventQueue.delete(conversationId);

            console.log(`✅ Call logging completed for call ID: ${activeCall.callId}`);
            
            return {
                callId: activeCall.callId,
                conversationId: conversationId,
                status: status,
                totalEvents: conversationData.messages?.length || 0,
                totalMessages: conversationData.total_messages || 0,
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
            
            // Test ElevenLabs service connection
            const elevenLabsTest = await this.elevenLabsService.testConnection();
            const dbTest = await this.dbService.testConnection();
            
            if (elevenLabsTest.success && dbTest) {
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