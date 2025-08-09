const DbService = require('./services/db/DbService');
const supabaseDb = new DbService();
const elevenLabsService = require('./services/elevenlabs');

// Initialize the database service
const dbService = new supabaseDb();

async function updateAllTranscripts() {
    console.log('🔄 Starting transcript update for all calls...');
    
    try {
        // Get all calls from database
        console.log('📊 Fetching all calls from database...');
        const calls = await dbService.getAllCalls();
        console.log(`📊 Found ${calls.length} calls to update`);
        
        if (calls.length === 0) {
            console.log('⚠️ No calls found in database');
            return;
        }
        
        let updatedCount = 0;
        let errorCount = 0;
        
        for (const call of calls) {
            console.log(`\n📞 Processing call: ${call.id}`);
            console.log(`📞 Call details:`, JSON.stringify(call, null, 2));
            
            if (!call.elevenlabs_conversation_id) {
                console.log(`⚠️ Skipping call ${call.id} - no conversation ID`);
                continue;
            }
            
            try {
                console.log(`📝 Updating transcript for call ${call.id} (${call.elevenlabs_conversation_id})`);
                
                // Fetch fresh transcript from ElevenLabs
                const elevenLabsDetails = await elevenLabsService.getConversationDetailsEnhanced(call.elevenlabs_conversation_id);
                
                if (elevenLabsDetails.success && elevenLabsDetails.transcript && elevenLabsDetails.transcript.length > 0) {
                    // Delete existing transcriptions for this call
                    await dbService.deleteTranscriptionsForCall(call.id);
                    
                    // Create new transcriptions with correct parsing
                    const transcriptions = elevenLabsDetails.transcript.map(message => ({
                        call_id: call.id,
                        speaker: message.speaker || 'unknown',
                        message: message.text || '',
                        timestamp: message.timestamp || new Date().toISOString(),
                        event_type: message.message_type || 'text'
                    }));
                    
                    // Insert new transcriptions
                    await dbService.insertTranscriptions(transcriptions);
                    
                    console.log(`✅ Updated ${transcriptions.length} transcriptions for call ${call.id}`);
                    updatedCount++;
                } else {
                    console.log(`⚠️ No transcript available for call ${call.id}`);
                }
                
                // Small delay to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Error updating call ${call.id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n📊 Update complete!`);
        console.log(`✅ Successfully updated: ${updatedCount} calls`);
        console.log(`❌ Errors: ${errorCount} calls`);
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
    }
}

// Run the update
console.log('🚀 Starting transcript update script...');

updateAllTranscripts().then(() => {
    console.log('🏁 Script completed successfully');
    process.exit(0);
}).catch(error => {
    console.error('💥 Script failed with error:', error);
    process.exit(1);
}); 