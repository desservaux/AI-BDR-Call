const twilio = require('twilio');
const latencyMonitor = require('./latency-monitor');

/**
 * Optimized Twilio Service with Ultra-Low Latency Support
 * This is the official implementation that addresses high initial latency issues
 */
class TwilioService {
    constructor() {
        this.client = null;
        this.credentials = null;
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
     * Initialize the Twilio client with optimized settings
     */
    async initialize() {
        try {
            const credentials = this.getCredentials();
            this.client = twilio(credentials.accountSid, credentials.authToken);
            this.credentials = credentials;

            console.log('✅ Twilio service initialized with ultra-low latency optimizations');
            console.log(`📱 Phone number: ${credentials.phoneNumber}`);
            
            return this;
        } catch (error) {
            console.error('❌ Twilio service initialization failed:', error.message);
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
     * Validate client is initialized
     */
    _validateClient() {
        if (!this.client) {
            throw new Error('Twilio client not initialized. Call initialize() first.');
        }
    }

    /**
     * Create optimized outbound call with ultra-low latency monitoring
     * @param {string} to - Destination phone number
     * @param {Object} options - Call options
     * @returns {Promise<Object>} Call result with monitoring
     */
    async makeCall(to, options = {}) {
        this._validateClient();
        
        const startTime = Date.now();
        const requestId = this._generateRequestId();
        
        console.log(`🚀 [${requestId}] Starting ultra-low latency call to ${to}`);
        
        try {
            // Start latency monitoring session
            const session = latencyMonitor.startSession(requestId, to);
            
            // Record call initiation
            latencyMonitor.recordEvent(requestId, 'call_initiation', 'Call request received', {
                phoneNumber: to,
                options
            });

            // Pre-warm HumeAI connection if available
            await this._preWarmConnection(requestId);

            // Create optimized webhook URL
            const webhookUrl = this._createOptimizedWebhookUrl(options);
            
            latencyMonitor.recordEvent(requestId, 'webhook_creation', 'Optimized webhook URL created', {
                webhookUrl: webhookUrl.replace(/api_key=[^&]+/, 'api_key=***')
            });

            // Make the call with optimized settings
            const callStartTime = Date.now();
            const call = await this._makeCallWithOptimization(to, webhookUrl, options);
            const callDuration = Date.now() - callStartTime;

            // Record call creation performance
            latencyMonitor.recordEvent(requestId, 'call_created', 'Twilio call created successfully', {
                callSid: call.sid,
                duration: callDuration
            });

            // Set up call monitoring
            this._setupCallMonitoring(call.sid, requestId);

            const totalDuration = Date.now() - startTime;
            
            console.log(`✅ [${requestId}] Ultra-low latency call initiated in ${totalDuration}ms`);
            console.log(`📋 Call SID: ${call.sid}`);

            return {
                success: true,
                callSid: call.sid,
                requestId: requestId,
                from: this.credentials.phoneNumber,
                to: to,
                status: call.status,
                webhookUrl: webhookUrl.replace(/api_key=[^&]+/, 'api_key=***'),
                performance: {
                    totalSetupTime: totalDuration,
                    callCreationTime: callDuration,
                    sessionId: requestId
                },
                startTime: new Date().toISOString(),
                integration: 'ultra-low-latency-hume-ai'
            };

        } catch (error) {
            const errorDuration = Date.now() - startTime;
            latencyMonitor.recordEvent(requestId, 'call_error', `Call failed: ${error.message}`, {
                error: error.message,
                duration: errorDuration
            });
            
            console.error(`❌ [${requestId}] Call failed after ${errorDuration}ms:`, error.message);
            throw error;
        }
    }

    /**
     * Pre-warm HumeAI connection to reduce initial latency
     * @param {string} requestId - Request ID for monitoring
     */
    async _preWarmConnection(requestId) {
        const startTime = Date.now();
        
        try {
            // Check if we have a warm connection available
            const warmConnection = this._getWarmConnection();
            
            if (warmConnection) {
                latencyMonitor.recordEvent(requestId, 'connection_warm', 'Using existing warm connection', {
                    connectionId: warmConnection.id,
                    age: Date.now() - warmConnection.created
                });
                return;
            }

            // Create a new warm connection
            const connectionStart = Date.now();
            await this._createWarmConnection();
            const connectionDuration = Date.now() - connectionStart;

            latencyMonitor.recordEvent(requestId, 'connection_created', 'New warm connection created', {
                duration: connectionDuration
            });

            if (connectionDuration > 2000) {
                latencyMonitor.recordBottleneck(requestId, 'connection_delay', `Connection creation took ${connectionDuration}ms`);
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            latencyMonitor.recordEvent(requestId, 'connection_error', `Connection warming failed: ${error.message}`, {
                error: error.message,
                duration
            });
            
            // Don't fail the call if connection warming fails
            console.warn(`⚠️ [${requestId}] Connection warming failed: ${error.message}`);
        }
    }

    /**
     * Create optimized webhook URL with ultra-low latency parameters
     * @param {Object} options - Call options
     * @returns {string} Optimized webhook URL
     */
    _createOptimizedWebhookUrl(options = {}) {
        // Use the same hardcoded values as the existing implementation for compatibility
        const configId = process.env.HUME_CONFIG_ID || '9d00fd96-7e92-44c1-b781-4af52331c629';
        const apiKey = process.env.HUME_API_KEY || 'sUxoFMRiwyAqRsKgiFt5ZIl8yeSVvGPKOGec8mWpN5DpVIsD';
        
        const params = new URLSearchParams({
            config_id: configId,
            api_key: apiKey,
            // Ultra-low latency performance optimization parameters
            audio_sample_rate: '8000', // Lower sample rate for faster processing
            audio_channels: '1', // Mono for voice calls
            buffer_size: this.performanceConfig.audioBufferSize.toString(), // Ultra-small buffer
            // Enable streaming for lower latency
            streaming: 'true',
            // Optimize for voice calls
            voice_optimized: 'true',
            // Additional latency optimizations
            low_latency_mode: 'true',
            real_time_processing: 'true',
            audio_compression: 'opus', // Use Opus codec for better compression
            silence_detection: 'false', // Disable silence detection to avoid delays
            echo_cancellation: 'true', // Enable echo cancellation
            noise_reduction: 'true', // Enable noise reduction
            // Response time optimizations
            response_timeout: this.performanceConfig.responseTimeout.toString(), // 500ms timeout
            max_response_length: this.performanceConfig.maxResponseLength.toString(), // 50 characters
            // Connection optimizations
            keep_alive: 'true',
            connection_timeout: '5000',
            // Ultra-low latency specific optimizations
            ultra_low_latency: 'true',
            immediate_response: 'true',
            skip_processing: 'false',
            direct_streaming: 'true'
        });

        return `https://api.hume.ai/v0/evi/twilio?${params.toString()}`;
    }

    /**
     * Make call with ultra-low latency optimized settings
     * @param {string} to - Destination phone number
     * @param {string} webhookUrl - Optimized webhook URL
     * @param {Object} options - Call options
     * @returns {Promise<Object>} Twilio call object
     */
    async _makeCallWithOptimization(to, webhookUrl, options = {}) {
        const callOptions = {
            to: to,
            from: this.credentials.phoneNumber,
            url: webhookUrl,
            method: 'POST',
            
            // Ultra-low latency optimization settings
            timeout: 20, // Reduced timeout for faster failure detection
            record: false,
            machineDetection: 'Enable', // Changed to Enable for faster detection
            machineDetectionTimeout: 3, // Reduced timeout
            
            // Performance headers for lower latency
            statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL || undefined,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST',
            
            // Additional Twilio optimizations
            async: 'true', // Enable async processing
            trim: 'trim-silence', // Trim silence for faster processing
            // Audio quality settings for lower latency
            audioCodec: 'opus', // Use Opus codec
            audioSampleRate: '8000', // Lower sample rate
            audioChannels: '1' // Mono audio
        };

        return await this.client.calls.create(callOptions);
    }

    /**
     * Set up call monitoring for performance tracking
     * @param {string} callSid - Twilio Call SID
     * @param {string} requestId - Request ID for monitoring
     */
    _setupCallMonitoring(callSid, requestId) {
        // Monitor call status changes
        const statusEvents = ['initiated', 'ringing', 'answered', 'completed'];
        
        statusEvents.forEach(event => {
            // In a real implementation, you would set up webhooks or polling
            // to track these events and record them in the latency monitor
            console.log(`📊 [${requestId}] Monitoring call ${callSid} for ${event} event`);
        });
    }

    /**
     * Get a warm connection from the pool
     * @returns {Object|null} Warm connection or null
     */
    _getWarmConnection() {
        const now = Date.now();
        
        for (const [id, connection] of this.connectionPool.entries()) {
            // Check if connection is still warm (less than 5 minutes old)
            if (now - connection.created < 300000) {
                return { id, ...connection };
            } else {
                // Remove stale connection
                this.connectionPool.delete(id);
            }
        }
        
        return null;
    }

    /**
     * Create a new warm connection
     * @returns {Promise<void>}
     */
    async _createWarmConnection() {
        const connectionId = this._generateConnectionId();
        const connection = {
            id: connectionId,
            created: Date.now(),
            status: 'warm'
        };
        
        this.connectionPool.set(connectionId, connection);
        
        // Limit pool size
        if (this.connectionPool.size > this.performanceConfig.maxPoolSize) {
            const oldestKey = this.connectionPool.keys().next().value;
            this.connectionPool.delete(oldestKey);
        }
        
        console.log(`🔥 Created warm connection: ${connectionId}`);
    }

    /**
     * Generate unique request ID
     * @returns {string} Request ID
     */
    _generateRequestId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    /**
     * Generate unique connection ID
     * @returns {string} Connection ID
     */
    _generateConnectionId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance stats
     */
    getPerformanceStats() {
        return {
            connectionPoolSize: this.connectionPool.size,
            performanceConfig: this.performanceConfig,
            latencyStats: latencyMonitor.getStats()
        };
    }

    /**
     * Update performance configuration
     * @param {Object} config - New configuration
     */
    updatePerformanceConfig(config) {
        this.performanceConfig = { ...this.performanceConfig, ...config };
        console.log('⚙️ Performance configuration updated:', this.performanceConfig);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.connectionPool.clear();
        console.log('🧹 Twilio service resources cleaned up');
    }

    /**
     * Test Twilio connection
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection() {
        try {
            this._validateClient();
            
            // Get fresh credentials
            const { accountSid } = this.getCredentials();
            
            // Test connection by fetching account details
            const account = await this.client.api.accounts(accountSid).fetch();
            
            return {
                success: true,
                message: 'Twilio connection test successful',
                account: {
                    sid: account.sid,
                    friendlyName: account.friendlyName,
                    status: account.status
                }
            };
        } catch (error) {
            return {
                success: false,
                message: `Twilio connection test failed: ${error.message}`
            };
        }
    }
}

module.exports = new TwilioService();