require('dotenv').config();

const supabaseDb = require('./services/supabase-db');
const elevenLabsService = require('./services/elevenlabs');
const geminiService = require('./services/gemini-analysis');

async function reAnalyzeAllCalls() {
    console.log('🔄 Starting Gemini re-analysis for all calls...');
    
    try {
        // Initialize services
        const dbService = new supabaseDb();
        
        // Initialize Gemini service
        const geminiInitialized = await geminiService.initialize();
        if (!geminiInitialized) {
            console.log('⚠️ Gemini service not available, skipping analysis');
            return;
        }
        
        // Get all calls from database
        console.log('📊 Fetching all calls from database...');
        const calls = await dbService.getAllCalls();
        console.log(`📊 Found ${calls.length} calls to analyze`);
        
        if (calls.length === 0) {
            console.log('⚠️ No calls found in database');
            return;
        }
        
        let analyzedCount = 0;
        let errorCount = 0;
        
        for (const call of calls) {
            console.log(`\n📞 Analyzing call: ${call.id}`);
            
            if (!call.elevenlabs_conversation_id) {
                console.log(`⚠️ Skipping call ${call.id} - no conversation ID`);
                continue;
            }
            
            try {
                // Get call details with transcriptions
                const callDetails = await dbService.getCallDetails(call.id);
                
                if (!callDetails.transcriptions || callDetails.transcriptions.length === 0) {
                    console.log(`⚠️ No transcriptions available for call ${call.id}`);
                    continue;
                }
                
                // Create transcript text for analysis
                const transcriptText = callDetails.transcriptions
                    .map(message => `${message.speaker}: ${message.message}`)
                    .join('\n');
                
                console.log(`📝 Transcript length: ${transcriptText.length} characters`);
                console.log(`📝 First few lines: ${transcriptText.substring(0, 200)}...`);
                
                // Prepare metadata for analysis
                const metadata = {
                    duration_seconds: call.duration_seconds,
                    call_summary_title: call.call_summary_title,
                    conversation_id: call.elevenlabs_conversation_id,
                    call_id: call.id
                };
                
                // Perform Gemini analysis
                console.log(`🔍 Performing Gemini analysis for call ${call.id}...`);
                const analysis = await geminiService.analyzeTranscript(transcriptText, metadata);
                
                if (analysis.success) {
                    // Store analysis results in database
                    await dbService.insertBookingAnalysis({
                        call_id: call.id,
                        meeting_booked: analysis.analysis.meeting_booked,
                        person_interested: analysis.analysis.person_interested,
                        person_very_upset: analysis.analysis.person_very_upset,
                        confidence_score: analysis.analysis.confidence_score,
                        key_topics: analysis.analysis.key_topics,
                        sentiment: analysis.analysis.sentiment,
                        action_items: analysis.analysis.action_items,
                        notes: analysis.analysis.notes
                    });
                    
                    console.log(`✅ Analysis completed for call ${call.id}:`);
                    console.log(`   - Meeting booked: ${analysis.analysis.meeting_booked}`);
                    console.log(`   - Person interested: ${analysis.analysis.person_interested}`);
                    console.log(`   - Person upset: ${analysis.analysis.person_very_upset}`);
                    console.log(`   - Confidence: ${analysis.analysis.confidence_score}`);
                    
                    analyzedCount++;
                } else {
                    console.warn(`⚠️ Gemini analysis failed for call ${call.id}`);
                    errorCount++;
                }
                
                // Small delay to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Error analyzing call ${call.id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n📊 Re-analysis complete!`);
        console.log(`✅ Successfully analyzed: ${analyzedCount} calls`);
        console.log(`❌ Errors: ${errorCount} calls`);
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
    }
}

// Run the re-analysis
reAnalyzeAllCalls().then(() => {
    console.log('🏁 Script completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
}); 