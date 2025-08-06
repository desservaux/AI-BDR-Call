const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');

// Load environment variables
dotenv.config();

// Import services
const elevenLabsService = require('./services/elevenlabs'); // ElevenLabs integration
const callLogger = require('./services/call-logger'); // Call logging service
const callSync = require('./services/call-sync'); // Call sync service (already instantiated)
const SupabaseDBService = require('./services/supabase-db'); // Database service

// Initialize services
const supabaseDb = new SupabaseDBService();

// ElevenLabs service is already instantiated

const app = express();
const expressWsInstance = expressWs(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || 
            file.originalname.endsWith('.csv') ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.originalname.endsWith('.xlsx')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and XLSX files are allowed'));
        }
    }
});

// Serve the main UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ElevenLabs service test endpoint
app.get('/test-elevenlabs', async (req, res) => {
    try {
        const result = await elevenLabsService.testConnection();
        res.json({
            success: true,
            message: 'ElevenLabs service test successful',
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `ElevenLabs service test failed: ${error.message}`
        });
    }
});

// 🚀 ELEVENLABS CALL ENDPOINT - Primary Call Endpoint
app.post('/make-call', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        console.log(`🚀 Making ElevenLabs call to ${phoneNumber}`);

        // Get ElevenLabs configuration from environment
        const agentId = process.env.ELEVENLABS_AGENT_ID || 'agent_01jzr5hv9eefkbmnyz8y6smw19';
        const agentPhoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID || '+447846855904';

        // Make call via ElevenLabs API
        const result = await elevenLabsService.makeOutboundCall(
            agentId,
            agentPhoneNumberId,
            phoneNumber,
            {
                message: message || 'Hello! This is your AI assistant calling via ElevenLabs.'
            }
        );

        res.json({
            success: true,
            message: 'ElevenLabs outbound call initiated successfully',
            callInfo: result,
            status: 'calling',
            provider: 'elevenlabs'
        });

    } catch (error) {
        console.error('❌ ElevenLabs call failed:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ElevenLabs agents endpoint
app.get('/elevenlabs/agents', async (req, res) => {
    try {
        const agents = await elevenLabsService.getAgents();
        res.json({
            success: true,
            agents: agents
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ElevenLabs phone numbers endpoint
app.get('/elevenlabs/phone-numbers', async (req, res) => {
    try {
        const phoneNumbers = await elevenLabsService.getAgentPhoneNumbers();
        res.json({
            success: true,
            phoneNumbers: phoneNumbers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ElevenLabs conversation details endpoint
app.get('/elevenlabs/conversation/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const conversationDetails = await elevenLabsService.getConversationDetails(conversationId);
        res.json({
            success: true,
            conversation: conversationDetails
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ElevenLabs webhook endpoint for call completion
app.post('/webhook/elevenlabs-call-ended', async (req, res) => {
    try {
        const { conversation_id, call_sid, status } = req.body;
        
        console.log(`📞 ElevenLabs call ended: ${conversation_id} (${status})`);
        
        // Process the completed call
        // This would integrate with the call-logger service
        // For now, just acknowledge the webhook
        
        // Handle sequence integration
        await handleSequenceCallCompletion(conversation_id, status);
        
        res.json({
            success: true,
            message: 'Webhook received successfully'
        });
    } catch (error) {
        console.error('❌ Error processing ElevenLabs webhook:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 🎯 DASHBOARD API ENDPOINTS

// Helper function to map call status based on call data
function mapCallStatus(call) {
    // Use the new call_result field if available (from Phase 18.1 status mapping)
    if (call.call_result) {
        return call.call_result;
    }
    
    // Fallback to duration-based logic for legacy data
    if (call.duration_seconds > 5) {
        return 'answered';
    } else if (call.duration_seconds > 0) {
        return 'unanswered';
    } else {
        return call.status || 'unknown'; // Fallback to original status
    }
}

// Get all calls for dashboard with advanced filtering and pagination
app.get('/api/calls', async (req, res) => {
    try {
        const { 
            status, 
            phone, 
            dateStart, 
            dateEnd, 
            meetingBooked, 
            personInterested, 
            personUpset, 
            duration,
            page = 1,
            limit = 20
        } = req.query;
        
        console.log(`📊 Fetching calls with advanced filters: status=${status}, phone=${phone}, dateStart=${dateStart}, dateEnd=${dateEnd}, meetingBooked=${meetingBooked}, personInterested=${personInterested}, personUpset=${personUpset}, duration=${duration}, page=${page}, limit=${limit}`);
        
        // Get calls from database with advanced filtering
        const result = await supabaseDb.getCallsWithAdvancedFilters({
            status: status || null,
            phone: phone || null,
            dateStart: dateStart || null,
            dateEnd: dateEnd || null,
            meetingBooked: meetingBooked || null,
            personInterested: personInterested || null,
            personUpset: personUpset || null,
            duration: duration || null,
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
        const calls = result.calls || [];
        const total = result.total || 0;
        
        // Get analysis data for all calls
        const callsWithAnalysis = await Promise.all(calls.map(async (call) => {
            try {
                const analysis = await supabaseDb.getBookingAnalysisByCallId(call.id);
                return {
                    ...call,
                    enhanced_status: mapCallStatus(call),
                    meeting_booked: analysis ? analysis.meeting_booked : false,
                    person_interested: analysis ? analysis.person_interested : false,
                    person_very_upset: analysis ? analysis.person_very_upset : false,
                    confidence_score: analysis ? analysis.confidence_score : 0
                };
            } catch (error) {
                console.warn(`⚠️ Error fetching analysis for call ${call.id}:`, error.message);
                return {
                    ...call,
                    enhanced_status: mapCallStatus(call),
                    meeting_booked: false,
                    person_interested: false,
                    person_very_upset: false,
                    confidence_score: 0
                };
            }
        }));
        
        res.json({
            success: true,
            calls: callsWithAnalysis,
            count: callsWithAnalysis.length,
            total: total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
        
    } catch (error) {
        console.error('❌ Error fetching calls:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch calls: ${error.message}`
        });
    }
});

// Get call details by ID
app.get('/api/calls/:callId', async (req, res) => {
    try {
        const { callId } = req.params;
        
        console.log(`📞 Fetching call details for: ${callId}`);
        
        const callDetails = await supabaseDb.getCallDetails(callId);
        
        if (!callDetails) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }
        
        // Apply enhanced status mapping
        let callWithEnhancedStatus = {
            ...callDetails,
            call: {
                ...callDetails.call,
                enhanced_status: mapCallStatus(callDetails.call)
            }
        };
        
        // If no transcriptions in database, try to fetch from ElevenLabs
        if ((!callDetails.transcriptions || callDetails.transcriptions.length === 0) && 
            callDetails.call.elevenlabs_conversation_id) {
            try {
                console.log(`📝 No transcriptions in database, fetching from ElevenLabs for conversation: ${callDetails.call.elevenlabs_conversation_id}`);
                
                const elevenLabsDetails = await elevenLabsService.getConversationDetailsEnhanced(callDetails.call.elevenlabs_conversation_id);
                
                if (elevenLabsDetails.success && elevenLabsDetails.transcript && elevenLabsDetails.transcript.length > 0) {
                    // Convert ElevenLabs transcript format to our database format
                    const transcriptions = elevenLabsDetails.transcript.map(message => ({
                        call_id: callId,
                        speaker: message.speaker || 'unknown',
                        message: message.text || '', // Use 'message' instead of 'text'
                        timestamp: message.timestamp || new Date().toISOString(),
                        event_type: message.message_type || 'text'
                    }));
                    
                    // Store transcriptions in database for future use
                    try {
                        await supabaseDb.insertTranscriptions(transcriptions);
                        console.log(`✅ Stored ${transcriptions.length} transcriptions from ElevenLabs`);
                    } catch (storeError) {
                        console.warn(`⚠️ Failed to store transcriptions: ${storeError.message}`);
                    }
                    
                    // Update call details with transcriptions
                    callWithEnhancedStatus.transcriptions = transcriptions;
                }
            } catch (elevenLabsError) {
                console.warn(`⚠️ Failed to fetch transcriptions from ElevenLabs: ${elevenLabsError.message}`);
            }
        }
        
        res.json({
            success: true,
            callDetails: callWithEnhancedStatus
        });
        
    } catch (error) {
        console.error('❌ Error fetching call details:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch call details: ${error.message}`
        });
    }
});

// Sync calls from ElevenLabs
app.post('/api/sync-calls', async (req, res) => {
    try {
        console.log('🔄 Starting call sync from ElevenLabs...');
        
        // Initialize the call sync service first (like our test script)
        const initResult = await callSync.initialize();
        if (!initResult) {
            throw new Error('Failed to initialize call sync service');
        }
        
        // Clean up any existing fake calls before syncing
        console.log('🧹 Cleaning up fake calls before sync...');
        const cleanupResult = await callSync.cleanupFakeCalls();
        console.log(`✅ Cleaned up ${cleanupResult.total_deleted} fake calls`);
        
        // Use the call sync service to sync calls
        const syncResult = await callSync.syncAllConversations();
        
        res.json({
            success: true,
            message: 'Call sync completed successfully',
            syncedCount: syncResult.new_calls,
            totalCalls: syncResult.total_conversations,
            newCalls: syncResult.new_calls,
            updatedCalls: syncResult.updated_calls,
            externalCalls: syncResult.external_calls,
            errors: syncResult.errors,
            syncTime: syncResult.sync_duration_ms,
            fakeCallsRemoved: cleanupResult.total_deleted
        });
        
    } catch (error) {
        console.error('❌ Error syncing calls:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to sync calls: ${error.message}`
        });
    }
});

// Get analytics data
app.get('/api/analytics', async (req, res) => {
    try {
        console.log('📊 Fetching enhanced analytics data...');
        
        // Get basic analytics from database
        const analytics = await supabaseDb.getCallAnalytics();
        
        // Get enhanced analytics data for charts
        const enhancedAnalytics = await getEnhancedAnalytics();
        
        res.json({
            success: true,
            analytics: {
                ...analytics,
                ...enhancedAnalytics
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching analytics:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch analytics: ${error.message}`
        });
    }
});

// Enhanced analytics function for charts and visualizations
async function getEnhancedAnalytics() {
    try {
        // Get calls for the last 30 days for trend analysis
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: recentCalls, error } = await supabaseDb.client
            .from('calls')
            .select('created_at, status, duration_seconds, call_result, phone_number')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Process data for charts
        const chartData = processCallDataForCharts(recentCalls || []);
        
        return {
            // Time series data for charts
            dailyCalls: chartData.dailyCalls,
            dailySuccessRates: chartData.dailySuccessRates,
            dailyDurations: chartData.dailyDurations,
            
            // Status breakdown
            statusBreakdown: chartData.statusBreakdown,
            
            // Hourly distribution
            hourlyDistribution: chartData.hourlyDistribution,
            
            // Duration distribution
            durationDistribution: chartData.durationDistribution,
            
            // Top phone numbers
            topPhoneNumbers: chartData.topPhoneNumbers,
            
            // Recent trends (last 7 days vs previous 7 days)
            recentTrends: chartData.recentTrends
        };
        
    } catch (error) {
        console.error('Error getting enhanced analytics:', error.message);
        return {
            dailyCalls: [],
            dailySuccessRates: [],
            dailyDurations: [],
            statusBreakdown: {},
            hourlyDistribution: {},
            durationDistribution: {},
            topPhoneNumbers: [],
            recentTrends: {}
        };
    }
}

// Process call data for charts
function processCallDataForCharts(calls) {
    const dailyCalls = {};
    const dailySuccessRates = {};
    const dailyDurations = {};
    const statusBreakdown = {};
    const hourlyDistribution = {};
    const durationDistribution = {};
    const phoneNumberCounts = {};
    
    calls.forEach(call => {
        const date = new Date(call.created_at).toISOString().split('T')[0];
        const hour = new Date(call.created_at).getHours();
        const duration = call.duration_seconds || 0;
        const isSuccessful = call.call_result === 'answered'; // Use call_result for success
        const status = call.status || 'unknown';
        
        // Daily calls
        dailyCalls[date] = (dailyCalls[date] || 0) + 1;
        
        // Daily success rates
        if (!dailySuccessRates[date]) {
            dailySuccessRates[date] = { total: 0, successful: 0 };
        }
        dailySuccessRates[date].total++;
        if (isSuccessful) dailySuccessRates[date].successful++;
        
        // Daily durations
        if (!dailyDurations[date]) {
            dailyDurations[date] = { total: 0, sum: 0 };
        }
        dailyDurations[date].total++;
        dailyDurations[date].sum += duration;
        
        // Status breakdown
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
        
        // Hourly distribution
        hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
        
        // Duration distribution (in minutes)
        const durationMinutes = Math.floor(duration / 60);
        const durationBucket = durationMinutes < 1 ? '0-1m' : 
                             durationMinutes < 5 ? '1-5m' :
                             durationMinutes < 10 ? '5-10m' :
                             durationMinutes < 15 ? '10-15m' : '15m+';
        durationDistribution[durationBucket] = (durationDistribution[durationBucket] || 0) + 1;
        
        // Phone number counts
        const phone = call.phone_number || 'unknown';
        phoneNumberCounts[phone] = (phoneNumberCounts[phone] || 0) + 1;
    });
    
    // Convert to arrays for charts
    const dailyCallsArray = Object.entries(dailyCalls).map(([date, count]) => ({ date, count }));
    const dailySuccessRatesArray = Object.entries(dailySuccessRates).map(([date, data]) => ({
        date,
        rate: data.total > 0 ? Math.round((data.successful / data.total) * 100) : 0
    }));
    const dailyDurationsArray = Object.entries(dailyDurations).map(([date, data]) => ({
        date,
        avgDuration: data.total > 0 ? Math.round(data.sum / data.total / 60) : 0
    }));
    
    // Top phone numbers
    const topPhoneNumbers = Object.entries(phoneNumberCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([phone, count]) => ({ phone, count }));
    
    // Recent trends (last 7 days vs previous 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const recentCalls = calls.filter(call => new Date(call.created_at) >= sevenDaysAgo);
    const previousCalls = calls.filter(call => {
        const callDate = new Date(call.created_at);
        return callDate >= fourteenDaysAgo && callDate < sevenDaysAgo;
    });
    
    const recentTrends = {
        recentPeriod: {
            totalCalls: recentCalls.length,
            successfulCalls: recentCalls.filter(call => call.call_result === 'answered').length,
            avgDuration: recentCalls.length > 0 ? 
                Math.round(recentCalls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / recentCalls.length / 60) : 0
        },
        previousPeriod: {
            totalCalls: previousCalls.length,
            successfulCalls: previousCalls.filter(call => call.call_result === 'answered').length,
            avgDuration: previousCalls.length > 0 ? 
                Math.round(previousCalls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / previousCalls.length / 60) : 0
        }
    };
    
    return {
        dailyCalls: dailyCallsArray,
        dailySuccessRates: dailySuccessRatesArray,
        dailyDurations: dailyDurationsArray,
        statusBreakdown,
        hourlyDistribution,
        durationDistribution,
        topPhoneNumbers,
        recentTrends
    };
}

// Get calls by phone number
app.get('/api/calls/phone/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        
        console.log(`📞 Fetching calls for phone: ${phoneNumber}`);
        
        const calls = await supabaseDb.getCallsByPhoneNumber(phoneNumber);
        
        res.json({
            success: true,
            calls: calls,
            count: calls.length,
            phoneNumber: phoneNumber
        });
        
    } catch (error) {
        console.error('❌ Error fetching calls by phone:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch calls: ${error.message}`
        });
    }
});

// ===== CONTACTS API ENDPOINTS =====

// Get all contacts
app.get('/api/contacts', async (req, res) => {
    try {
        const { name, email, company, doNotCall, limit } = req.query;
        
        console.log(`👥 Fetching contacts with filters: name=${name}, email=${email}, company=${company}`);
        
        const contacts = await supabaseDb.getContacts({
            name: name || null,
            email: email || null,
            company: company || null,
            doNotCall: doNotCall === 'true' ? true : (doNotCall === 'false' ? false : undefined),
            limit: limit ? parseInt(limit) : null
        });
        
        res.json({
            success: true,
            contacts: contacts,
            count: contacts.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching contacts:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch contacts: ${error.message}`
        });
    }
});

// Get contact by ID
app.get('/api/contacts/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        
        console.log(`👤 Fetching contact: ${contactId}`);
        
        const contact = await supabaseDb.getContactById(contactId);
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        
        res.json({
            success: true,
            contact: contact
        });
        
    } catch (error) {
        console.error('❌ Error fetching contact:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch contact: ${error.message}`
        });
    }
});

// Delete contact
app.delete('/api/contacts/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        
        console.log(`🗑️ Deleting contact: ${contactId}`);
        
        const result = await supabaseDb.deleteContact(contactId);
        
        res.json({
            success: true,
            message: 'Contact deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting contact:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to delete contact: ${error.message}`
        });
    }
});

// Create new contact
app.post('/api/contacts', async (req, res) => {
    try {
        const { first_name, last_name, email, company_name, position, notes } = req.body;
        
        console.log(`➕ Creating new contact: ${first_name} ${last_name}`);
        
        const contact = await supabaseDb.createContact({
            first_name,
            last_name,
            email,
            company_name,
            position,
            notes
        });
        
        res.json({
            success: true,
            contact: contact,
            message: 'Contact created successfully'
        });
        
    } catch (error) {
        console.error('❌ Error creating contact:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to create contact: ${error.message}`
        });
    }
});

// Update contact
app.put('/api/contacts/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        const updateData = req.body;
        
        console.log(`✏️ Updating contact: ${contactId}`);
        
        const contact = await supabaseDb.updateContact(contactId, updateData);
        
        res.json({
            success: true,
            contact: contact,
            message: 'Contact updated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error updating contact:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to update contact: ${error.message}`
        });
    }
});

// ===== PHONE NUMBERS API ENDPOINTS =====

// Get all phone numbers
app.get('/api/phone-numbers', async (req, res) => {
    try {
        const { phoneNumber, contactId, phoneType, doNotCall, limit } = req.query;
        
        console.log(`📱 Fetching phone numbers with filters: phoneNumber=${phoneNumber}, contactId=${contactId}`);
        
        const phoneNumbers = await supabaseDb.getPhoneNumbers({
            phoneNumber: phoneNumber || null,
            contactId: contactId || null,
            phoneType: phoneType || null,
            doNotCall: doNotCall === 'true' ? true : (doNotCall === 'false' ? false : undefined),
            limit: limit ? parseInt(limit) : null
        });
        
        res.json({
            success: true,
            phoneNumbers: phoneNumbers,
            count: phoneNumbers.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching phone numbers:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch phone numbers: ${error.message}`
        });
    }
});

// Create new phone number
app.post('/api/phone-numbers', async (req, res) => {
    try {
        const { contact_id, phone_number, phone_type, is_primary, do_not_call } = req.body;
        
        console.log(`➕ Creating new phone number: ${phone_number}`);
        
        const phoneNumber = await supabaseDb.createPhoneNumber({
            contact_id,
            phone_number,
            phone_type: phone_type || 'mobile',
            is_primary: is_primary || false,
            do_not_call: do_not_call || false
        });
        
        res.json({
            success: true,
            phoneNumber: phoneNumber,
            message: 'Phone number created successfully'
        });
        
    } catch (error) {
        console.error('❌ Error creating phone number:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to create phone number: ${error.message}`
        });
    }
});

// Get phone number by ID
app.get('/api/phone-numbers/:phoneId', async (req, res) => {
    try {
        const { phoneId } = req.params;
        
        console.log(`📱 Fetching phone number: ${phoneId}`);
        
        const phoneNumber = await supabaseDb.getPhoneNumberById(phoneId);
        
        if (!phoneNumber) {
            return res.status(404).json({
                success: false,
                message: 'Phone number not found'
            });
        }
        
        res.json({
            success: true,
            phoneNumber: phoneNumber
        });
        
    } catch (error) {
        console.error('❌ Error fetching phone number:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch phone number: ${error.message}`
        });
    }
});

// Update phone number
app.put('/api/phone-numbers/:phoneId', async (req, res) => {
    try {
        const { phoneId } = req.params;
        const updateData = req.body;
        
        console.log(`✏️ Updating phone number: ${phoneId}`);
        
        const phoneNumber = await supabaseDb.updatePhoneNumber(phoneId, updateData);
        
        res.json({
            success: true,
            phoneNumber: phoneNumber,
            message: 'Phone number updated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error updating phone number:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to update phone number: ${error.message}`
        });
    }
});

// Delete phone number
app.delete('/api/phone-numbers/:phoneId', async (req, res) => {
    try {
        const { phoneId } = req.params;
        
        console.log(`🗑️ Deleting phone number: ${phoneId}`);
        
        const result = await supabaseDb.deletePhoneNumber(phoneId);
        
        res.json({
            success: true,
            message: 'Phone number deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting phone number:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to delete phone number: ${error.message}`
        });
    }
});

// ===== CALLS BY CONTACT/PHONE API ENDPOINTS =====

// Get calls by contact ID
app.get('/api/contacts/:contactId/calls', async (req, res) => {
    try {
        const { contactId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        
        console.log(`📞 Fetching calls for contact: ${contactId}`);
        
        const calls = await supabaseDb.getCallsByContactId(contactId, {
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
        res.json({
            success: true,
            calls: calls,
            count: calls.length,
            contactId: contactId,
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
    } catch (error) {
        console.error('❌ Error fetching calls by contact:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch calls: ${error.message}`
        });
    }
});

// Get calls by phone number ID
app.get('/api/phone-numbers/:phoneId/calls', async (req, res) => {
    try {
        const { phoneId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        
        console.log(`📞 Fetching calls for phone number: ${phoneId}`);
        
        const calls = await supabaseDb.getCallsByPhoneNumberId(phoneId, {
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
        res.json({
            success: true,
            calls: calls,
            count: calls.length,
            phoneId: phoneId,
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
    } catch (error) {
        console.error('❌ Error fetching calls by phone number:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch calls: ${error.message}`
        });
    }
});

// ===== SEQUENCES API ENDPOINTS =====

// Get all sequences
app.get('/api/sequences', async (req, res) => {
    try {
        const { name, isActive, limit } = req.query;
        
        console.log(`🔄 Fetching sequences with filters: name=${name}, isActive=${isActive}`);
        
        const sequences = await supabaseDb.getSequences({
            name: name || null,
            isActive: isActive === 'true' ? true : (isActive === 'false' ? false : undefined),
            limit: limit ? parseInt(limit) : null
        });
        
        res.json({
            success: true,
            sequences: sequences,
            count: sequences.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching sequences:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch sequences: ${error.message}`
        });
    }
});

// Create new sequence
app.post('/api/sequences', async (req, res) => {
    try {
        const { name, description, max_attempts, retry_delay_hours, is_active } = req.body;
        
        console.log(`➕ Creating new sequence: ${name}`);
        
        const sequence = await supabaseDb.createSequence({
            name,
            description,
            max_attempts: max_attempts || 3,
            retry_delay_hours: retry_delay_hours || 24,
            is_active: is_active !== undefined ? is_active : true
        });
        
        res.json({
            success: true,
            sequence: sequence,
            message: 'Sequence created successfully'
        });
        
    } catch (error) {
        console.error('❌ Error creating sequence:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to create sequence: ${error.message}`
        });
    }
});

// Add phone number to sequence
app.post('/api/sequences/:sequenceId/phone-numbers', async (req, res) => {
    try {
        const { sequenceId } = req.params;
        const { phoneNumberId } = req.body;
        
        console.log(`➕ Adding phone number ${phoneNumberId} to sequence ${sequenceId}`);
        
        const sequenceEntry = await supabaseDb.addPhoneNumberToSequence(sequenceId, phoneNumberId);
        
        res.json({
            success: true,
            sequenceEntry: sequenceEntry,
            message: 'Phone number added to sequence successfully'
        });
        
    } catch (error) {
        console.error('❌ Error adding phone number to sequence:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to add phone number to sequence: ${error.message}`
        });
    }
});

// ===== SEQUENCE MANAGEMENT API ENDPOINTS =====

// Get sequence statistics
app.get('/api/sequences/:sequenceId/statistics', async (req, res) => {
    try {
        const { sequenceId } = req.params;
        
        console.log(`📊 Fetching statistics for sequence: ${sequenceId}`);
        
        const stats = await supabaseDb.getSequenceStatistics(sequenceId);
        
        res.json({
            success: true,
            statistics: stats
        });
        
    } catch (error) {
        console.error('❌ Error fetching sequence statistics:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch sequence statistics: ${error.message}`
        });
    }
});

// Get all sequence statistics
app.get('/api/sequences/statistics', async (req, res) => {
    try {
        console.log(`📊 Fetching all sequence statistics`);
        
        const stats = await supabaseDb.getSequenceStatistics();
        
        res.json({
            success: true,
            statistics: stats
        });
        
    } catch (error) {
        console.error('❌ Error fetching sequence statistics:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch sequence statistics: ${error.message}`
        });
    }
});

// Get batch calling queue
app.get('/api/sequences/batch-queue', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        console.log(`🔄 Fetching batch calling queue (limit: ${limit})`);
        
        const queue = await supabaseDb.getBatchCallingQueue(parseInt(limit));
        
        res.json({
            success: true,
            queue: queue,
            count: queue.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching batch calling queue:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to fetch batch calling queue: ${error.message}`
        });
    }
});

// Update sequence status (pause/resume)
app.put('/api/sequences/:sequenceId/status', async (req, res) => {
    try {
        const { sequenceId } = req.params;
        const { isActive } = req.body;
        
        console.log(`🔄 Updating sequence status: ${sequenceId}, active: ${isActive}`);
        
        const sequence = await supabaseDb.updateSequenceStatus(sequenceId, isActive);
        
        res.json({
            success: true,
            sequence: sequence,
            message: `Sequence ${isActive ? 'activated' : 'paused'} successfully`
        });
        
    } catch (error) {
        console.error('❌ Error updating sequence status:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to update sequence status: ${error.message}`
        });
    }
});

// Update sequence entry after call
app.post('/api/sequences/entries/:entryId/update-after-call', async (req, res) => {
    try {
        const { entryId } = req.params;
        const callResult = req.body;
        
        console.log(`📞 Updating sequence entry after call: ${entryId}`);
        
        const updatedEntry = await supabaseDb.updateSequenceEntryAfterCall(entryId, callResult);
        
        res.json({
            success: true,
            entry: updatedEntry,
            message: 'Sequence entry updated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error updating sequence entry:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to update sequence entry: ${error.message}`
        });
    }
});

// ===== CONTACT UPLOAD API ENDPOINTS =====

// Upload CSV/XLSX file for contacts
app.post('/api/contacts/upload', upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        console.log(`📁 Processing file upload: ${req.file.originalname}`);
        
        let uploadResult;
        
        if (req.file.originalname.endsWith('.xlsx')) {
            // Process XLSX file
            uploadResult = await supabaseDb.processXLSXUpload(req.file.buffer);
        } else {
            // Process CSV file
            const csvContent = req.file.buffer.toString('utf-8');
            uploadResult = await supabaseDb.processCSVUpload(csvContent);
        }
        
        res.json({
            success: true,
            message: 'File uploaded and processed successfully',
            result: uploadResult
        });
        
    } catch (error) {
        console.error('❌ Error processing file upload:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to process file upload: ${error.message}`
        });
    }
});

// Upload CSV/XLSX and add to sequence
app.post('/api/contacts/upload-to-sequence', upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const { sequenceId } = req.body;
        if (!sequenceId) {
            return res.status(400).json({
                success: false,
                message: 'Sequence ID is required'
            });
        }

        console.log(`📁 Processing file upload to sequence: ${req.file.originalname} -> ${sequenceId}`);
        
        let uploadResult;
        
        if (req.file.originalname.endsWith('.xlsx')) {
            // Process XLSX file
            uploadResult = await supabaseDb.processXLSXUploadToSequence(req.file.buffer, sequenceId);
        } else {
            // Process CSV file
            const csvContent = req.file.buffer.toString('utf-8');
            uploadResult = await supabaseDb.processCSVUploadToSequence(csvContent, sequenceId);
        }
        
        res.json({
            success: true,
            message: 'File uploaded and added to sequence successfully',
            result: uploadResult
        });
        
    } catch (error) {
        console.error('❌ Error processing file upload to sequence:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to process file upload: ${error.message}`
        });
    }
});

// Sequence call completion handler
async function handleSequenceCallCompletion(conversationId, callStatus) {
    try {
        console.log(`🔄 Processing sequence call completion: ${conversationId} (${callStatus})`);
        
        // Find the call record
        const call = await supabaseDb.getCallByConversationId(conversationId);
        if (!call) {
            console.log(`⚠️ No call found for conversation: ${conversationId}`);
            return;
        }
        
        // Find sequence entry for this phone number
        const sequenceEntry = await supabaseDb.getSequenceEntryByPhoneNumber(call.phone_number);
        if (!sequenceEntry) {
            console.log(`⚠️ No sequence entry found for phone: ${call.phone_number}`);
            return;
        }
        
        // Determine call result
        const callResult = {
            successful: callStatus === 'completed' && call.duration_seconds > 0,
            status: callStatus,
            duration: call.duration_seconds || 0,
            conversation_id: conversationId
        };
        
        // Update sequence entry
        await supabaseDb.updateSequenceEntryAfterCall(sequenceEntry.id, callResult);
        
        console.log(`✅ Sequence entry updated for call: ${conversationId}`);
        
    } catch (error) {
        console.error('❌ Error handling sequence call completion:', error.message);
    }
}

// Clean up fake calls
app.post('/api/cleanup-fake-calls', async (req, res) => {
    try {
        console.log('🧹 Starting fake call cleanup...');
        const cleanupResult = await callSync.cleanupFakeCalls();
        res.json({
            success: true,
            message: 'Fake call cleanup completed',
            deletedCount: cleanupResult.total_deleted
        });
    } catch (error) {
        console.error('❌ Error cleaning up fake calls:', error.message);
        res.status(500).json({
            success: false,
            message: `Failed to cleanup fake calls: ${error.message}`
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
        
        // Initialize ElevenLabs service
        await elevenLabsService.initialize();
        
        console.log('✅ All services initialized successfully');
        
    } catch (error) {
        console.error('❌ Service initialization failed:', error.message);
        // Continue running server even if some services fail
    }
}

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 ElevenLabs Voice Agent server running on port ${PORT}`);
    console.log(`🌐 Web interface available at: http://localhost:${PORT}`);
    console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
    
    // Initialize services after server starts
    initializeServices();
});
