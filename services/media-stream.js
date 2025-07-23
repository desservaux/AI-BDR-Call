const WebSocket = require('ws');
const aiConversationService = require('./ai-conversation');

class MediaStreamHandler {
    constructor() {
        this.activeCalls = new Map();
        this.audioBuffer = new Map(); // Buffer for audio processing
    }

    /**
     * Handle incoming WebSocket connection from Twilio Media Streams
     * @param {WebSocket} ws - WebSocket connection
     * @param {Request} req - HTTP request
     */
    handleConnection(ws, req) {
        console.log('📞 New Media Stream connection established');
        
        const callData = {
            streamSid: null,
            callSid: null,
            accountSid: null,
            tracks: [],
            startTime: new Date(),
            isActive: true
        };

        // Handle incoming messages from Twilio
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                await this.processMessage(ws, data, callData);
            } catch (error) {
                console.error('❌ Error processing message:', error);
            }
        });

        // Handle WebSocket close
        ws.on('close', () => {
            console.log('📞 Media Stream connection closed');
            if (callData.streamSid) {
                this.activeCalls.delete(callData.streamSid);
            }
        });

        // Handle WebSocket errors
        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
            if (callData.streamSid) {
                this.activeCalls.delete(callData.streamSid);
            }
        });
    }

    /**
     * Process incoming message from Twilio Media Stream
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} data - Message data
     * @param {Object} callData - Call metadata
     */
    async processMessage(ws, data, callData) {
        switch (data.event) {
            case 'connected':
                console.log('🔗 Media Stream connected');
                this.handleConnected(ws, data, callData);
                break;

            case 'start':
                console.log('🎬 Media Stream started');
                await this.handleStart(ws, data, callData);
                break;

            case 'media':
                this.handleMedia(ws, data, callData);
                break;

            case 'dtmf':
                console.log('🔢 DTMF received:', data.dtmf);
                await this.handleDTMF(ws, data, callData);
                break;

            case 'stop':
                console.log('🛑 Media Stream stopped');
                await this.handleStop(ws, data, callData);
                break;

            default:
                console.log('📨 Unknown event:', data.event);
        }
    }

    /**
     * Handle connected event
     */
    handleConnected(ws, data, callData) {
        console.log('✅ Media Stream connected:', data.protocol, data.version);
        
        // Send a welcome message
        this.sendAudioMessage(ws, "Hello! I'm your AI voice assistant. How can I help you today?");
    }

    /**
     * Handle start event
     */
    async handleStart(ws, data, callData) {
        callData.streamSid = data.streamSid;
        callData.callSid = data.start.callSid;
        callData.accountSid = data.start.accountSid;
        callData.tracks = data.start.tracks;
        callData.ws = ws; // Store WebSocket reference

        console.log(`🎬 Stream started - CallSid: ${callData.callSid}, StreamSid: ${callData.streamSid}`);
        
        // Store active call
        this.activeCalls.set(callData.streamSid, callData);
        
        // Log audio configuration
        console.log('🔊 Audio config:', {
            inbound: data.start.tracks.inbound,
            outbound: data.start.tracks.outbound
        });

        try {
            // Start AI conversation
            const conversation = await aiConversationService.startConversation(
                callData.callSid,
                callData.streamSid
            );
            
            callData.conversationId = conversation.id;
            
            console.log(`🤖 AI Conversation linked to call: ${callData.conversationId}`);
            
            // Audio will be handled by HumeAI integration
            
        } catch (error) {
            console.error('❌ Failed to start AI conversation:', error);
            // Continue with basic call handling
        }
    }

    /**
     * Handle media (audio) event
     */
    async handleMedia(ws, data, callData) {
        // Log audio data reception (don't log actual content to avoid spam)
        if (Math.random() < 0.01) { // Log 1% of media packets to avoid spam
            console.log(`🎵 Audio received - Track: ${data.track}, Payload size: ${data.payload.length}`);
        }

        // Only process inbound audio (from caller)
        if (data.track === 'inbound') {
            await this.processInboundAudio(ws, data, callData);
        }
        
        // Store audio data for processing
        this.processAudioData(ws, data, callData);
    }

    /**
     * Handle DTMF event
     */
    async handleDTMF(ws, data, callData) {
        const digit = data.dtmf.digit;
        console.log(`🔢 DTMF pressed: ${digit}`);
        
        // Forward DTMF to AI conversation if available
        if (callData.conversationId) {
            try {
                await aiConversationService.handleDTMF(callData.conversationId, digit);
            } catch (error) {
                console.error('❌ Error handling DTMF in conversation:', error);
                // Fallback to basic handling
                this.handleBasicDTMF(ws, digit);
            }
        } else {
            // Basic DTMF handling if no conversation
            this.handleBasicDTMF(ws, digit);
        }
    }

    /**
     * Handle basic DTMF without AI conversation
     */
    handleBasicDTMF(ws, digit) {
        console.log(`🔢 Basic DTMF handling: ${digit}`);
        // For now, just acknowledge the DTMF
        // In a full implementation, this would send audio back to Twilio
    }

    /**
     * Handle stop event
     */
    async handleStop(ws, data, callData) {
        console.log('🛑 Media Stream stopped');
        callData.isActive = false;
        
        // End AI conversation if active
        if (callData.conversationId) {
            try {
                await aiConversationService.endConversation(callData.conversationId, 'call_ended');
            } catch (error) {
                console.error('❌ Error ending conversation:', error);
            }
        }
        
        // Clean up audio buffer
        if (callData.streamSid) {
            this.audioBuffer.delete(callData.streamSid);
            this.activeCalls.delete(callData.streamSid);
        }
    }

    /**
     * Process audio data (placeholder for AI integration)
     */
    processAudioData(ws, data, callData) {
        // Decode µ-law audio data
        const audioBuffer = Buffer.from(data.payload, 'base64');
        
        // TODO: Convert µ-law to PCM
        // TODO: Send to Speech-to-Text service
        // TODO: Process with AI conversation logic
        // TODO: Generate response with Play.ht
        
        // For now, just store some basic stats
        if (!callData.audioStats) {
            callData.audioStats = {
                packetsReceived: 0,
                totalBytes: 0,
                lastPacketTime: new Date()
            };
        }
        
        callData.audioStats.packetsReceived++;
        callData.audioStats.totalBytes += audioBuffer.length;
        callData.audioStats.lastPacketTime = new Date();
    }

    /**
     * Process inbound audio from caller
     */
    async processInboundAudio(ws, data, callData) {
        // Buffer audio for speech-to-text processing
        if (!this.audioBuffer.has(callData.streamSid)) {
            this.audioBuffer.set(callData.streamSid, {
                chunks: [],
                lastProcessed: Date.now(),
                processing: false
            });
        }

        const buffer = this.audioBuffer.get(callData.streamSid);
        buffer.chunks.push({
            payload: data.payload,
            timestamp: Date.now(),
            sequence: data.sequence
        });

        // Process audio chunks periodically (every 2 seconds or 100 chunks)
        const timeSinceLastProcess = Date.now() - buffer.lastProcessed;
        if (!buffer.processing && (timeSinceLastProcess > 2000 || buffer.chunks.length > 100)) {
            buffer.processing = true;
            buffer.lastProcessed = Date.now();
            
            try {
                await this.processAudioChunks(callData, buffer.chunks);
                buffer.chunks = []; // Clear processed chunks
            } catch (error) {
                console.error('❌ Error processing audio chunks:', error);
            } finally {
                buffer.processing = false;
            }
        }
    }

    /**
     * Process accumulated audio chunks (simulated speech-to-text)
     */
    async processAudioChunks(callData, chunks) {
        if (!callData.conversationId || chunks.length === 0) {
            return;
        }

        // Simulate speech-to-text processing
        // In a real implementation, this would:
        // 1. Decode µ-law audio to PCM
        // 2. Send to speech-to-text service (e.g., Google, Azure, AWS)
        // 3. Get transcribed text
        // 4. Send to AI conversation service

        // For POC, simulate some common phrases based on audio presence
        const totalAudioSize = chunks.reduce((sum, chunk) => sum + chunk.payload.length, 0);
        
        if (totalAudioSize > 1000) { // Simulate detecting speech
            // Simulate different responses based on audio patterns
            const simulatedInputs = [
                "Hello, how are you?",
                "I need help with something",
                "What can you do for me?",
                "Thank you",
                "Can you help me?",
                "I have a question"
            ];
            
            const randomInput = simulatedInputs[Math.floor(Math.random() * simulatedInputs.length)];
            console.log(`🎙️ Simulated speech-to-text: "${randomInput}"`);
            
            // Send to AI conversation service
            try {
                await aiConversationService.processUserInput(callData.conversationId, randomInput);
            } catch (error) {
                console.error('❌ Error processing user input:', error);
            }
        }
    }

    /**
     * Set up Play.ht audio forwarding to Twilio
     */
    setupPlayHTAudioForwarding(callData) {
        if (!callData.playHTStreamId) {
            console.warn('⚠️ No Play.ht stream ID available for forwarding');
            return;
        }

        // Poll for Play.ht audio and forward to Twilio
        const forwardingInterval = setInterval(() => {
            if (!callData.isActive) {
                clearInterval(forwardingInterval);
                return;
            }

            try {
                const streamAudio = playHTService.getStreamAudio(callData.playHTStreamId);
                if (streamAudio && streamAudio.lastAudioChunk) {
                    this.sendAudioToTwilio(callData, streamAudio.lastAudioChunk);
                }
            } catch (error) {
                console.error('❌ Error forwarding Play.ht audio:', error);
            }
        }, 100); // Check every 100ms

        callData.forwardingInterval = forwardingInterval;
    }

    /**
     * Send audio data to Twilio Media Stream
     */
    sendAudioToTwilio(callData, audioData) {
        if (!callData.ws || !callData.streamSid) {
            return;
        }

        try {
            const mediaMessage = {
                event: 'media',
                streamSid: callData.streamSid,
                media: {
                    track: 'outbound',
                    chunk: Date.now().toString(),
                    timestamp: Date.now().toString(),
                    payload: audioData.data // Play.ht audio data is already base64 encoded
                }
            };

            callData.ws.send(JSON.stringify(mediaMessage));
            
            // Log audio sending (sample to avoid spam)
            if (Math.random() < 0.1) {
                console.log(`🎵 Audio sent to Twilio - Size: ${audioData.data.length} bytes`);
            }
        } catch (error) {
            console.error('❌ Error sending audio to Twilio:', error);
        }
    }

    /**
     * Send audio message back to Twilio (deprecated - use AI conversation service)
     */
    sendAudioMessage(ws, text) {
        console.log(`🗣️ Deprecated: Use AI conversation service instead of sendAudioMessage`);
        console.log(`🗣️ Message: "${text}"`);
    }

    /**
     * Get active calls statistics
     */
    getActiveCallsStats() {
        const activeCalls = Array.from(this.activeCalls.values());
        return {
            totalActiveCalls: activeCalls.length,
            calls: activeCalls.map(call => ({
                streamSid: call.streamSid,
                callSid: call.callSid,
                startTime: call.startTime,
                duration: new Date() - call.startTime,
                audioStats: call.audioStats || null
            }))
        };
    }

    /**
     * Close all active calls
     */
    closeAllCalls() {
        console.log(`🛑 Closing ${this.activeCalls.size} active calls`);
        
        for (const [streamSid, callData] of this.activeCalls) {
            callData.isActive = false;
        }
        
        this.activeCalls.clear();
    }
}

module.exports = new MediaStreamHandler(); 