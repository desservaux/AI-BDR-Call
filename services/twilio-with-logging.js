const twilio = require('twilio');
const CallLoggerService = require('./call-logger');
const latencyMonitor = require('./latency-monitor');

/**
 * Enhanced Twilio Service with Call Logging Integration
 * Combines ultra-low latency optimizations with comprehensive call logging
 */
class TwilioWithLoggingService {
    constructor() {
        this.client = null;
        this.credentials = null;
        this.callLogger = new CallLoggerService();
        this.connectionPool = new Map();
        
        // Ultra-low latency performance configuration
        this.performanceConfig = {
            // Aggressive audio optimization settings
            audioBufferSize: 256, // Ultra-small buffer for lower latency
            audioSampleRate: 8000, // Optimized sample rate for voice
            audioChannels: 1, // Mono audio for voice calls
            
            // Optimized connection pooling settings
            maxPoolSize: 1, // Single connection for maximum speed
            connectionTimeout: 5000, // Very short timeout for faster failure detection
            keepAliveInterval: 10000, // Frequent keep-alive
            
            // Aggressive webhook optimization
            webhookTimeout: 3000, // Very short webhook timeout
            retryAttempts: 1, // No retries for speed
            retryDelay: 100, // Very fast retry
            
            // Additional latency optimizations
            responseTimeout: 500, // 500ms response timeout
            maxResponseLength: 50, // Very short responses
            enableCompression: true, // Enable audio compression
            disableSilenceDetection: true, // Disable silence detection
            enableEchoCancellation: true, // Enable echo cancellation
            enableNoiseReduction: true // Enable noise reduction
        };
    }

    /**
     * Initialize the Twilio client with optimized settings and call logging
     */
    async initialize() {
        try {
            const credentials = this.getCredentials();
            this.client = twilio(credentials.accountSid, credentials.authToken);
            this.credentials = credentials;

            // Initialize call logger
            const loggerReady = await this.callLogger.testService();
            if (!loggerReady) {
                console.warn('⚠️ Call logger service not ready, calls will proceed without logging');
            }

            console.log('✅ Twilio service initialized with ultra-low latency optimizations and call logging');
            return true;
        } catch (error) {
            console.error('Error initializing Twilio service:', error.message);
            throw error;
        }
    }

    /**
     * Get Twilio credentials
     */
    getCredentials() {
        return {
            accountSid: process.env.TWILIO_ACCOUNT_SID || 'ACe35419debddfa2d27efe6de4115f698c',
            authToken: process.env.TWILIO_AUTH_TOKEN || 'ee9c2764dea5cf13481fec5895e2b6ed',
            phoneNumber: process.env.TWILIO_PHONE_NUMBER || '+447846855904'
        };
    }

    /**
     * Test Twilio connection
     */
    async testConnection() {
        try {
            if (!this.client) {
                await this.initialize();
            }
            
            // Test by getting account info
            const account = await this.client.api.accounts(this.credentials.accountSid).fetch();
            
            return {
                success: true,
                message: 'Twilio connection successful',
                accountSid: account.sid,
                accountStatus: account.status
            };
        } catch (error) {
            console.error('Twilio connection test failed:', error.message);
            return {
                success: false,
                message: `Twilio connection failed: ${error.message}`
            };
        }
    }

    /**
     * Generate optimized webhook URL with all performance parameters
     */
    generateWebhookUrl() {
        const baseUrl = 'https://api.hume.ai/v0/evi/twilio';
        const configId = process.env.HUME_CONFIG_ID || '9d00fd96-7e92-44c1-b781-4af52331c629';
        const apiKey = process.env.HUME_API_KEY || 'hume1_***';
        const credentials = this.getCredentials();
        
        const params = new URLSearchParams({
            config_id: configId,
            api_key: apiKey,
            // Audio optimization parameters
            audio_sample_rate: this.performanceConfig.audioSampleRate.toString(),
            audio_channels: this.performanceConfig.audioChannels.toString(),
            buffer_size: this.performanceConfig.audioBufferSize.toString(),
            streaming: 'true',
            voice_optimized: 'true',
            low_latency_mode: 'true',
            real_time_processing: 'true',
            // Audio quality parameters
            audio_compression: 'opus',
            silence_detection: 'false',
            echo_cancellation: 'true',
            noise_reduction: 'true',
            // Response optimization parameters
            response_timeout: this.performanceConfig.responseTimeout.toString(),
            max_response_length: this.performanceConfig.maxResponseLength.toString(),
            keep_alive: 'true',
            connection_timeout: this.performanceConfig.connectionTimeout.toString(),
            // Ultra-low latency parameters
            ultra_low_latency: 'true',
            immediate_response: 'true',
            skip_processing: 'false',
            direct_streaming: 'true'
        });

        return `${baseUrl}?${params.toString()}`;
    }

