const WebSocket = require('ws');
const axios = require('axios');

class PlayAIAgentService {
    constructor() {
        this.initialized = false;
        this.activeConnections = new Map();
        this.stats = {
            totalConversations: 0,
            activeConversations: 0,
            averageResponseTime: 0,
            errors: 0
        };
    }

    /**
     * Get current environment variables (fresh each time)
     */
    getCredentials() {
        return {
            apiKey: process.env.PLAYAI_API_KEY, // Changed from PLAYHT_API_KEY
            userId: process.env.PLAYAI_USER_ID, // Changed from PLAYHT_USER_ID
            agentId: 'test-mdr-aXex862DOJlPqn8mDKGML' // Your agent ID
        };
    }

    /**
     * Initialize the Play.ai Agent service
     */
    async initialize() {
        try {
            const { apiKey, userId, agentId } = this.getCredentials();
            
            if (!apiKey || !userId) {
                throw new Error('Play.ai API credentials not configured. Please set PLAYAI_API_KEY and PLAYAI_USER_ID environment variables.');
            }

            console.log('🤖 Initializing Play.ai Agent service...');
            console.log(`📋 Agent ID: ${agentId}`);
            console.log(`👤 User ID: ${userId ? userId.substring(0, 10) + '...' : 'Not set'}`);
            
            // Test connection with agent using correct endpoint
            const testResult = await this.testConnection();
            if (!testResult.success) {
                throw new Error(`Agent connection failed: ${testResult.message}`);
            }

            this.initialized = true;
            console.log('✅ Play.ai Agent service initialized successfully');
            
        } catch (error) {
            console.error('❌ Play.ai Agent initialization failed:', error.message);
            console.error('🔍 Error details:', {
                name: error.name,
                code: error.code,
                status: error.status,
                moreInfo: error.moreInfo,
                details: error.details
            });
            console.error('💡 Tip: Get your API key from https://play.ai/developers');
            this.initialized = false;
            throw error;
        }
    }

    /**
     * Test connection to Play.ai Agent using correct API endpoint
     */
    async testConnection() {
        try {
            const { apiKey, userId, agentId } = this.getCredentials();
            
            console.log('🔍 Testing Play.ai Agent connection...');
            
            // Use correct API endpoint from documentation
            const response = await axios.get(`https://api.play.ai/api/v1/agents/${agentId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-USER-ID': userId,
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                message: 'Agent connection successful',
                agentId: agentId,
                agentName: response.data.displayName || 'Unknown',
                agentData: response.data
            };

        } catch (error) {
            console.error('🔍 Play.ai Agent test connection error details:', {
                name: error.name,
                code: error.code,
                status: error.status,
                response: error.response?.data,
                message: error.message
            });
            
            return {
                success: false,
                message: error.message,
                agentId: this.getCredentials().agentId || 'Not set',
                errorDetails: {
                    name: error.name,
                    code: error.code,
                    status: error.status,
                    response: error.response?.data
                },
                troubleshooting: {
                    apiKeyRequired: 'Get API key from https://play.ai/developers',
                    userIdRequired: 'Get User ID from Play.ai dashboard',
                    agentIdFormat: 'Use agent ID from web interface (e.g., f0gZrOKBKL7veJ6o1M)'
                }
            };
        }
    }

    /**
     * Start a conversation with the AI Agent using WebSocket
     */
    async startConversation(callSid, onAudioData, onError) {
        try {
            const { apiKey, userId, agentId } = this.getCredentials();
            
            if (!this.initialized) {
                throw new Error('Play.ai Agent service not initialized');
            }

            console.log(`🎙️ Starting conversation with agent ${agentId} for call ${callSid}`);
            
            // Use correct WebSocket endpoint from documentation
            const wsUrl = `wss://api.play.ai/v1/talk/${agentId}`;
            const ws = new WebSocket(wsUrl, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-USER-ID': userId
                }
            });

            // Store connection
            this.activeConnections.set(callSid, {
                ws: ws,
                agentId: agentId,
                startTime: Date.now(),
                audioChunks: 0
            });

            // Handle WebSocket events
            ws.on('open', () => {
                console.log(`✅ Agent conversation started for call ${callSid}`);
                this.stats.totalConversations++;
                this.stats.activeConversations++;
                
                // Send setup message with API key as per documentation
                ws.send(JSON.stringify({
                    type: 'setup',
                    apiKey: apiKey
                }));
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    
                    switch (message.type) {
                        case 'audio':
                            // Forward audio data to Twilio (base64-encoded)
                            if (onAudioData) {
                                onAudioData(message.audio);
                            }
                            this.activeConnections.get(callSid).audioChunks++;
                            break;
                            
                        case 'transcript':
                            console.log(`📝 Agent transcript: ${message.text}`);
                            break;
                            
                        case 'error':
                            console.error(`❌ Agent error: ${message.error}`);
                            if (onError) {
                                onError(new Error(message.error));
                            }
                            break;
                            
                        case 'setup_complete':
                            console.log(`🔧 Agent setup complete for call ${callSid}`);
                            break;
                    }
                } catch (err) {
                    console.error('Error parsing agent message:', err);
                }
            });

            ws.on('error', (error) => {
                console.error(`❌ Agent WebSocket error for call ${callSid}:`, error);
                if (onError) {
                    onError(error);
                }
            });

            ws.on('close', () => {
                console.log(`🔚 Agent conversation ended for call ${callSid}`);
                this.stats.activeConversations--;
                this.activeConnections.delete(callSid);
            });

            return {
                success: true,
                connectionId: callSid,
                agentId: agentId
            };

        } catch (error) {
            console.error('Error starting agent conversation:', error);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Send audio data to the agent (base64-encoded)
     */
    async sendAudio(callSid, audioData) {
        try {
            const connection = this.activeConnections.get(callSid);
            if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
                throw new Error('No active agent connection for this call');
            }

            // Send audio as base64-encoded string per documentation
            connection.ws.send(JSON.stringify({
                type: 'audio',
                audio: audioData // Should be base64-encoded audio
            }));

            return { success: true };

        } catch (error) {
            console.error('Error sending audio to agent:', error);
            throw error;
        }
    }

    /**
     * End conversation with the agent
     */
    async endConversation(callSid) {
        try {
            const connection = this.activeConnections.get(callSid);
            if (connection) {
                console.log(`🔚 Ending agent conversation for call ${callSid}`);
                
                // Calculate response time
                const duration = Date.now() - connection.startTime;
                this.stats.averageResponseTime = 
                    (this.stats.averageResponseTime + duration) / 2;
                
                // Close WebSocket
                if (connection.ws.readyState === WebSocket.OPEN) {
                    connection.ws.send(JSON.stringify({ type: 'end' }));
                    connection.ws.close();
                }
                
                this.activeConnections.delete(callSid);
                this.stats.activeConversations--;
            }

            return { success: true };

        } catch (error) {
            console.error('Error ending agent conversation:', error);
            throw error;
        }
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            ...this.stats,
            activeConnections: this.activeConnections.size,
            initialized: this.initialized,
            agentId: this.getCredentials().agentId,
            service: 'Play.ai Agent API',
            websocketEndpoint: `wss://api.play.ai/v1/talk/${this.getCredentials().agentId}`,
            apiDocumentation: 'https://play.ai/developers'
        };
    }
}

module.exports = PlayAIAgentService; 