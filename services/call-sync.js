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
            // Early skip of non-final calls - do not persist anything
            if (['initiated', 'in-progress', 'processing'].includes(conversation.status)) {
                console.log(`⏭️ Skipping non-final call ${conversation.conversation_id} with status: ${conversation.status}`);
                result.error = 'Non-final call status';
                return result;
            }

            // Only process final calls: done, failed
            if (!['done', 'failed'].includes(conversation.status)) {
                console.log(`⚠️ Skipping non-final call ${conversation.conversation_id} with status: ${conversation.status}`);
                result.error = 'Non-final call status';
                return result;
            }

            // For final calls, ALWAYS get detailed data first to get phone number
            console.log(`📞 Fetching detailed data for final call ${conversation.conversation_id}...`);
            const details = await this.elevenLabsService.getConversationDetailsEnhanced(conversation.conversation_id);
            
            if (!details.success) {
                result.error = 'Failed to get conversation details';
                return result;
            }
            
            // Now we have the real phone number from details
            const phoneNumber = details.to_number || 'unknown';
            console.log(`📞 Phone number for ${conversation.conversation_id}: ${phoneNumber}`);

            // Check if conversation already exists in our database
            const existingCall = await this.dbService.getCallByConversationId(conversation.conversation_id);
            
            if (existingCall) {
                // Call exists - process detailed conversation
                console.log(`📋 Processing detailed conversation for existing call ${conversation.conversation_id}...`);
                await this.processDetailedConversation(conversation.conversation_id, existingCall.id);
                result.is_updated = true;
            } else {
                // Create minimal row for new final call with correct phone number
                console.log(`📞 Creating minimal call record for ${conversation.conversation_id}...`);
                
                const callData = {
                    elevenlabs_conversation_id: conversation.conversation_id,
                    phone_number: phoneNumber, // Now we have the real number!
                    agent_id: details.agent_id,
                    agent_name: conversation.agent_name,
                    created_at: new Date().toISOString()
                };
                
                const createdCall = await this.dbService.createCall(callData);
                console.log(`✅ Created minimal call record: ${createdCall.id} with phone: ${phoneNumber}`);
                
                // Immediately process detailed conversation
                await this.processDetailedConversation(conversation.conversation_id, createdCall.id);
                result.is_new = true;
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
            
            // Fetch enhanced details
            const conversationData = await this.elevenLabsService.getConversationDetailsEnhanced(conversationId);
            
            if (!conversationData.success) {
                console.warn(`⚠️ Failed to get detailed conversation data for ${conversationId}`);
                return;
            }

            // FIRST compute call_result
            const call_result = this.elevenLabsService.computeOutcomeFrom(conversationData.status_raw, conversationData.duration);
            
            // If call_result is null (shouldn't happen here because we only reach this for final calls), abort
            if (call_result === null) {
                console.warn(`⚠️ Unexpected null call_result for final call ${conversationId}, aborting`);
                return;
            }

            // THEN build consolidatedData with the computed call_result
            const consolidatedData = {
                status_raw: conversationData.status_raw,
                start_time: conversationData.start_time,
                duration: conversationData.duration,
                to_number: conversationData.to_number,
                message_count: conversationData.message_count,
                transcript: conversationData.transcript,
                transcript_summary: conversationData.transcript_summary,
                call_summary_title: conversationData.call_summary_title,
                call_result: call_result // Add the computed result
            };
            
            // Update call with consolidated data
            const updateData = {
                phone_number: consolidatedData.to_number || 'unknown',
                start_time: consolidatedData.start_time,
                duration_seconds: consolidatedData.duration,
                message_count: consolidatedData.message_count,
                transcript_summary: consolidatedData.transcript_summary,
                call_summary_title: consolidatedData.call_summary_title,
                call_result: call_result, // Only write call_result, not status or answered
                updated_at: new Date().toISOString()
            };
            
            console.log(`🔧 Updating call ${callId} with phone: ${updateData.phone_number}, duration: ${updateData.duration_seconds}s, call_result: ${updateData.call_result}`);
            
            await this.dbService.updateCall(callId, updateData);
            console.log(`✅ Updated call ${callId} with detailed information`);

            // Replace transcriptions: delete by call_id; insert mapped transcript
            if (consolidatedData.transcript && consolidatedData.transcript.length > 0) {
                const transcriptionData = consolidatedData.transcript.map(message => ({
                    call_id: callId,
                    speaker: message.speaker,
                    message: message.text,
                    timestamp: message.timestamp || new Date().toISOString(),
                    event_type: message.message_type || 'message'
                }));

                // Clear existing transcriptions for this call
                await this.dbService.deleteTranscriptionsByCallId(callId);
                
                // Insert new transcriptions
                if (transcriptionData.length > 0) {
                    await this.dbService.createTranscriptions(transcriptionData);
                    console.log(`✅ Stored ${transcriptionData.length} transcriptions for call ${callId}`);
                }
            }

            // NOW you can check shouldAnalyzeCall with the correct data including call_result
            if (this.shouldAnalyzeCall(consolidatedData)) {
                try {
                    console.log(`🧠 Triggering Gemini analysis for call ${callId}...`);
                    const analysis = await this.geminiService.analyzeCall(consolidatedData.transcript);
                    
                    if (analysis) {
                        await this.storeAnalysisResults(callId, analysis);
                        console.log(`✅ Gemini analysis completed for call ${callId}`);
                    }
                } catch (analysisError) {
                    console.warn(`⚠️ Gemini analysis failed for call ${callId}:`, analysisError.message);
                }
            } else {
                console.log(`⏭️ Skipping Gemini analysis for call ${callId}: ${this.getSkipReason(consolidatedData)}`);
            }

            // PHASE 23: Duration-based cleanup trigger
            const DURATION_THRESHOLD_SECONDS = 7;
            if (consolidatedData.duration && consolidatedData.duration > DURATION_THRESHOLD_SECONDS) {
                console.log(`✅ Call duration (${consolidatedData.duration}s) exceeded threshold. Triggering sequence cleanup for ${consolidatedData.to_number}.`);
                try {
                    await this.sequenceManager.handleSuccessfulCall(consolidatedData.to_number);
                } catch (cleanupError) {
                    console.warn(`⚠️ Sequence cleanup failed for ${consolidatedData.to_number}:`, cleanupError.message);
                }
            }
        } catch (error) {
            console.error(`❌ Error processing detailed conversation ${conversationId}:`, error.message);
            throw error;
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
        // Make sure conversationData has call_result computed
        if (!conversationData.call_result) {
            return false;
        }
        
        // Skip if call duration is too short (less than 10 seconds)
        if (conversationData.duration && conversationData.duration < 10) {
            return false;
        }
        
        // Skip if call_result is 'failed'
        if (conversationData.call_result === 'failed') {
            return false;
        }
        
        // Skip if no messages were exchanged (less than 2 messages)
        if (conversationData.message_count && conversationData.message_count < 2) {
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
        if (!conversationData.call_result) {
            return 'call_result not computed';
        }
        
        if (conversationData.duration && conversationData.duration < 10) {
            return `duration too short (${conversationData.duration}s)`;
        }
        
        if (conversationData.call_result === 'failed') {
            return 'call_result is failed';
        }
        
        if (conversationData.message_count && conversationData.message_count < 2) {
            return `insufficient messages (${conversationData.message_count})`;
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
        const newCallResult = conversation.call_result;
        const newDuration = conversation.duration || conversation.call_duration_secs || 0;
        const newMessageCount = conversation.message_count || 0;

        return (
            existingCall.call_result !== newCallResult ||
            existingCall.duration_seconds !== newDuration ||
            existingCall.message_count !== newMessageCount ||
            existingCall.phone_number !== (conversation.to_number || conversation.phone_number)
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