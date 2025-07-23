const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');
const EventEmitter = require('events');

class LiveKitService extends EventEmitter {
    constructor() {
        super();
        this.initialized = false;
        this.client = null;
        this.activeRooms = new Map(); // Map of roomName -> room data
        this.stats = {
            totalRooms: 0,
            activeRooms: 0,
            totalParticipants: 0,
            totalSipCalls: 0,
            errors: 0
        };
    }

    /**
     * Get fresh credentials from environment variables
     */
    getCredentials() {
        // Temporary hardcoded LiveKit credentials for testing
        const apiKey = process.env.LIVEKIT_API_KEY || 'APILiHWQMCq8HaB';
        const apiSecret = process.env.LIVEKIT_API_SECRET || '5xmXfOCA0f1feeAxnGiRuVeAmaOe4Q8SfBP8Kw09t4BU';
        const wsUrl = process.env.LIVEKIT_WS_URL || 'wss://test-89asdjqg.livekit.cloud';

        if (!apiKey || !apiSecret || !wsUrl) {
            throw new Error('LiveKit credentials required: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL');
        }

        return {
            apiKey,
            apiSecret,
            wsUrl
        };
    }

    /**
     * Initialize the LiveKit service
     */
    async initialize() {
        try {
            const { apiKey, apiSecret, wsUrl } = this.getCredentials();

            console.log('🎥 Initializing LiveKit service...');

            // Create the RoomServiceClient
            this.client = new RoomServiceClient(wsUrl, apiKey, apiSecret);

            // Test connection by listing rooms
            await this.testConnection();

            this.initialized = true;
            console.log('✅ LiveKit service initialized successfully');

            return {
                success: true,
                message: 'LiveKit service initialized',
                config: {
                    wsUrl: wsUrl,
                    apiKeyPresent: !!apiKey,
                    apiSecretPresent: !!apiSecret
                }
            };

        } catch (error) {
            console.error('❌ Failed to initialize LiveKit service:', error.message);
            this.initialized = false;
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Test connection to LiveKit server
     */
    async testConnection() {
        if (!this.client) {
            throw new Error('LiveKit client not initialized');
        }

        try {
            console.log('🔗 Testing LiveKit connection...');
            
            // Test by listing rooms (this validates credentials)
            const rooms = await this.client.listRooms();
            
            console.log(`✅ LiveKit connection successful - Found ${rooms.length} rooms`);
            
            return {
                success: true,
                roomCount: rooms.length,
                serverInfo: 'Connected to LiveKit Cloud'
            };

        } catch (error) {
            console.error('❌ LiveKit connection test failed:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Create a new room for voice conversations
     * @param {string} roomName - Unique room identifier
     * @param {Object} options - Room configuration options
     */
    async createRoom(roomName, options = {}) {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            console.log(`🏠 Creating LiveKit room: ${roomName}`);

            const roomOptions = {
                name: roomName,
                emptyTimeout: options.emptyTimeout || 300, // 5 minutes
                maxParticipants: options.maxParticipants || 10,
                metadata: JSON.stringify({
                    purpose: 'voice-ai-conversation',
                    humeIntegration: true,
                    createdAt: new Date().toISOString(),
                    ...options.metadata
                })
            };

            const room = await this.client.createRoom(roomOptions);
            
            // Store room data locally
            this.activeRooms.set(roomName, {
                name: roomName,
                sid: room.sid,
                createdAt: new Date(),
                participants: new Map(),
                humeConnected: false,
                sipConnected: false,
                metadata: options.metadata || {}
            });

            this.stats.totalRooms++;
            this.stats.activeRooms = this.activeRooms.size;

            console.log(`✅ Room created successfully: ${roomName} (SID: ${room.sid})`);

            return {
                success: true,
                room: room,
                roomName: roomName,
                roomSid: room.sid
            };

        } catch (error) {
            console.error(`❌ Failed to create room ${roomName}:`, error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Generate access token for a participant to join a room
     * @param {string} roomName - Room name
     * @param {string} participantIdentity - Unique participant identifier
     * @param {Object} options - Token options
     */
    async generateAccessToken(roomName, participantIdentity, options = {}) {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            const { apiKey, apiSecret } = this.getCredentials();

            const token = new AccessToken(apiKey, apiSecret, {
                identity: participantIdentity,
                ttl: options.ttl || '1h' // 1 hour default
            });

            // Grant permissions
            token.addGrant({
                room: roomName,
                roomJoin: true,
                canPublish: options.canPublish !== false, // Default true
                canSubscribe: options.canSubscribe !== false, // Default true
                canPublishData: options.canPublishData || false,
                canUpdateOwnMetadata: true
            });

            const accessToken = await token.toJwt();

            console.log(`🎫 Generated access token for ${participantIdentity} in room ${roomName}`);

            return {
                success: true,
                token: accessToken,
                roomName: roomName,
                participantIdentity: participantIdentity,
                wsUrl: this.getCredentials().wsUrl
            };

        } catch (error) {
            console.error(`❌ Failed to generate access token:`, error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Create a SIP trunk integration for phone calls
     * @param {string} roomName - Room to connect phone call to
     * @param {string} phoneNumber - Phone number to call or accept call from
     */
    async createSipCall(roomName, phoneNumber, options = {}) {
        // This will be implemented when we integrate with LiveKit SIP
        // For now, we'll prepare the structure
        
        console.log(`📞 SIP call integration planned for room ${roomName} with ${phoneNumber}`);
        
        // For now, return guidance on SIP setup
        return {
            success: false,
            message: 'SIP trunk setup required - use createSIPTrunk() first',
            guidance: {
                step1: 'Create inbound SIP trunk',
                step2: 'Create dispatch rule',
                step3: 'Configure phone number with SIP provider',
                roomName,
                phoneNumber
            }
        };
    }

    /**
     * Get room information and participants
     * @param {string} roomName - Room name to query
     */
    async getRoomInfo(roomName) {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            const room = await this.client.getRoom(roomName);
            const participants = await this.client.listParticipants(roomName);
            
            // Update local cache
            if (this.activeRooms.has(roomName)) {
                const roomData = this.activeRooms.get(roomName);
                roomData.participants.clear();
                participants.forEach(p => {
                    roomData.participants.set(p.identity, {
                        identity: p.identity,
                        sid: p.sid,
                        joinedAt: new Date(p.joinedAt * 1000),
                        metadata: p.metadata
                    });
                });
            }

            return {
                success: true,
                room: room,
                participants: participants,
                participantCount: participants.length
            };

        } catch (error) {
            console.error(`❌ Failed to get room info for ${roomName}:`, error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Delete a room and disconnect all participants
     * @param {string} roomName - Room name to delete
     */
    async deleteRoom(roomName) {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            console.log(`🗑️ Deleting LiveKit room: ${roomName}`);

            await this.client.deleteRoom(roomName);
            
            // Remove from local cache
            if (this.activeRooms.has(roomName)) {
                this.activeRooms.delete(roomName);
                this.stats.activeRooms = this.activeRooms.size;
            }

            console.log(`✅ Room deleted successfully: ${roomName}`);

            return {
                success: true,
                message: `Room ${roomName} deleted successfully`
            };

        } catch (error) {
            console.error(`❌ Failed to delete room ${roomName}:`, error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * List all rooms
     */
    async listRooms() {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            const rooms = await this.client.listRooms();
            
            return {
                success: true,
                rooms: rooms,
                count: rooms.length
            };

        } catch (error) {
            console.error('❌ Failed to list rooms:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Get service statistics
     */
    getStats() {
        this.stats.activeRooms = this.activeRooms.size;
        this.stats.totalParticipants = Array.from(this.activeRooms.values())
            .reduce((total, room) => total + room.participants.size, 0);

        return {
            ...this.stats,
            initialized: this.initialized,
            roomDetails: Array.from(this.activeRooms.entries()).map(([name, data]) => ({
                name,
                sid: data.sid,
                participantCount: data.participants.size,
                createdAt: data.createdAt,
                humeConnected: data.humeConnected,
                sipConnected: data.sipConnected
            }))
        };
    }

    /**
     * Create SIP inbound trunk for receiving phone calls
     * @param {Object} config - SIP trunk configuration
     */
    async createSIPInboundTrunk(config = {}) {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            console.log('📞 Creating LiveKit SIP inbound trunk...');

            const trunkConfig = {
                name: config.name || 'AI Voice Agent Inbound Trunk',
                numbers: config.numbers || [], // Phone numbers will be added later
                metadata: JSON.stringify({
                    purpose: 'ai-voice-agent',
                    createdAt: new Date().toISOString(),
                    ...config.metadata
                }),
                // Optional authentication
                auth_username: config.authUsername,
                auth_password: config.authPassword,
                // Optional allowed addresses/numbers for security
                allowed_addresses: config.allowedAddresses,
                allowed_numbers: config.allowedNumbers
            };

            // Call LiveKit SIP API to create inbound trunk
            const response = await this.callSIPAPI('CreateSIPInboundTrunk', {
                trunk: trunkConfig
            });

            console.log(`✅ SIP inbound trunk created: ${response.sip_trunk_id}`);

            return {
                success: true,
                trunkId: response.sip_trunk_id,
                config: trunkConfig
            };

        } catch (error) {
            console.error('❌ Failed to create SIP inbound trunk:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Create SIP dispatch rule to route calls to rooms with agents
     * @param {Object} config - Dispatch rule configuration
     */
    async createSIPDispatchRule(config = {}) {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            console.log('📋 Creating LiveKit SIP dispatch rule...');

            const dispatchRuleConfig = {
                name: config.name || 'AI Voice Agent Dispatch Rule',
                rule: {
                    // Individual rooms for each caller
                    dispatchRuleIndividual: {
                        roomPrefix: config.roomPrefix || 'call-'
                    }
                },
                // Auto-dispatch agents to handle calls
                room_config: {
                    agents: [{
                        agentName: config.agentName || 'hume-ai-agent'
                    }]
                },
                // Optional trunk associations
                trunk_ids: config.trunkIds || [],
                // Optional phone number restrictions
                inbound_numbers: config.inboundNumbers || [],
                // Metadata for participants
                metadata: JSON.stringify({
                    purpose: 'ai-voice-conversation',
                    agentType: 'hume-ai',
                    ...config.metadata
                })
            };

            // Call LiveKit SIP API to create dispatch rule
            const response = await this.callSIPAPI('CreateSIPDispatchRule', {
                dispatch_rule: dispatchRuleConfig
            });

            console.log(`✅ SIP dispatch rule created: ${response.sip_dispatch_rule_id}`);

            return {
                success: true,
                dispatchRuleId: response.sip_dispatch_rule_id,
                config: dispatchRuleConfig
            };

        } catch (error) {
            console.error('❌ Failed to create SIP dispatch rule:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Create SIP outbound trunk for making calls
     * @param {Object} config - SIP trunk configuration
     */
    async createSIPOutboundTrunk(config = {}) {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            console.log('📞 Creating LiveKit SIP outbound trunk...');

            const trunkConfig = {
                name: config.name || 'AI Voice Agent Outbound Trunk',
                address: config.address || 'test-89asdjqg.pstn.twilio.com',
                numbers: config.numbers || ['+447846855904'],
                auth_username: config.authUsername || 'ai-voice-agent',
                auth_password: config.authPassword || 'secure-password-123',
                metadata: JSON.stringify({
                    purpose: 'ai-voice-outbound-calls',
                    createdAt: new Date().toISOString(),
                    ...config.metadata
                })
            };

            // Call LiveKit SIP API to create outbound trunk
            const response = await this.callSIPAPI('CreateSIPOutboundTrunk', {
                trunk: trunkConfig
            });

            console.log(`✅ SIP outbound trunk created: ${response.sip_trunk_id}`);

            return {
                success: true,
                trunkId: response.sip_trunk_id,
                config: trunkConfig
            };

        } catch (error) {
            console.error('❌ Failed to create SIP outbound trunk:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * List existing SIP inbound trunks
     */
    async listSIPInboundTrunks() {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            const response = await this.callSIPAPI('ListSIPInboundTrunk', {});
            
            return {
                success: true,
                trunks: response || [],
                count: response?.length || 0
            };

        } catch (error) {
            console.error('❌ Failed to list SIP inbound trunks:', error.message);
            throw error;
        }
    }

    /**
     * List existing SIP outbound trunks
     */
    async listSIPOutboundTrunks() {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            const response = await this.callSIPAPI('ListSIPOutboundTrunk', {});
            
            return {
                success: true,
                trunks: response || [],
                count: response?.length || 0
            };

        } catch (error) {
            console.error('❌ Failed to list SIP outbound trunks:', error.message);
            throw error;
        }
    }

    /**
     * List existing SIP dispatch rules
     */
    async listSIPDispatchRules() {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            const response = await this.callSIPAPI('ListSIPDispatchRule', {});
            
            return {
                success: true,
                rules: response || [],
                count: response?.length || 0
            };

        } catch (error) {
            console.error('❌ Failed to list SIP dispatch rules:', error.message);
            throw error;
        }
    }

    /**
     * Call LiveKit SIP API
     * @private
     */
    async callSIPAPI(method, data) {
        const { wsUrl, apiKey, apiSecret } = this.getCredentials();
        
        // Convert WebSocket URL to HTTP API URL
        const httpUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
        const apiUrl = `${httpUrl}/twirp/livekit.SIP/${method}`;

        // Generate JWT token for API access using server-side token
        const { AccessToken } = require('livekit-server-sdk');
        
        // Create token with SIP admin permissions
        const token = new AccessToken(apiKey, apiSecret, {
            identity: 'sip-admin',
            ttl: '1h'
        });
        
        // Add SIP grants using the correct method and format
        token.addSIPGrant({
            admin: true,
            call: true
        });

        const jwt = await token.toJwt();

        console.log(`🔗 Calling LiveKit SIP API: ${method}`);
        
        // Make API request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${jwt}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ SIP API error ${response.status}:`, errorText);
            throw new Error(`SIP API error: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ SIP API ${method} successful`);
        
        return result;
    }

    /**
     * Make outbound SIP call with HumeAI agent
     * @param {string} phoneNumber - Phone number to call
     * @param {Object} options - Call options
     */
    async makeOutboundCall(phoneNumber, options = {}) {
        if (!this.initialized) {
            throw new Error('LiveKit service not initialized');
        }

        try {
            console.log(`📞 Making outbound SIP call to ${phoneNumber}`);

            const {
                roomName,
                fromNumber = '+447846855904',
                agentName = 'hume-ai-agent',
                message = 'Hello, this is an AI assistant.'
            } = options;

            // Get the CORRECT outbound trunk ID (Twilio-compatible trunk)
            let outboundTrunkId;
            try {
                const outboundTrunks = await this.listSIPOutboundTrunks();
                if (outboundTrunks.trunks.items && outboundTrunks.trunks.items.length > 0) {
                    // CRITICAL FIX: Use the Twilio-compatible trunk with simple password
                    const correctTrunk = outboundTrunks.trunks.items.find(trunk => 
                        trunk.address === 'bdr-call-agent-martin.pstn.twilio.com' &&
                        trunk.auth_username === 'livekit-voice' &&
                        trunk.auth_password === 'SimplePass123'
                    );
                    
                    if (correctTrunk) {
                        outboundTrunkId = correctTrunk.sip_trunk_id;
                        console.log(`📞 Using correct Twilio trunk: ${outboundTrunkId} (${correctTrunk.name})`);
                        console.log(`   Address: ${correctTrunk.address}`);
                        console.log(`   Auth: ${correctTrunk.auth_username}`);
                    } else {
                        // Fallback to first trunk if correct one not found
                        outboundTrunkId = outboundTrunks.trunks.items[0].sip_trunk_id;
                        console.log(`⚠️ Using fallback trunk: ${outboundTrunkId}`);
                    }
                } else {
                    // Create outbound trunk if none exists
                    console.log('📞 Creating outbound trunk...');
                    const trunk = await this.createSIPOutboundTrunk();
                    outboundTrunkId = trunk.trunkId;
                }
            } catch (error) {
                throw new Error(`Failed to get outbound trunk: ${error.message}`);
            }

            // Create SIP participant for outbound call
            const sipParticipant = await this.createSIPParticipant({
                sip_call_to: phoneNumber,
                sip_number: fromNumber,
                sip_trunk_id: outboundTrunkId, // Required for outbound calls
                room_name: roomName,
                participant_identity: `outbound-caller-${Date.now()}`,
                participant_name: `Outbound Call to ${phoneNumber}`,
                participant_metadata: JSON.stringify({
                    callType: 'outbound',
                    phoneNumber,
                    fromNumber,
                    agentName,
                    timestamp: new Date().toISOString()
                }),
                // Auto-disconnect when call ends
                auto_disconnect: true,
                wait_until_answered: true
            });

            console.log(`✅ Outbound call initiated: ${sipParticipant.participant_id}`);
            this.stats.totalSipCalls = (this.stats.totalSipCalls || 0) + 1;

            return {
                success: true,
                participantId: sipParticipant.participant_id,
                roomName,
                phoneNumber,
                fromNumber,
                status: 'calling',
                message: 'Call initiated - HumeAI agent will handle conversation'
            };

        } catch (error) {
            console.error('❌ Failed to make outbound call:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Create SIP participant for outbound calls
     * @private
     */
    async createSIPParticipant(config) {
        const { wsUrl, apiKey, apiSecret } = this.getCredentials();
        
        // Convert WebSocket URL to HTTP API URL
        const httpUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
        const apiUrl = `${httpUrl}/twirp/livekit.SIP/CreateSIPParticipant`;

        // Generate JWT token for API access
        const { AccessToken } = require('livekit-server-sdk');
        const token = new AccessToken(apiKey, apiSecret, {
            identity: 'sip-caller',
            ttl: '1h'
        });
        
        // Add SIP grants
        token.addSIPGrant({
            admin: true,
            call: true
        });

        const jwt = await token.toJwt();

        console.log(`🔗 Creating SIP participant for outbound call`);
        
        // Make API request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${jwt}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sip_call_to: config.sip_call_to,
                sip_number: config.sip_number,
                sip_trunk_id: config.sip_trunk_id, // Required for outbound calls
                room_name: config.room_name,
                participant_identity: config.participant_identity,
                participant_name: config.participant_name,
                participant_metadata: config.participant_metadata,
                auto_disconnect: config.auto_disconnect || true,
                wait_until_answered: config.wait_until_answered || true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ SIP participant creation failed ${response.status}:`, errorText);
            throw new Error(`SIP participant creation failed: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ SIP participant created successfully`);
        
        return result;
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up LiveKit service...');
        
        // Delete all active rooms
        const roomNames = Array.from(this.activeRooms.keys());
        for (const roomName of roomNames) {
            try {
                await this.deleteRoom(roomName);
            } catch (error) {
                console.error(`Failed to cleanup room ${roomName}:`, error.message);
            }
        }

        this.activeRooms.clear();
        this.initialized = false;
        
        console.log('✅ LiveKit service cleanup complete');
    }
}

module.exports = new LiveKitService(); 