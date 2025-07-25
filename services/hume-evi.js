const WebSocket = require('ws');
const EventEmitter = require('events');

class HumeEVIService extends EventEmitter {
    constructor() {
        super();
        this.initialized = false;
        this.activeConnections = new Map(); // Map of callSid -> connection data
        this.stats = {
            totalConversations: 0,
            activeConversations: 0,
            totalAudioMessages: 0,
            errors: 0
        };
        this.baseUrl = 'wss://api.hume.ai/v0/evi/chat';
    }

    /**
     * Get fresh credentials from environment variables
     */
    getCredentials() {
        // Temporary hardcoded API key for testing
        const apiKey = process.env.HUME_API_KEY || 'sUxoFMRiwyAqRsKgiFt5ZIl8yeSVvGPKOGec8mWpN5DpVIsD';
        // Hardcoded custom configuration ID
        const configId = '9d00fd96-7e92-44c1-b781-4af52331c629';

        if (!apiKey) {
            throw new Error('HUME_API_KEY environment variable is required');
        }

        return {
            apiKey,
            configId: configId // Hardcoded configuration ID
        };
    }

    /**
     * Initialize the HumeAI EVI service
     */
    async initialize() {
        try {
            const { apiKey, configId } = this.getCredentials();
            
            console.log('🎭 Initializing HumeAI EVI service...');
            console.log(`🔑 API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'Not set'}`);
            console.log(`🎛️ Configuration ID: ${configId || 'Default (none specified)'}`);
            
            // Test connection to ensure credentials work
            await this.testConnection();
            
            this.initialized = true;
            console.log('✅ HumeAI EVI service initialized successfully');
            
            return {
                success: true,
                message: 'HumeAI EVI service initialized',
                config: {
                    hasConfigId: !!configId,
                    configId: configId,
                    apiKeyPresent: !!apiKey
                }
            };

        } catch (error) {
            console.error('❌ Failed to initialize HumeAI EVI service:', error.message);
            this.initialized = false;
            throw error;
        }
    }

