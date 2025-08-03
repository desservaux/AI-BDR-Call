const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import services
const twilioService = require('./services/twilio'); // Original service (backup)
const TwilioWithLoggingService = require('./services/twilio-with-logging'); // Enhanced service class
const humeEVIService = require('./services/hume-evi'); // HumeAI EVI integration
const latencyMonitor = require('./services/latency-monitor');

// Create enhanced service instance
const twilioWithLoggingService = new TwilioWithLoggingService();

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

// Serve the call dashboard UI
app.get('/call-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'call-dashboard.html'));
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

// Enhanced Twilio service test endpoint
app.get('/test-twilio-enhanced', async (req, res) => {
    try {
        // Initialize the service
        twilioWithLoggingService.initialize();
        
        // Test the service capabilities
        const testResult = await twilioWithLoggingService.testConnection();
        const activeCalls = await twilioWithLoggingService.getActiveCallsWithLogging();
        
        res.json({
            success: true,
            message: 'Enhanced Twilio service is ready',
            testResult: testResult,
            activeCalls: activeCalls.activeCalls.length,
            statistics: activeCalls.statistics
        });
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

// 🚀 OFFICIAL CALL ENDPOINT - Ultra-Low Latency Optimized (Original)
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

// 🚀 ENHANCED CALL ENDPOINT - With Comprehensive Logging
app.post('/make-call-with-logging', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        console.log(`🚀 Making enhanced call with logging to ${phoneNumber}`);

        // Initialize enhanced service if not already done
        twilioWithLoggingService.initialize();

        // Use the enhanced Twilio service with comprehensive logging
        const result = await twilioWithLoggingService.makeCall(phoneNumber, message || 'Hello, this is an AI assistant calling.');

        res.json({
            success: true,
            message: 'Enhanced call with logging initiated',
            callInfo: result,
            logging: 'enabled',
            status: 'calling',
            optimization: 'ultra-low-latency-with-logging'
        });

    } catch (error) {
        console.error('❌ Enhanced call failed:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 📊 CALL DASHBOARD ENDPOINTS

// Get all calls with filtering
app.get('/api/calls', async (req, res) => {
    try {
        const { 
            limit = 50, 
            offset = 0, 
            phoneNumber, 
            bookingOutcome, 
            status,
            startDate,
            endDate
        } = req.query;

        const filters = {
            limit: parseInt(limit),
            offset: parseInt(offset),
            phoneNumber,
            bookingOutcome,
            status,
            startDate,
            endDate
        };

        const calls = await twilioWithLoggingService.getCallHistory(filters);
        res.json({
            success: true,
            calls: calls,
            total: calls.length,
            filters: filters
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get active calls
app.get('/api/calls/active', async (req, res) => {
    try {
        const activeCalls = await twilioWithLoggingService.getActiveCallsWithLogging();
        res.json({
            success: true,
            activeCalls: activeCalls.activeCalls,
            statistics: activeCalls.statistics,
            pendingCalls: activeCalls.pendingCalls,
            chatMappings: activeCalls.chatMappings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Export call data
app.get('/api/calls/export', async (req, res) => {
    try {
        const { format = 'json', ...filters } = req.query;
        const exportData = await twilioWithLoggingService.exportCallData(filters);
        
        if (format === 'csv') {
            // Convert to CSV format
            const csvHeaders = ['id', 'phone_number', 'start_time', 'end_time', 'duration', 'status', 'booking_outcome', 'confidence_score'];
            const csvData = exportData.map(call => csvHeaders.map(header => call[header]).join(','));
            const csvContent = [csvHeaders.join(','), ...csvData].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="calls-export.csv"');
            res.send(csvContent);
        } else {
            res.json({
                success: true,
                data: exportData,
                format: 'json'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get call statistics
app.get('/api/calls/stats', async (req, res) => {
    try {
        const stats = await twilioWithLoggingService.getActiveCallsWithLogging();
        res.json({
            success: true,
            statistics: stats.statistics,
            activeCalls: stats.activeCalls.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get call details (must be last to avoid catching other routes)
app.get('/api/calls/:callId', async (req, res) => {
    try {
        const { callId } = req.params;
        const callDetails = await twilioWithLoggingService.getCallDetails(callId);
        
        if (!callDetails) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        res.json({
            success: true,
            call: callDetails
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Webhook endpoint for call status updates
app.post('/webhook/call-status', async (req, res) => {
    try {
        const { CallSid, CallStatus, CallDuration } = req.body;
        console.log(`📞 Call status update: ${CallSid} - ${CallStatus}`);

        // Handle call completion with enhanced service
        if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
            await twilioWithLoggingService.handleCallCompletion(CallSid, CallStatus);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error handling call status webhook:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Webhook endpoint for HumeAI chat metadata
app.post('/webhook/hume-chat', async (req, res) => {
    try {
        const { chat_id, chat_group_id, request_id, call_sid } = req.body;
        console.log(`💬 HumeAI chat metadata received: ${chat_id}`);

        if (chat_id && call_sid) {
            await twilioWithLoggingService.processChatMetadata({
                chat_id,
                chat_group_id,
                request_id
            }, call_sid);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error handling HumeAI chat webhook:', error.message);
        res.status(500).json({ success: false, message: error.message });
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
    const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'HUME_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
        console.warn('⚠️  Missing environment variables:', missingEnvVars.join(', '));
        console.warn('   Please configure these in your .env file or Replit secrets');
    } else {
        console.log('✅ All required environment variables are configured');
        console.log('🔗 API connections ready:');
        console.log('   - Twilio: ✅');
        console.log('   - HumeAI EVI: ✅');
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
