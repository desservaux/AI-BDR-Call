const elevenLabsService = require('./elevenlabs');
const SupabaseDBService = require('./supabase-db');
const geminiAnalysisService = require('./gemini-analysis');
const sequenceManagerService = require('./sequence-manager');

class CallSyncService {
    constructor() {
        this.elevenLabsService = elevenLabsService;
        this.dbService = new SupabaseDBService();
        this.geminiService = geminiAnalysisService;
        this.sequenceManager = sequenceManagerService;
        this.lastSyncTime = null;
        this.syncInProgress = false;
    }

    /**
     * Initialize the sync service
     * @returns {Promise<boolean>} True if initialization is successful
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Call Sync Service...');
            
            // Test ElevenLabs connection
            const elevenLabsTest = await this.elevenLabsService.testConnection();
            if (!elevenLabsTest.success) {
                throw new Error('ElevenLabs service not available');
            }

            // Test database connection
            const dbTest = await this.dbService.testConnection();
            if (!dbTest) {
                throw new Error('Database service not available');
            }

            // Initialize Gemini service (optional - won't fail if API key not set)
            try {
                const geminiTest = await this.geminiService.initialize();
                if (geminiTest) {
                    console.log('✅ Gemini Analysis Service initialized');
                } else {
                    console.log('⚠️ Gemini Analysis Service not available (API key not set)');
                }
            } catch (geminiError) {
                console.log('⚠️ Gemini Analysis Service not available:', geminiError.message);
            }

            // Initialize Sequence Manager service
            try {
                const sequenceTest = await this.sequenceManager.initialize();
                if (sequenceTest) {
                    console.log('✅ Sequence Manager Service initialized');
                } else {
                    console.log('⚠️ Sequence Manager Service not available');
                }
            } catch (sequenceError) {
                console.log('⚠️ Sequence Manager Service not available:', sequenceError.message);
            }

            console.log('✅ Call Sync Service initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Call Sync Service:', error.message);
            return false;
        }
s    }

    /**
     * Sync all conversations from ElevenLabs to our database
     * @param {Object} options - Sync options
     * @param {number} options.limit - Number of conversations to fetch per batch
     * @param {boolean} options.force_full_sync - Force full sync instead of incremental
     * @param {string} options.start_date - Start date for filtering (ISO string)
     * @param {string} options.end_date - End date for filtering (ISO string)
     * @returns {Promise<Object>} Sync results
     */
    async syncAllConversations(options = {}) {
        if (this.syncInProgress) {
            throw new Error('Sync already in progress');
        }

        this.syncInProgress = true;
        const startTime = new Date();

        try {
            console.log('🔄 Starting comprehensive call sync...');
            
            const syncResults = {
                total_conversations: 0,
                new_calls: 0,
                updated_calls: 0,
                external_calls: 0,
                errors: 0,
                sync_duration_ms: 0,
                details: []
            };

            // Fetch all conversations from ElevenLabs
            const conversationsResult = await this.elevenLabsService.getAllConversations({
                limit: options.limit || 100,
                start_date: options.start_date,
                end_date: options.end_date
            });

            if (!conversationsResult.success) {
                throw new Error('Failed to fetch conversations from ElevenLabs');
            }

            syncResults.total_conversations = conversationsResult.conversations.length;
            console.log(`📊 Processing ${syncResults.total_conversations} conversations...`);

            // Process each conversation
            for (const conversation of conversationsResult.conversations) {
                try {
                    const result = await this.processConversation(conversation, options);
                    
                    if (result.is_new) {
                        syncResults.new_calls++;
                    } else if (result.is_updated) {
                        syncResults.updated_calls++;
                    }
                    
                    if (result.is_external) {
                        syncResults.external_calls++;
                    }

                    syncResults.details.push(result);
                } catch (error) {
                    console.error(`❌ Error processing conversation ${conversation.conversation_id}:`, error.message);
                    syncResults.errors++;
                }
            }

            // Update last sync time
            this.lastSyncTime = new Date();
            syncResults.sync_duration_ms = new Date() - startTime;

            console.log(`✅ Sync completed in ${syncResults.sync_duration_ms}ms`);
            console.log(`📊 Results: ${syncResults.new_calls} new, ${syncResults.updated_calls} updated, ${syncResults.external_calls} external, ${syncResults.errors} errors`);

            return syncResults;
        } catch (error) {
            console.error('❌ Sync failed:', error.message);
            throw error;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Process a single conversation and sync it to the database
     * @param {Object} conversation - Conversation data from ElevenLabs
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result
     */
    async processConversation(conversation, options = {}) {
        const result = {
            conversation_id: conversation.conversation_id,
            is_new: false,
            is_updated: false,
            is_external: false,
            error: null
        };

        try {
            // Validate conversation data - only process if it has required fields
            if (!this.isValidCallConversation(conversation)) {
                console.log(`⚠️ Skipping invalid conversation ${conversation.conversation_id} - missing required data`);
                result.error = 'Invalid conversation data';
                return result;
            }

            // Check if conversation already exists in our database
            const existingCall = await this.dbService.getCallByConversationId(conversation.conversation_id);
            
            if (!existingCall) {
                // This is a new conversation - check if it's external
                result.is_external = !this.isInternalCall(conversation);
                result.is_new = true;

                // Create new call record
                const callData = this.convertConversationToCallData(conversation, result.is_external);
                console.log(`📞 Creating call with phone: ${callData.phone_number}, conversation_id: ${callData.elevenlabs_conversation_id}`);
                console.log(`🔍 Raw conversation data: ${JSON.stringify(conversation).substring(0, 200)}...`);
                const createdCall = await this.dbService.createCall(callData);
                
                console.log(`✅ Created new call record: ${createdCall.id} (${result.is_external ? 'external' : 'internal'})`);
                
                // If it's a completed call, get detailed conversation data
                // =========== FIX 1: Broaden condition to fetch details ===========
                if (['done', 'failed', 'processing'].includes(conversation.status) && conversation.call_duration_secs > 0) {
                    await this.processDetailedConversation(conversation.conversation_id, createdCall.id);
                }
            } else {
                // Update existing call if needed
                const needsUpdate = this.needsUpdate(existingCall, conversation);
                if (needsUpdate) {
                    result.is_updated = true;
                    const updateData = this.convertConversationToUpdateData(conversation);
                    await this.dbService.updateCall(existingCall.id, updateData);
                    console.log(`✅ Updated call record: ${existingCall.id}`);
                }
            }
        } catch (error) {
            result.error = error.message;
            throw error;
        }

        return result;
    }

    /**
     * Process detailed conversation data (transcripts, messages, etc.)
     * @param {string} conversationId - ElevenLabs conversation ID
     * @param {string} callId - Our database call ID
     * @returns {Promise<void>}
     */
    async processDetailedConversation(conversationId, callId) {
        try {
            console.log(`📝 Processing detailed conversation data for ${conversationId}...`);
            
            // Get enhanced conversation details
            const conversationData = await this.elevenLabsService.getConversationDetailsEnhanced(conversationId);
            
            if (!conversationData.success) {
                console.warn(`⚠️ Failed to get detailed conversation data for ${conversationId}`);
                return;
            }

            // =========== FIX 2: Update record with final status and success flag ===========
            const updateData = {
                elevenlabs_conversation_id: conversationId,
                phone_number: conversationData.to_number || conversationData.external_number,
                duration_seconds: conversationData.duration,
                message_count: conversationData.message_count,
                start_time: conversationData.start_time,
                call_summary_title: conversationData.call_summary_title,
                transcript_summary: conversationData.transcript_summary,
                updated_at: new Date().toISOString(),
                // Add these crucial fields to save the final, accurate status
                status: this.mapElevenLabsStatus(conversationData.status),
                call_successful: conversationData.call_successful === 'success'
            };
            
            console.log(`🔧 Updating call ${callId} with phone: ${updateData.phone_number}, duration: ${updateData.duration_seconds}s, status: ${updateData.status}, successful: ${updateData.call_successful}`);
            
            await this.dbService.updateCall(callId, updateData);
            console.log(`✅ Updated call ${callId} with detailed information`);

            // Store transcriptions if available
            if (conversationData.transcript && conversationData.transcript.length > 0) {
                const transcriptionData = conversationData.transcript.map(message => ({
                    call_id: callId,
                    speaker: message.speaker,
                    message: message.text,
                    timestamp: message.timestamp,
                    event_type: message.message_type
                }));
                
                await this.dbService.insertTranscriptions(transcriptionData);
                console.log(`✅ Stored ${transcriptionData.length} transcription records`);
            }

            // Store events if available
            if (conversationData.messages && conversationData.messages.length > 0) {
                const eventData = conversationData.messages.map(message => ({
                    call_id: callId,
                    event_type: message.message_type || 'message',
                    event_data: JSON.stringify(message),
                    timestamp: message.timestamp || new Date().toISOString()
                }));
                
                await this.dbService.insertEvents(eventData);
                console.log(`✅ Stored ${eventData.length} event records`);
            }

            // Perform Gemini analysis if service is available and call is worth analyzing
            let analysisResults = null;
            if (this.geminiService.initialized) {
                // Check if call is worth analyzing based on metadata
                const shouldAnalyze = this.shouldAnalyzeCall(conversationData);
                
                if (shouldAnalyze && conversationData.transcript && conversationData.transcript.length > 0) {
                    try {
                        console.log(`🔍 Performing Gemini analysis for ${conversationId}...`);
                        
                        // Create full transcript text
                        const transcriptText = conversationData.transcript
                            .map(message => `${message.speaker}: ${message.text}`)
                            .join('\n');
                        
                        // Prepare metadata for analysis
                        const metadata = {
                            duration_seconds: conversationData.duration,
                            call_summary_title: conversationData.call_summary_title,
                            conversation_id: conversationId,
                            call_id: callId
                        };
                        
                        // Perform analysis
                        const analysis = await this.geminiService.analyzeTranscript(transcriptText, metadata);
                        
                        if (analysis.success) {
                            // Store analysis results in database
                            await this.storeAnalysisResults(callId, analysis.analysis);
                            analysisResults = analysis.analysis;
                            console.log(`✅ Gemini analysis completed and stored for call ${callId}`);
                        } else {
                            console.warn(`⚠️ Gemini analysis failed for call ${callId}`);
                        }
                    } catch (analysisError) {
                        console.error(`❌ Error performing Gemini analysis for ${conversationId}:`, analysisError.message);
                    }
                } else if (!shouldAnalyze) {
                    console.log(`⚠️ Skipping Gemini analysis - call not worth analyzing (${this.getSkipReason(conversationData)})`);
                } else {
                    console.log(`⚠️ Skipping Gemini analysis - no transcript available`);
                }
            } else {
                console.log(`⚠️ Skipping Gemini analysis - service not available`);
            }

            // DISABLED: Apply sequence tracking if service is available
            // Sequence functionality temporarily disabled to focus on ElevenLabs sync
            /*
            if (this.sequenceManager.initialized) {
                try {
                    console.log(`📅 Applying sequence tracking for call ${callId}...`);
                    
                    // Get call data for sequence calculation
                    const callData = {
                        phone_number: conversationData.phone_number || 'unknown',
                        status: conversationData.status
                    };
                    
                    // Calculate next call time based on analysis
                    const sequenceData = await this.sequenceManager.calculateNextCallTime(callData, analysisResults);
                    
                    // Update call with sequence tracking
                    await this.sequenceManager.updateSequenceTracking(callId, sequenceData);
                    console.log(`✅ Sequence tracking applied for call ${callId}`);
                } catch (sequenceError) {
                    console.error(`❌ Error applying sequence tracking for ${conversationId}:`, sequenceError.message);
                }
            } else {
                console.log(`⚠️ Skipping sequence tracking - service not available`);
            }
            */
        } catch (error) {
            console.error(`❌ Error processing detailed conversation ${conversationId}:`, error.message);
        }
    }

    /**
     * Convert ElevenLabs conversation data to our database format
     * @param {Object} conversation - ElevenLabs conversation data
     * @param {boolean} isExternal - Whether this is an external call
     * @returns {Object} Database call data
     */
    convertConversationToCallData(conversation, isExternal) {
        return {
            phone_number: conversation.to_number || conversation.phone_number || 'unknown',
            elevenlabs_conversation_id: conversation.conversation_id,
            status: this.mapElevenLabsStatus(conversation.status),
            call_successful: conversation.call_successful === 'success',
            duration_seconds: conversation.duration || conversation.call_duration_secs || 0,
            message_count: conversation.message_count || 0,
            start_time: conversation.start_time || null,
            call_summary_title: conversation.call_summary_title,
            transcript_summary: conversation.transcript_summary,
            is_external_call: isExternal,
            created_at: conversation.created_at || new Date().toISOString()
        };
    }

    /**
     * Convert conversation data to update format
     * @param {Object} conversation - ElevenLabs conversation data
     * @returns {Object} Update data
     */
    convertConversationToUpdateData(conversation) {
        return {
            phone_number: conversation.to_number || conversation.phone_number,
            status: this.mapElevenLabsStatus(conversation.status),
            call_successful: conversation.call_successful === 'success',
            duration_seconds: conversation.duration || conversation.call_duration_secs,
            message_count: conversation.message_count,
            start_time: conversation.start_time || null,
            call_summary_title: conversation.call_summary_title,
            transcript_summary: conversation.transcript_summary,
            updated_at: new Date().toISOString()
        };
    }

    /**
     * Map ElevenLabs status to our database status
     * @param {string} elevenLabsStatus - ElevenLabs status
     * @returns {string} Our database status
     */
    mapElevenLabsStatus(elevenLabsStatus) {
        switch (elevenLabsStatus) {
            case 'done':
                return 'completed';
            case 'failed':
                return 'failed';
            case 'active':
            case 'in-progress':
                return 'active';
            default:
                return 'unknown';
        }
    }

    /**
     * Check if a call was initiated through our app (internal) or externally
     * @param {Object} conversation - ElevenLabs conversation data
     * @returns {boolean} True if internal call
     */
    isInternalCall(conversation) {
        // For now, we'll consider all calls as potentially external
        // In the future, we can add logic to identify internal calls
        // based on specific patterns or metadata
        return false;
    }

    /**
     * Validate if a conversation should be treated as a real call
     * @param {Object} conversation - ElevenLabs conversation data
     * @returns {boolean} True if valid call conversation
     */
    isValidCallConversation(conversation) {
        // Must have a conversation ID
        if (!conversation.conversation_id) {
            return false;
        }

        // Must have a status
        if (!conversation.status) {
            return false;
        }

        // Only skip if phone number is explicitly "unknown", "test", or empty
        const phoneNumber = conversation.to_number || conversation.phone_number || 
                           (conversation.metadata && conversation.metadata.external_number);
        if (phoneNumber === 'unknown' || phoneNumber === 'test' || phoneNumber === '') {
            return false;
        }

        return true;
    }

    /**
     * Store Gemini analysis results in the database
     * @param {string} callId - Call ID
     * @param {Object} analysis - Analysis results from Gemini
     * @returns {Promise<void>}
     */
    async storeAnalysisResults(callId, analysis) {
        try {
            // Store analysis results in booking_analysis table
            const analysisData = {
                call_id: callId,
                meeting_booked: analysis.meeting_booked,
                person_interested: analysis.person_interested,
                person_very_upset: analysis.person_very_upset,
                confidence_score: analysis.confidence_score,
                key_topics: analysis.key_topics,
                sentiment: analysis.sentiment,
                action_items: analysis.action_items,
                notes: analysis.notes,
                created_at: new Date().toISOString()
            };

            await this.dbService.insertBookingAnalysis(analysisData);
            console.log(`✅ Analysis results stored for call ${callId}`);
        } catch (error) {
            console.error(`❌ Error storing analysis results for call ${callId}:`, error.message);
        }
    }

    /**
     * Determine if a call is worth analyzing with Gemini
     * @param {Object} conversationData - Conversation data from ElevenLabs
     * @returns {boolean} True if call should be analyzed
     */
    shouldAnalyzeCall(conversationData) {
        // Skip if call duration is too short (less than 10 seconds)
        if (conversationData.duration && conversationData.duration < 10) {
            return false;
        }
        
        // Skip if call was unsuccessful
        if (conversationData.call_successful === 'failure') {
            return false;
        }
        
        // Skip if no messages were exchanged
        if (conversationData.message_count && conversationData.message_count < 2) {
            return false;
        }
        
        // Skip if call status indicates failure
        if (conversationData.status === 'failed') {
            return false;
        }
        
        // Skip voicemail or automated responses
        if (conversationData.call_summary_title && 
            (conversationData.call_summary_title.toLowerCase().includes('voicemail') ||
             conversationData.call_summary_title.toLowerCase().includes('automated'))) {
            return false;
        }
        
        return true;
    }

    /**
     * Get the reason why a call was skipped for analysis
     * @param {Object} conversationData - Conversation data from ElevenLabs
     * @returns {string} Reason for skipping
     */
    getSkipReason(conversationData) {
        if (conversationData.duration && conversationData.duration < 10) {
            return `duration too short (${conversationData.duration}s)`;
        }
        
        if (conversationData.call_successful === 'failure') {
            return 'call unsuccessful';
        }
        
        if (conversationData.message_count && conversationData.message_count < 2) {
            return `insufficient messages (${conversationData.message_count})`;
        }
        
        if (conversationData.status === 'failed') {
            return 'call failed';
        }
        
        if (conversationData.call_summary_title && 
            (conversationData.call_summary_title.toLowerCase().includes('voicemail') ||
             conversationData.call_summary_title.toLowerCase().includes('automated'))) {
            return 'voicemail/automated response';
        }
        
        return 'unknown reason';
    }

    /**
     * Check if an existing call needs to be updated
     * @param {Object} existingCall - Existing call from database
     * @param {Object} conversation - ElevenLabs conversation data
     * @returns {boolean} True if update is needed
     */
    needsUpdate(existingCall, conversation) {
        // Check if any important fields have changed
        const newStatus = this.mapElevenLabsStatus(conversation.status);
        const newSuccessful = conversation.call_successful === 'success';
        const newDuration = conversation.call_duration_secs || 0;
        const newMessageCount = conversation.message_count || 0;

        return (
            existingCall.status !== newStatus ||
            existingCall.call_successful !== newSuccessful ||
            existingCall.duration_seconds !== newDuration ||
            existingCall.message_count !== newMessageCount ||
            existingCall.call_summary_title !== conversation.call_summary_title
        );
    }

    /**
     * Get sync statistics
     * @returns {Promise<Object>} Sync statistics
     */
    async getSyncStatistics() {
        try {
            const stats = await this.dbService.getCallStatistics();
            return {
                total_calls: stats.total_calls || 0,
                internal_calls: stats.internal_calls || 0,
                external_calls: stats.external_calls || 0,
                successful_calls: stats.successful_calls || 0,
                failed_calls: stats.failed_calls || 0,
                average_duration: stats.average_duration || 0,
                last_sync_time: this.lastSyncTime,
                sync_in_progress: this.syncInProgress
            };
        } catch (error) {
            console.error('Error getting sync statistics:', error.message);
            throw error;
        }
    }

    /**
     * Clean up fake calls from the database
     * @returns {Promise<Object>} Cleanup results
     */
    async cleanupFakeCalls() {
        try {
            console.log('🧹 Cleaning up fake calls from database...');
            
            const cleanupResults = {
                total_deleted: 0,
                errors: []
            };

            // Delete calls with null conversation_id (these are fake calls)
            const fakeCallCriteria = {
                elevenlabs_conversation_id: null
            };

            const deletedCalls = await this.dbService.deleteCallsByCriteria(fakeCallCriteria);
            cleanupResults.total_deleted = deletedCalls;

            console.log(`✅ Cleaned up ${cleanupResults.total_deleted} fake calls`);
            return cleanupResults;
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
            throw error;
        }
    }


}

module.exports = new CallSyncService(); 