    /**
     * Make a call with comprehensive logging
     * @param {string} phoneNumber - The phone number to call
     * @param {string} message - Optional message for logging
     * @returns {Promise<Object>} Call result with logging information
     */
    async makeCall(phoneNumber, message = '') {
        if (!this.client) {
            await this.initialize();
        }

        const sessionId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            // Start latency monitoring
            const startTime = Date.now();
            latencyMonitor.startSession(sessionId, {
                phoneNumber,
                message,
                optimization: 'ultra-low-latency',
                performanceConfig: this.performanceConfig
            });

            console.log(`📞 Making ultra-low latency call to ${phoneNumber}...`);
            console.log(`🔧 Performance config: ${JSON.stringify(this.performanceConfig, null, 2)}`);

            // Generate optimized webhook URL
            const webhookUrl = this.generateWebhookUrl();
            console.log(`🔗 Webhook URL: ${webhookUrl.substring(0, 100)}...`);

            // Create Twilio call with optimized settings
            const credentials = this.getCredentials();
            const call = await this.client.calls.create({
                to: phoneNumber,
                from: credentials.phoneNumber,
                url: webhookUrl,
                method: 'POST',
                timeout: this.performanceConfig.webhookTimeout / 1000, // Convert to seconds
                record: false, // Disable recording for speed
                machineDetection: 'none', // Disable machine detection for speed
                statusCallback: `${process.env.BASE_URL || 'http://localhost:3000'}/webhook/call-status`,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                statusCallbackMethod: 'POST'
            });

            const setupTime = Date.now() - startTime;
            
            // Log call metrics
            latencyMonitor.recordEvent(sessionId, 'call_created', 'Call created successfully', {
                callSid: call.sid,
                setupTime: setupTime,
                status: call.status
            });

            console.log(`✅ Call created successfully!`);
            console.log(`📞 Call SID: ${call.sid}`);
            console.log(`⏱️ Setup time: ${setupTime}ms`);
            console.log(`📊 Status: ${call.status}`);

            // Start call logging (we'll get chat metadata from webhook)
            // For now, we'll create a placeholder that will be updated when we get the chat metadata
            const callLogData = {
                phoneNumber: phoneNumber,
                chatId: `pending_${call.sid}`, // Temporary ID until we get chat metadata
                chatGroupId: `pending_group_${call.sid}`,
                twilioCallSid: call.sid
            };

            // Store call for later logging when we get chat metadata
            this.storePendingCall(call.sid, callLogData);

            return {
                success: true,
                callSid: call.sid,
                status: call.status,
                setupTime: setupTime,
                sessionId: sessionId,
                optimization: 'ultra-low-latency',
                webhookUrl: webhookUrl.substring(0, 100) + '...',
                performanceConfig: this.performanceConfig
            };

        } catch (error) {
            const errorTime = Date.now();
            latencyMonitor.recordEvent(sessionId, 'call_error', `Call failed: ${error.message}`, {
                error: error.message,
                errorTime: errorTime - latencyMonitor.getSession(sessionId)?.startTime || 0
            });

            console.error('❌ Call failed:', error.message);
            throw new Error(`Call failed: ${error.message}`);
        }
    }

    /**
     * Store pending call for later logging
     */
    storePendingCall(callSid, callData) {
        if (!this.pendingCalls) {
            this.pendingCalls = new Map();
        }
        this.pendingCalls.set(callSid, callData);
        console.log(`📝 Stored pending call for logging: ${callSid}`);
    }

    /**
     * Process chat metadata from HumeAI webhook
     * @param {Object} chatMetadata - Chat metadata from HumeAI
     * @param {string} callSid - Twilio call SID
     */
    async processChatMetadata(chatMetadata, callSid) {
        try {
            console.log(`📞 Processing chat metadata for call ${callSid}:`, chatMetadata);

            // Get pending call data
            const pendingCall = this.pendingCalls?.get(callSid);
            if (!pendingCall) {
                console.warn(`⚠️ No pending call found for SID: ${callSid}`);
                return;
            }

            // Start call logging with real chat metadata
            const callLogData = {
                phoneNumber: pendingCall.phoneNumber,
                chatId: chatMetadata.chat_id,
                chatGroupId: chatMetadata.chat_group_id
            };

            const loggedCall = await this.callLogger.startCallLogging(callLogData);
            console.log(`✅ Call logging started for chat ${chatMetadata.chat_id}`);

            // Store the mapping for call completion
            this.storeChatMapping(callSid, chatMetadata.chat_id);

            // Clean up pending call
            this.pendingCalls.delete(callSid);

            return loggedCall;
        } catch (error) {
            console.error('Error processing chat metadata:', error.message);
        }
    }

    /**
     * Store chat mapping for call completion
     */
    storeChatMapping(callSid, chatId) {
        if (!this.chatMappings) {
            this.chatMappings = new Map();
        }
        this.chatMappings.set(callSid, chatId);
        console.log(`📝 Stored chat mapping: ${callSid} -> ${chatId}`);
    }

    /**
     * Handle call completion
     * @param {string} callSid - Twilio call SID
     * @param {string} status - Call completion status
     */
    async handleCallCompletion(callSid, status) {
        try {
            console.log(`📞 Handling call completion for ${callSid} with status: ${status}`);

            // Get chat ID from mapping
            const chatId = this.chatMappings?.get(callSid);
            if (!chatId) {
                console.warn(`⚠️ No chat mapping found for call SID: ${callSid}`);
                return;
            }

            // End call logging
            const finalStatus = status === 'completed' ? 'completed' : 'failed';
            const endResult = await this.callLogger.endCallLogging(chatId, finalStatus);
            console.log(`✅ Call logging completed for chat ${chatId}`);

            // Clean up mapping
            this.chatMappings.delete(callSid);

            return endResult;
        } catch (error) {
            console.error('Error handling call completion:', error.message);
        }
    }

    /**
     * Get active calls with logging information
     */
    async getActiveCallsWithLogging() {
        try {
            const activeCalls = this.callLogger.getActiveCalls();
            const stats = await this.callLogger.getCallStatistics();

            return {
                activeCalls: activeCalls,
                statistics: stats,
                pendingCalls: this.pendingCalls ? Array.from(this.pendingCalls.keys()) : [],
                chatMappings: this.chatMappings ? Array.from(this.chatMappings.entries()) : []
            };
        } catch (error) {
            console.error('Error getting active calls with logging:', error.message);
            return {
                activeCalls: [],
                statistics: { total: 0, activeCalls: 0 },
                pendingCalls: [],
                chatMappings: []
            };
        }
    }

    /**
     * Cleanup stale calls
     */
    async cleanupStaleCalls() {
        try {
            await this.callLogger.cleanupStaleCalls();
            console.log('✅ Stale call cleanup completed');
        } catch (error) {
            console.error('Error during stale call cleanup:', error.message);
        }
    }

    /**
     * Get call history with filtering
     */
    async getCallHistory(filters = {}) {
        try {
            return await this.callLogger.dbService.getCalls(filters);
        } catch (error) {
            console.error('Error getting call history:', error.message);
            return [];
        }
    }

    /**
     * Get call details
     */
    async getCallDetails(callId) {
        try {
            return await this.callLogger.dbService.getCallDetails(callId);
        } catch (error) {
            console.error('Error getting call details:', error.message);
            return null;
        }
    }

    /**
     * Export call data
     */
    async exportCallData(filters = {}) {
        try {
            return await this.callLogger.dbService.exportCallData(filters);
        } catch (error) {
            console.error('Error exporting call data:', error.message);
            return [];
        }
    }
}

module.exports = TwilioWithLoggingService; 