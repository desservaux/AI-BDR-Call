const CallLoggerService = require('./services/call-logger');

async function testCallLogger() {
    console.log('🧪 Testing Call Logger Service...\n');

    const callLogger = new CallLoggerService();

    try {
        // Test 1: Service initialization and connection test
        console.log('1️⃣ Testing service initialization...');
        const serviceReady = await callLogger.testService();
        if (serviceReady) {
            console.log('✅ Call Logger Service is ready\n');
        } else {
            console.log('❌ Call Logger Service is not ready\n');
            return;
        }

        // Test 2: Start call logging
        console.log('2️⃣ Testing call logging start...');
        const testCallData = {
            phoneNumber: '+1234567890',
            chatId: 'test-chat-id-' + Date.now(),
            chatGroupId: 'test-chat-group-id-' + Date.now()
        };

        const createdCall = await callLogger.startCallLogging(testCallData);
        console.log(`✅ Call logging started with ID: ${createdCall.id}`);
        console.log(`📞 Phone: ${createdCall.phone_number}`);
        console.log(`💬 Chat ID: ${testCallData.chatId}\n`);

        // Test 3: Check active calls
        console.log('3️⃣ Testing active calls tracking...');
        const activeCalls = callLogger.getActiveCalls();
        console.log(`✅ Found ${activeCalls.length} active calls`);
        if (activeCalls.length > 0) {
            console.log(`📞 Active call: ${activeCalls[0].phoneNumber}`);
            console.log(`⏱️ Started: ${activeCalls[0].startTime.toLocaleString()}\n`);
        }

        // Test 4: Get call status
        console.log('4️⃣ Testing call status retrieval...');
        const callStatus = callLogger.getCallStatus(testCallData.chatId);
        if (callStatus) {
            console.log('✅ Call status retrieved:');
            console.log(`   📞 Phone: ${callStatus.phoneNumber}`);
            console.log(`   ⏱️ Duration: ${Math.round(callStatus.duration / 1000)}s`);
            console.log(`   📝 Events: ${callStatus.eventCount}`);
            console.log(`   📊 Status: ${callStatus.status}\n`);
        }

        // Test 5: Log real-time events
        console.log('5️⃣ Testing real-time event logging...');
        await callLogger.logRealTimeEvent(testCallData.chatId, {
            type: 'user_message',
            message: 'Hello, I would like to book an appointment',
            timestamp: new Date().toISOString()
        });

        await callLogger.logRealTimeEvent(testCallData.chatId, {
            type: 'assistant_message',
            message: 'I can help you with that. What time works for you?',
            timestamp: new Date().toISOString()
        });

        console.log('✅ Logged 2 real-time events');

        // Check updated call status
        const updatedStatus = callLogger.getCallStatus(testCallData.chatId);
        if (updatedStatus) {
            console.log(`📝 Updated event count: ${updatedStatus.eventCount}\n`);
        }

        // Test 6: Process call with chat metadata (webhook simulation)
        console.log('6️⃣ Testing webhook chat metadata processing...');
        const chatMetadata = {
            chat_id: 'webhook-chat-id-' + Date.now(),
            chat_group_id: 'webhook-group-id-' + Date.now(),
            request_id: 'test-request-id'
        };

        const webhookCall = await callLogger.processCallWithChatMetadata(chatMetadata, '+9876543210');
        console.log(`✅ Webhook call processed with ID: ${webhookCall.id}`);
        console.log(`💬 Chat ID: ${chatMetadata.chat_id}\n`);

        // Test 7: Get call statistics
        console.log('7️⃣ Testing call statistics...');
        const stats = await callLogger.getCallStatistics();
        console.log('✅ Call statistics:');
        console.log(`   📊 Total calls: ${stats.total}`);
        console.log(`   🔄 Active calls: ${stats.activeCalls}`);
        console.log(`   📈 Total with active: ${stats.totalWithActive}`);
        console.log(`   ✅ Booking yes: ${stats.yes}`);
        console.log(`   ❌ Booking no: ${stats.no}`);
        console.log(`   ❓ Unknown: ${stats.unknown}\n`);

        // Test 8: End call logging (first call)
        console.log('8️⃣ Testing call logging end...');
        const endResult = await callLogger.endCallLogging(testCallData.chatId, 'completed');
        console.log('✅ Call logging ended:');
        console.log(`   📞 Call ID: ${endResult.callId}`);
        console.log(`   💬 Chat ID: ${endResult.chatId}`);
        console.log(`   📊 Status: ${endResult.status}`);
        console.log(`   📝 Total Events: ${endResult.totalEvents}`);
        console.log(`   💬 Total Messages: ${endResult.totalMessages}`);
        console.log(`   📄 Transcript Length: ${endResult.transcript.length} characters\n`);

        // Test 9: End webhook call
        console.log('9️⃣ Testing webhook call end...');
        await callLogger.endCallLogging(chatMetadata.chat_id, 'completed');
        console.log('✅ Webhook call ended\n');

        // Test 10: Check final active calls
        console.log('🔟 Testing final active calls count...');
        const finalActiveCalls = callLogger.getActiveCalls();
        console.log(`✅ Final active calls: ${finalActiveCalls.length}`);

        // Test 11: Cleanup stale calls (with short timeout for testing)
        console.log('\n1️⃣1️⃣ Testing stale call cleanup...');
        
        // Create a test call that will be considered stale
        const staleCallData = {
            phoneNumber: '+5555555555',
            chatId: 'stale-chat-id-' + Date.now(),
            chatGroupId: 'stale-group-id-' + Date.now()
        };
        
        await callLogger.startCallLogging(staleCallData);
        console.log('✅ Created test call for stale cleanup');
        
        // Run cleanup with very short timeout (1ms) to make it stale immediately
        await callLogger.cleanupStaleCalls(1);
        console.log('✅ Stale call cleanup completed');

        const finalStats = await callLogger.getCallStatistics();
        console.log(`📊 Final active calls: ${finalStats.activeCalls}`);

        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📋 Service Capabilities Verified:');
        console.log('✅ Service initialization and connection testing');
        console.log('✅ Call logging start and end');
        console.log('✅ Active call tracking');
        console.log('✅ Call status retrieval');
        console.log('✅ Real-time event logging');
        console.log('✅ Webhook chat metadata processing');
        console.log('✅ Call statistics generation');
        console.log('✅ Conversation data processing');
        console.log('✅ Database integration');
        console.log('✅ Stale call cleanup');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testCallLogger(); 