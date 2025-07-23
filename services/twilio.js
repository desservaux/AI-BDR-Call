const twilio = require('twilio');

class TwilioService {
    constructor() {
        this.client = null;
        this.initialized = false;
    }

    /**
     * Get current environment variables (fresh each time)
     */
    getCredentials() {
        return {
            accountSid: 'ACe35419debddfa2d27efe6de4115f698c', // Hardcoded Account SID
            authToken: '220324e133d2b1c7bea779d7c51c8dbf', // Hardcoded Auth Token
            phoneNumber: process.env.TWILIO_PHONE_NUMBER
        };
    }

    /**
     * Initialize Twilio client and validate credentials
     */
    async initialize() {
        try {
            // Get fresh credentials
            const { accountSid, authToken, phoneNumber } = this.getCredentials();
            
            // Validate environment variables
            if (!accountSid || !authToken || !phoneNumber) {
                throw new Error('Missing required Twilio credentials: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
            }

            // Initialize Twilio client with fresh credentials
            this.client = twilio(accountSid, authToken);

            // Test connection by fetching account details
            const account = await this.client.api.accounts(accountSid).fetch();
            
            console.log('✅ Twilio client initialized successfully');
            console.log(`📞 Account: ${account.friendlyName} (${account.sid})`);
            console.log(`📱 Phone Number: ${phoneNumber}`);
            
            this.initialized = true;
            return true;

        } catch (error) {
            console.error('❌ Twilio initialization failed:', error.message);
            console.error('🔍 Error details:', {
                name: error.name,
                code: error.code,
                status: error.status,
                moreInfo: error.moreInfo,
                details: error.details
            });
            console.error('📋 Full error object:', JSON.stringify(error, null, 2));
            this.initialized = false;
            throw error;
        }
    }

    /**
     * Validate that client is initialized
     */
    _validateClient() {
        if (!this.initialized || !this.client) {
            throw new Error('Twilio client not initialized. Call initialize() first.');
        }
    }

    /**
     * Create outbound call with Media Streams
     * @param {string} to - Destination phone number
     * @param {string} websocketUrl - WebSocket URL for Media Streams
     * @returns {Promise<Object>} Call object
     */
    async makeCall(to, websocketUrl) {
        this._validateClient();

        try {
            // Get fresh credentials
            const { phoneNumber } = this.getCredentials();
            
            // Create TwiML for bidirectional Media Streams
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Hello! I'm your AI voice assistant. Please hold while I connect you.</Say>
    <Connect>
        <Stream url="${websocketUrl}" />
    </Connect>
</Response>`;

            // Make outbound call
            const call = await this.client.calls.create({
                to: to,
                from: phoneNumber,
                twiml: twiml,
                statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL || undefined,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                statusCallbackMethod: 'POST',
                record: false, // We'll handle recording through our AI system
                timeout: 30, // Ring timeout in seconds
                machineDetection: 'Enable', // Detect voicemail
                machineDetectionTimeout: 5
            });

            console.log(`📞 Outbound call initiated: ${call.sid}`);
            console.log(`📱 From: ${phoneNumber} → To: ${to}`);
            console.log(`🔗 WebSocket: ${websocketUrl}`);

            return {
                success: true,
                callSid: call.sid,
                from: phoneNumber,
                to: to,
                status: call.status,
                websocketUrl: websocketUrl,
                startTime: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Outbound call failed:', error.message);
            throw error;
        }
    }

    /**
     * Get call status
     * @param {string} callSid - Call SID
     * @returns {Promise<Object>} Call status
     */
    async getCallStatus(callSid) {
        this._validateClient();

        try {
            const call = await this.client.calls(callSid).fetch();
            return {
                sid: call.sid,
                status: call.status,
                from: call.from,
                to: call.to,
                startTime: call.startTime,
                endTime: call.endTime,
                duration: call.duration,
                direction: call.direction
            };
        } catch (error) {
            console.error('❌ Failed to fetch call status:', error.message);
            throw error;
        }
    }

    /**
     * Hang up a call
     * @param {string} callSid - Call SID
     * @returns {Promise<Object>} Updated call object
     */
    async hangupCall(callSid) {
        this._validateClient();

        try {
            const call = await this.client.calls(callSid).update({
                status: 'completed'
            });

            console.log(`📞 Call hung up: ${callSid}`);
            return call;
        } catch (error) {
            console.error('❌ Failed to hang up call:', error.message);
            throw error;
        }
    }

    /**
     * Test Twilio connection
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection() {
        try {
            await this.initialize();
            
            // Get fresh credentials
            const { accountSid, phoneNumber } = this.getCredentials();
            
            // Test by listing recent calls (limit 1)
            const calls = await this.client.calls.list({ limit: 1 });
            
            return {
                success: true,
                message: 'Twilio connection successful',
                accountSid: accountSid,
                phoneNumber: phoneNumber,
                recentCallsCount: calls.length
            };
        } catch (error) {
            const { accountSid, phoneNumber } = this.getCredentials();
            console.error('🔍 Twilio test connection error details:', {
                name: error.name,
                code: error.code,
                status: error.status,
                moreInfo: error.moreInfo,
                details: error.details
            });
            return {
                success: false,
                message: error.message,
                accountSid: accountSid || 'Not set',
                phoneNumber: phoneNumber || 'Not set',
                errorDetails: {
                    name: error.name,
                    code: error.code,
                    status: error.status,
                    moreInfo: error.moreInfo
                }
            };
        }
    }
}

module.exports = new TwilioService(); 