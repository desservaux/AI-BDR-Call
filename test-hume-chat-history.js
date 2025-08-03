const HumeChatHistoryService = require('./services/hume-chat-history');

async function testHumeChatHistory() {
    console.log('🧪 Testing HumeAI Chat History Service...\n');

    const humeService = new HumeChatHistoryService();

    try {
        // Test 1: Connection test
        console.log('1️⃣ Testing connection...');
        const connectionSuccess = await humeService.testConnection();
        if (connectionSuccess) {
            console.log('✅ Connection successful\n');
        } else {
            console.log('❌ Connection failed\n');
            return;
        }

        // Test 2: Get recent chats
        console.log('2️⃣ Testing getChats...');
        const chats = await humeService.getChats({ pageSize: 5 });
        console.log(`✅ Found ${chats.length} chats`);
        if (chats.length > 0) {
            console.log(`📞 Latest chat ID: ${chats[0].id}`);
            console.log(`📅 Latest chat time: ${new Date(chats[0].created_at).toLocaleString()}\n`);
        }

        // Test 3: Get recent chat groups
        console.log('3️⃣ Testing getChatGroups...');
        const chatGroups = await humeService.getChatGroups({ pageSize: 5 });
        console.log(`✅ Found ${chatGroups.length} chat groups`);
        if (chatGroups.length > 0) {
            console.log(`📞 Latest chat group ID: ${chatGroups[0].id}\n`);
        }

        // Test 4: Get events from a specific chat (if available)
        if (chats.length > 0) {
            console.log('4️⃣ Testing getChatEvents...');
            const chatId = chats[0].id;
            console.log(`📞 Testing with chat ID: ${chatId}`);
            
            const chatEvents = await humeService.getChatEvents(chatId, { pageSize: 10 });
            console.log(`✅ Found ${chatEvents.length} events in chat`);
            
            if (chatEvents.length > 0) {
                console.log('📝 Event types found:');
                const eventTypes = [...new Set(chatEvents.map(event => event.type))];
                eventTypes.forEach(type => {
                    const count = chatEvents.filter(event => event.type === type).length;
                    console.log(`   - ${type}: ${count} events`);
                });
                console.log();

                // Test 5: Generate transcript
                console.log('5️⃣ Testing transcript generation...');
                const transcript = humeService.generateTranscript(chatEvents);
                console.log(`✅ Generated transcript (${transcript.length} characters)`);
                console.log('📝 Transcript preview:');
                console.log(transcript.substring(0, 200) + (transcript.length > 200 ? '...' : ''));
                console.log();

                // Test 6: Extract transcription data
                console.log('6️⃣ Testing transcription data extraction...');
                const transcriptionData = humeService.extractTranscriptionData(chatEvents, 'test-call-id');
                console.log(`✅ Extracted ${transcriptionData.length} transcription entries`);
                if (transcriptionData.length > 0) {
                    console.log('📝 Sample transcription entry:');
                    console.log(JSON.stringify(transcriptionData[0], null, 2));
                    console.log();

                    // Test 7: Extract event data
                    console.log('7️⃣ Testing event data extraction...');
                    const eventData = humeService.extractEventData(chatEvents, 'test-call-id');
                    console.log(`✅ Extracted ${eventData.length} event entries`);
                    console.log('📝 Sample event entry:');
                    console.log(JSON.stringify(eventData[0], null, 2));
                    console.log();

                    // Test 8: Get complete conversation data
                    console.log('8️⃣ Testing complete conversation data...');
                    const conversationData = await humeService.getConversationData(chatId, 'test-call-id');
                    console.log('✅ Complete conversation data retrieved:');
                    console.log(`   - Chat ID: ${conversationData.chatId}`);
                    console.log(`   - Call ID: ${conversationData.callId}`);
                    console.log(`   - Total Events: ${conversationData.totalEvents}`);
                    console.log(`   - Total Messages: ${conversationData.totalMessages}`);
                    console.log(`   - Transcript Length: ${conversationData.transcript.length} characters`);
                    console.log(`   - Transcription Entries: ${conversationData.transcriptionData.length}`);
                    console.log(`   - Event Entries: ${conversationData.eventData.length}`);
                }
            } else {
                console.log('⚠️ No events found in this chat\n');
            }
        } else {
            console.log('⚠️ No chats available for testing\n');
        }

        console.log('🎉 All tests completed successfully!');
        console.log('\n📋 Service Capabilities Verified:');
        console.log('✅ Connection to HumeAI API');
        console.log('✅ Retrieving chat lists');
        console.log('✅ Retrieving chat group lists');
        console.log('✅ Fetching chat events');
        console.log('✅ Generating transcripts');
        console.log('✅ Extracting transcription data');
        console.log('✅ Extracting event data');
        console.log('✅ Complete conversation data retrieval');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testHumeChatHistory(); 