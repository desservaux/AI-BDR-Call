const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import services
const twilioService = require('./services/twilio');
const humeEVIService = require('./services/hume-evi'); // HumeAI EVI integration
const latencyMonitor = require('./services/latency-monitor');

const app = express();
const expressWsInstance = expressWs(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the latency monitor UI
app.get('/latency-monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'latency-monitor.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Twilio connection test endpoint
app.get('/test-twilio', async (req, res) => {
    try {
        const result = await twilioService.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// HumeAI EVI connection test endpoint
app.get('/test-hume-evi', async (req, res) => {
    try {
        // Use skipActualConnection=true for routine status checks to avoid creating agent sessions
        const skipConnection = req.query.skipConnection === 'true';
        const result = await humeEVIService.testConnection(skipConnection);
        res.json({
            success: true,
            message: 'HumeAI EVI connection test successful',
            data: result,
            stats: humeEVIService.getStats()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `HumeAI EVI connection failed: ${error.message}`,
            stats: humeEVIService.getStats()
        });
    }
});

// HumeAI EVI real connection test endpoint (creates actual WebSocket connection)
app.get('/test-hume-evi-real', async (req, res) => {
    try {
        const result = await humeEVIService.testConnection(false); // Force real connection
        res.json({
            success: true,
            message: 'HumeAI EVI real connection test successful',
            data: result,
            stats: humeEVIService.getStats()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `HumeAI EVI real connection failed: ${error.message}`,
            stats: humeEVIService.getStats()
        });
    }
});

// HumeAI EVI service statistics endpoint
app.get('/hume-evi/stats', async (req, res) => {
    try {
        const stats = humeEVIService.getStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// LiveKit connection test endpoint
app.get('/test-livekit', async (req, res) => {
    try {
        const result = await liveKitService.testConnection();
        res.json({
            success: true,
            message: 'LiveKit connection test successful',
            data: result,
            stats: liveKitService.getStats()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `LiveKit connection failed: ${error.message}`,
            stats: liveKitService.getStats()
        });
    }
});

// LiveKit service statistics endpoint
app.get('/livekit/stats', async (req, res) => {
    try {
        const stats = liveKitService.getStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create LiveKit room endpoint
app.post('/livekit/rooms', async (req, res) => {
    try {
        const { roomName, options } = req.body;
        
        if (!roomName) {
            return res.status(400).json({
                success: false,
                message: 'Room name is required'
            });
        }

        const result = await liveKitService.createRoom(roomName, options || {});
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Generate access token endpoint
app.post('/livekit/token', async (req, res) => {
    try {
        const { roomName, participantIdentity, options } = req.body;
        
        if (!roomName || !participantIdentity) {
            return res.status(400).json({
                success: false,
                message: 'Room name and participant identity are required'
            });
        }

        const result = await liveKitService.generateAccessToken(
            roomName, 
            participantIdentity, 
            options || {}
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// List LiveKit rooms endpoint
app.get('/livekit/rooms', async (req, res) => {
    try {
        const result = await liveKitService.listRooms();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get room info endpoint
app.get('/livekit/rooms/:roomName', async (req, res) => {
    try {
        const { roomName } = req.params;
        const result = await liveKitService.getRoomInfo(roomName);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete room endpoint
app.delete('/livekit/rooms/:roomName', async (req, res) => {
    try {
        const { roomName } = req.params;
        const result = await liveKitService.deleteRoom(roomName);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// SIP Management Endpoints

// Create SIP inbound trunk endpoint
app.post('/livekit/sip/inbound-trunk', async (req, res) => {
    try {
        const config = req.body;
        const result = await liveKitService.createSIPInboundTrunk(config);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create SIP dispatch rule endpoint
app.post('/livekit/sip/dispatch-rule', async (req, res) => {
    try {
        const config = req.body;
        const result = await liveKitService.createSIPDispatchRule(config);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// List SIP inbound trunks endpoint
app.get('/livekit/sip/inbound-trunks', async (req, res) => {
    try {
        const result = await liveKitService.listSIPInboundTrunks();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// List SIP dispatch rules endpoint
app.get('/livekit/sip/dispatch-rules', async (req, res) => {
    try {
        const result = await liveKitService.listSIPDispatchRules();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create SIP outbound trunk endpoint
app.post('/livekit/sip/outbound-trunk', async (req, res) => {
    try {
        const config = req.body;
        const result = await liveKitService.createSIPOutboundTrunk(config);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// List SIP outbound trunks endpoint
app.get('/livekit/sip/outbound-trunks', async (req, res) => {
    try {
        const result = await liveKitService.listSIPOutboundTrunks();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Track recent calls to prevent duplicates
const recentCalls = new Map();

// 🚀 OFFICIAL CALL ENDPOINT - Ultra-Low Latency Optimized
app.post('/make-call', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        console.log(`🚀 Making ultra-low latency call to ${phoneNumber}`);

        // Use the official Twilio service with ultra-low latency optimizations
        const result = await twilioService.makeCall(phoneNumber, {
            message: message || 'Hello, this is an ultra-low latency AI assistant calling.'
        });

        res.json({
            success: true,
            message: 'Ultra-low latency outbound call initiated',
            callInfo: result,
            performance: result.performance,
            instructions: 'Call uses maximum performance optimization for minimal latency',
            status: 'calling',
            optimization: 'ultra-low-latency'
        });

    } catch (error) {
        console.error('❌ Call failed:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get call status endpoint
app.get('/call-status/:callSid', async (req, res) => {
    try {
        const { callSid } = req.params;
        const result = await twilioService.getCallStatus(callSid);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Hang up call endpoint
app.post('/hangup-call/:callSid', async (req, res) => {
    try {
        const { callSid } = req.params;
        const result = await twilioService.hangupCall(callSid);
        res.json({ success: true, call: result });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 📊 LATENCY MONITORING ENDPOINTS

// Get latency statistics
app.get('/latency/stats', async (req, res) => {
    try {
        const stats = latencyMonitor.getStats();
        const performanceStats = twilioService.getPerformanceStats();
        
        res.json({
            success: true,
            latencyStats: stats,
            performanceStats: performanceStats,
            recommendations: latencyMonitor.analyzeBottlenecks().recommendations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get session details
app.get('/latency/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = latencyMonitor.getSession(sessionId);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        res.json({
            success: true,
            session: session
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Analyze bottlenecks
app.get('/latency/bottlenecks', async (req, res) => {
    try {
        const analysis = latencyMonitor.analyzeBottlenecks();
        
        res.json({
            success: true,
            analysis: analysis
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update performance configuration
app.post('/latency/config', async (req, res) => {
    try {
        const { config } = req.body;
        
        if (!config) {
            return res.status(400).json({
                success: false,
                message: 'Configuration is required'
            });
        }

        twilioService.updatePerformanceConfig(config);
        
        res.json({
            success: true,
            message: 'Performance configuration updated',
            newConfig: twilioService.getPerformanceStats().performanceConfig
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize services
async function initializeServices() {
    try {
        console.log('🔧 Initializing services...');
        
        // Initialize Twilio service (now includes ultra-low latency optimizations)
        await twilioService.initialize();
        
        // Initialize HumeAI EVI service
        try {
            await humeEVIService.initialize();
        } catch (error) {
            console.error('❌ HumeAI EVI service failed to initialize:', error.message);
        }
        
        console.log('✅ All services initialized successfully');
        
    } catch (error) {
        console.error('❌ Service initialization failed:', error.message);
        // Continue running server even if some services fail
    }
}

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
    console.log(`🚀 AI Voice Agent POC server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 WebSocket endpoint: ws://localhost:${PORT}/media-stream`);
    // Environment validation
    const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'PLAYAI_API_KEY', 'PLAYAI_USER_ID', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_WS_URL'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
        console.warn('⚠️  Missing environment variables:', missingEnvVars.join(', '));
        console.warn('   Please configure these in your .env file or Replit secrets');
    } else {
        console.log('✅ All required environment variables are configured');
        console.log('🔗 API connections ready:');
        console.log('   - Twilio: ✅');
        console.log('   - Play.ht: ✅');
        console.log('   - Play.ai Agent: 🤖');
    }
    // Initialize all services
    await initializeServices();
});

// Handle EADDRINUSE (port in use) error gracefully
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. This usually means another instance of the server is running.`);
        console.error('👉 On Replit, try clicking the "Stop" button or run "killall node" in the shell to stop all Node.js processes.');
        process.exit(1);
    } else {
        console.error('❌ Server error:', err);
        process.exit(1);
    }
});