    /**
     * Test connection to HumeAI EVI
     * @param {boolean} skipActualConnection - If true, just validate credentials without connecting
     */
    async testConnection(skipActualConnection = false) {
        try {
            const { apiKey, configId } = this.getCredentials();
            
            // For routine status checks, just validate that we have credentials
            if (skipActualConnection) {
                console.log('🔍 HumeAI EVI credentials check (no connection)');
                return { 
                    success: true, 
                    message: 'Credentials available',
                    hasApiKey: !!apiKey,
                    hasConfigId: !!configId
                };
            }
            
            return new Promise((resolve, reject) => {
                // Build WebSocket URL with authentication
                const params = new URLSearchParams();
                params.append('api_key', apiKey);
                if (configId) {
                    params.append('config_id', configId);
                }
                
                const wsUrl = `${this.baseUrl}?${params.toString()}`;
                console.log('🔗 Testing HumeAI EVI connection (creating WebSocket)...');
                
                const testWs = new WebSocket(wsUrl);
                
                const timeout = setTimeout(() => {
                    testWs.close();
                    reject(new Error('Connection test timeout'));
                }, 10000);
                
                testWs.on('open', () => {
                    console.log('✅ HumeAI EVI connection test successful');
                    clearTimeout(timeout);
                    testWs.close();
                    resolve({ success: true });
                });
                
                testWs.on('error', (error) => {
                    console.error('❌ HumeAI EVI connection test failed:', error.message);
                    clearTimeout(timeout);
                    reject(error);
                });
                
                testWs.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        console.log('📨 HumeAI EVI test message received:', message.type);
                        
                        // If we receive chat_metadata, the connection is working
                        if (message.type === 'chat_metadata') {
                            console.log('✅ HumeAI EVI authentication successful');
                            clearTimeout(timeout);
                            testWs.close();
                            resolve({ success: true, chatId: message.chat_id });
                        }
                    } catch (err) {
                        console.log('📨 HumeAI EVI raw message:', data.toString());
                    }
                });
            });
            
        } catch (error) {
            return Promise.reject(error);
        }
    }

    /**
     * Start a conversation with HumeAI EVI
     */
    async startConversation(callSid, onAudioData, onTranscript, onError) {
        try {
            const { apiKey, configId } = this.getCredentials();
            
            if (!this.initialized) {
                throw new Error('HumeAI EVI service not initialized');
            }

            console.log(`🎭 Starting HumeAI EVI conversation for call ${callSid}`);
            if (configId) {
                console.log(`🎛️ Using custom Hume configuration: ${configId}`);
            } else {
                console.log(`📝 Using default Hume configuration (no custom config set)`);
            }
            
            // Build WebSocket URL with authentication
            const params = new URLSearchParams();
            params.append('api_key', apiKey);
            if (configId) {
                params.append('config_id', configId);
            }
            // Enable verbose transcription for better interruption handling
            params.append('verbose_transcription', 'true');
            
            const wsUrl = `${this.baseUrl}?${params.toString()}`;
            console.log(`🔗 WebSocket URL: ${this.baseUrl}?api_key=***&${configId ? `config_id=${configId}&` : ''}verbose_transcription=true`);
            const ws = new WebSocket(wsUrl);

            // Store connection data
            const connectionData = {
                ws: ws,
                callSid: callSid,
                startTime: Date.now(),
                audioInputCount: 0,
                audioOutputCount: 0,
                transcriptCount: 0,
                isActive: true,
                chatId: null,
                chatGroupId: null,
                configId: configId // Store config ID for reference
            };

            this.activeConnections.set(callSid, connectionData);

            // Handle WebSocket events
            ws.on('open', () => {
                const configMsg = configId ? ` with custom config ${configId}` : ' with default configuration';
                console.log(`✅ HumeAI EVI conversation started for call ${callSid}${configMsg}`);
                this.stats.totalConversations++;
                this.stats.activeConversations++;
            });

            ws.on('message', (data) => {
                this.handleMessage(callSid, data, onAudioData, onTranscript, onError);
            });

            ws.on('error', (error) => {
                console.error(`❌ HumeAI EVI WebSocket error for call ${callSid}:`, error);
                this.stats.errors++;
                if (onError) {
                    onError(error);
                }
                this.endConversation(callSid);
            });

            ws.on('close', () => {
                console.log(`🔚 HumeAI EVI conversation ended for call ${callSid}`);
                this.endConversation(callSid);
            });

            return {
                success: true,
                callSid: callSid,
                connectionData: connectionData
            };

        } catch (error) {
            console.error('❌ Error starting HumeAI EVI conversation:', error);
            throw error;
        }
    }

    /**
     * Handle incoming WebSocket messages from HumeAI EVI
     */
    handleMessage(callSid, data, onAudioData, onTranscript, onError) {
        try {
            const message = JSON.parse(data);
            const connection = this.activeConnections.get(callSid);
            
            if (!connection) {
                console.warn(`⚠️ Received message for unknown call: ${callSid}`);
                return;
            }

            switch (message.type) {
                case 'chat_metadata':
                    console.log(`🆔 HumeAI EVI chat metadata for ${callSid}:`, {
                        chatId: message.chat_id,
                        chatGroupId: message.chat_group_id
                    });
                    connection.chatId = message.chat_id;
                    connection.chatGroupId = message.chat_group_id;
                    break;

                case 'audio_output':
                    // Forward audio data to the caller (base64-encoded WAV)
                    if (onAudioData) {
                        onAudioData(message.data);
                    }
                    connection.audioOutputCount++;
                    this.stats.totalAudioMessages++;
                    break;

                case 'user_message':
                    console.log(`👤 User transcript (${callSid}): "${message.message.content}"`);
                    if (onTranscript) {
                        onTranscript({
                            type: 'user',
                            content: message.message.content,
                            interim: message.interim || false,
                            emotions: message.models?.prosody?.scores || {}
                        });
                    }
                    connection.transcriptCount++;
                    break;

                case 'assistant_message':
                    console.log(`🎭 Assistant response (${callSid}): "${message.message.content}"`);
                    if (onTranscript) {
                        onTranscript({
                            type: 'assistant',
                            content: message.message.content,
                            emotions: message.models?.prosody?.scores || {}
                        });
                    }
                    break;

                case 'user_interruption':
                    console.log(`⚡ User interruption detected for call ${callSid}`);
                    // EVI will handle the interruption automatically
                    break;

                case 'assistant_end':
                    console.log(`✅ Assistant response complete for call ${callSid}`);
                    break;

                case 'error':
                    console.error(`❌ HumeAI EVI error for call ${callSid}:`, message);
                    this.stats.errors++;
                    if (onError) {
                        onError(new Error(message.message || 'HumeAI EVI error'));
                    }
                    break;

                default:
                    console.log(`📨 HumeAI EVI message (${callSid}):`, message.type);
            }

        } catch (error) {
            console.error('❌ Error parsing HumeAI EVI message:', error);
            if (onError) {
                onError(error);
            }
        }
    }

    /**
     * Send audio data to HumeAI EVI (base64-encoded)
     */
    async sendAudio(callSid, audioData) {
        try {
            const connection = this.activeConnections.get(callSid);
            if (!connection || !connection.isActive) {
                throw new Error(`No active HumeAI EVI connection for call ${callSid}`);
            }

            if (connection.ws.readyState !== WebSocket.OPEN) {
                throw new Error(`HumeAI EVI WebSocket not ready for call ${callSid}`);
            }

            // Send audio input message
            const message = {
                type: 'audio_input',
                data: audioData // Base64-encoded audio data
            };

            connection.ws.send(JSON.stringify(message));
            connection.audioInputCount++;

            return { success: true };

        } catch (error) {
            console.error('❌ Error sending audio to HumeAI EVI:', error);
            throw error;
        }
    }

    /**
     * Send text input to HumeAI EVI (for testing or fallback)
     */
    async sendText(callSid, text) {
        try {
            const connection = this.activeConnections.get(callSid);
            if (!connection || !connection.isActive) {
                throw new Error(`No active HumeAI EVI connection for call ${callSid}`);
            }

            if (connection.ws.readyState !== WebSocket.OPEN) {
                throw new Error(`HumeAI EVI WebSocket not ready for call ${callSid}`);
            }

            // Send user input message
            const message = {
                type: 'user_input',
                text: text
            };

            connection.ws.send(JSON.stringify(message));

            return { success: true };

        } catch (error) {
            console.error('❌ Error sending text to HumeAI EVI:', error);
            throw error;
        }
    }

    /**
     * End a conversation
     */
    endConversation(callSid) {
        const connection = this.activeConnections.get(callSid);
        if (connection) {
            console.log(`🔚 Ending HumeAI EVI conversation for call ${callSid}`);
            
            if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
                connection.ws.close();
            }
            
            connection.isActive = false;
            this.stats.activeConversations--;
            this.activeConnections.delete(callSid);
        }
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            ...this.stats,
            activeConnections: this.activeConnections.size,
            initialized: this.initialized
        };
    }

    /**
     * Get active connection info
     */
    getConnectionInfo(callSid) {
        const connection = this.activeConnections.get(callSid);
        if (!connection) {
            return null;
        }

        return {
            callSid: connection.callSid,
            startTime: connection.startTime,
            duration: Date.now() - connection.startTime,
            audioInputCount: connection.audioInputCount,
            audioOutputCount: connection.audioOutputCount,
            transcriptCount: connection.transcriptCount,
            isActive: connection.isActive,
            chatId: connection.chatId,
            chatGroupId: connection.chatGroupId
        };
    }
}

module.exports = new HumeEVIService(); 