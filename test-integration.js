const HumeChatHistoryService = require('./services/hume-chat-history');
const SupabaseDBService = require('./services/supabase-db');

async function testIntegration() {
    console.log('🧪 Testing HumeAI + Supabase Integration...\n');

    const humeService = new HumeChatHistoryService();
    const dbService = new SupabaseDBService();

    try {
        // Test 1: Service connections
        console.log('1️⃣ Testing service connections...');
        
        const humeConnection = await humeService.testConnection();
        const dbConnection = await dbService.testConnection();
        
        if (humeConnection && dbConnection) {
            console.log('✅ Both services connected successfully\n');
        } else {
            console.log('❌ One or more services failed to connect\n');
            return;
        }

        // Test 2: Get recent chats from HumeAI
        console.log('2️⃣ Getting recent chats from HumeAI...');
        const chats = await humeService.getChats({ pageSize: 5 });
        console.log(`✅ Found ${chats.length} chats from HumeAI`);
        
        if (chats.length === 0) {
            console.log('⚠️ No chats available for testing. Please make some calls first.\n');
            console.log('📋 Integration Test Summary:');
            console.log('✅ HumeAI service connection');
            console.log('✅ Supabase database connection');
            console.log('⚠️ No chat data available for full integration test');
            return;
        }

        // Test 3: Process a real chat
        console.log('3️⃣ Processing a real chat...');
        const chatId = chats[0].id;
        console.log(`📞 Using chat ID: ${chatId}`);
        
        // Create a test call in database
        const testCallData = {
            phoneNumber: '+1234567890',
            chatId: chatId,
            chatGroupId: chats[0].chat_group_id || 'test-group',
            status: 'active'
        };

        const createdCall = await dbService.createCall(testCallData);
        console.log(`✅ Created call record with ID: ${createdCall.id}`);

        // Get conversation data from HumeAI
        const conversationData = await humeService.getConversationData(chatId, createdCall.id);
        console.log(`✅ Retrieved conversation data:`);
        console.log(`   📝 Total events: ${conversationData.totalEvents}`);
        console.log(`   💬 Total messages: ${conversationData.totalMessages}`);
        console.log(`   📄 Transcript length: ${conversationData.transcript.length} characters`);

        // Test 4: Store transcriptions in database
        console.log('\n4️⃣ Storing transcriptions in database...');
        if (conversationData.transcriptionData.length > 0) {
            const insertedTranscriptions = await dbService.insertTranscriptions(conversationData.transcriptionData);
            console.log(`✅ Stored ${insertedTranscriptions.length} transcription records`);
        } else {
            console.log('⚠️ No transcription data to store');
        }

        // Test 5: Store events in database
        console.log('\n5️⃣ Storing events in database...');
        if (conversationData.eventData.length > 0) {
            const insertedEvents = await dbService.insertEvents(conversationData.eventData);
            console.log(`✅ Stored ${insertedEvents.length} event records`);
        } else {
            console.log('⚠️ No event data to store');
        }

        // Test 6: Update call status
        console.log('\n6️⃣ Updating call status...');
        const updatedCall = await dbService.updateCallStatus(createdCall.id, 'completed');
        console.log(`✅ Call status updated to: ${updatedCall.status}`);

        // Test 7: Retrieve call from database
        console.log('\n7️⃣ Retrieving call from database...');
        const callDetails = await dbService.getCallDetails(createdCall.id);
        console.log('✅ Call details retrieved:');
        console.log(`   📞 Phone: ${callDetails.call.phone_number}`);
        console.log(`   📅 Start: ${new Date(callDetails.call.start_time).toLocaleString()}`);
        console.log(`   📅 End: ${callDetails.call.end_time ? new Date(callDetails.call.end_time).toLocaleString() : 'N/A'}`);
        console.log(`   📝 Transcriptions: ${callDetails.transcriptions.length}`);
        console.log(`   📊 Events: ${callDetails.events ? callDetails.events.length : 0}`);

        // Test 8: Generate transcript comparison
        console.log('\n8️⃣ Comparing transcripts...');
        const humeTranscript = conversationData.transcript;
        const dbTranscript = callDetails.transcriptions
            .map(t => `[${new Date(t.timestamp).toLocaleString()}] ${t.speaker}: ${t.message}`)
            .join('\n');
        
        console.log('📝 HumeAI transcript preview:');
        console.log(humeTranscript.substring(0, 200) + (humeTranscript.length > 200 ? '...' : ''));
        console.log('\n📝 Database transcript preview:');
        console.log(dbTranscript.substring(0, 200) + (dbTranscript.length > 200 ? '...' : ''));
        console.log();

        // Test 9: Test call filtering
        console.log('\n9️⃣ Testing call filtering...');
        const filteredCalls = await dbService.getCalls({ limit: 5 });
        console.log(`✅ Retrieved ${filteredCalls.length} calls from database`);
        
        if (filteredCalls.length > 0) {
            console.log('📋 Recent calls:');
            filteredCalls.slice(0, 3).forEach((call, index) => {
                console.log(`   ${index + 1}. ${call.phone_number} - ${call.booking_outcome || 'unknown'} - ${call.status}`);
            });
        }

        // Test 10: Test statistics
        console.log('\n🔟 Testing statistics...');
        const stats = await dbService.getCallStatistics();
        console.log('✅ Call statistics:');
        console.log(`   📊 Total calls: ${stats.total}`);
        console.log(`   ✅ Booking yes: ${stats.yes}`);
        console.log(`   ❌ Booking no: ${stats.no}`);
        console.log(`   ❓ Unknown: ${stats.unknown}`);

        console.log('\n🎉 Integration test completed successfully!');
        console.log('\n📋 Integration Capabilities Verified:');
        console.log('✅ HumeAI chat history retrieval');
        console.log('✅ Supabase database storage');
        console.log('✅ Transcription data processing');
        console.log('✅ Event data processing');
        console.log('✅ Call lifecycle management');
        console.log('✅ Data retrieval and filtering');
        console.log('✅ Statistics generation');
        console.log('✅ Real conversation data handling');

    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the integration test
testIntegration(); 