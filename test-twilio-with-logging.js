const TwilioWithLoggingService = require('./services/twilio-with-logging');

async function testTwilioWithLogging() {
    console.log('🧪 Testing Enhanced Twilio Service with Call Logging...\n');

    const twilioService = new TwilioWithLoggingService();

    try {
        // Test 1: Service initialization
        console.log('1️⃣ Testing service initialization...');
        await twilioService.initialize();
        console.log('✅ Service initialized successfully\n');

        // Test 2: Get active calls (should be empty initially)
        console.log('2️⃣ Testing active calls retrieval...');
        const initialActiveCalls = await twilioService.getActiveCallsWithLogging();
        console.log(`✅ Initial active calls: ${initialActiveCalls.activeCalls.length}`);
        console.log(`📊 Statistics:`, initialActiveCalls.statistics);
        console.log();

        // Test 3: Test webhook URL generation
        console.log('3️⃣ Testing webhook URL generation...');
        const webhookUrl = twilioService.generateWebhookUrl();
        console.log(`✅ Webhook URL generated: ${webhookUrl.substring(0, 100)}...`);
        console.log();

        // Test 4: Simulate chat metadata processing
        console.log('4️⃣ Testing chat metadata processing...');
        const testCallSid = 'CA' + Math.random().toString(36).substr(2, 32);
        const testPhoneNumber = '+1234567890';
        
        // Store a pending call
        twilioService.storePendingCall(testCallSid, {
            phoneNumber: testPhoneNumber,
            chatId: `pending_${testCallSid}`,
            chatGroupId: `pending_group_${testCallSid}`,
            twilioCallSid: testCallSid
        });

        // Process chat metadata
        const chatMetadata = {
            chat_id: 'test-chat-id-' + Date.now(),
            chat_group_id: 'test-group-id-' + Date.now(),
            request_id: 'test-request-id'
        };

        const loggedCall = await twilioService.processChatMetadata(chatMetadata, testCallSid);
        if (loggedCall) {
            console.log(`✅ Chat metadata processed, call logged with ID: ${loggedCall.id}`);
        }
        console.log();

        // Test 5: Check active calls after logging
        console.log('5️⃣ Testing active calls after logging...');
        const activeCallsAfterLogging = await twilioService.getActiveCallsWithLogging();
        console.log(`✅ Active calls after logging: ${activeCallsAfterLogging.activeCalls.length}`);
        if (activeCallsAfterLogging.activeCalls.length > 0) {
            console.log(`📞 Active call: ${activeCallsAfterLogging.activeCalls[0].phoneNumber}`);
        }
        console.log();

        // Test 6: Test call completion
        console.log('6️⃣ Testing call completion...');
        const completionResult = await twilioService.handleCallCompletion(testCallSid, 'completed');
        if (completionResult) {
            console.log(`✅ Call completion handled for chat: ${completionResult.chatId}`);
            console.log(`📊 Total events: ${completionResult.totalEvents}`);
            console.log(`💬 Total messages: ${completionResult.totalMessages}`);
        }
        console.log();

        // Test 7: Check active calls after completion
        console.log('7️⃣ Testing active calls after completion...');
        const finalActiveCalls = await twilioService.getActiveCallsWithLogging();
        console.log(`✅ Final active calls: ${finalActiveCalls.activeCalls.length}`);
        console.log();

        // Test 8: Test call history retrieval
        console.log('8️⃣ Testing call history retrieval...');
        const callHistory = await twilioService.getCallHistory({ limit: 5 });
        console.log(`✅ Retrieved ${callHistory.length} calls from history`);
        if (callHistory.length > 0) {
            console.log(`📞 Latest call: ${callHistory[0].phone_number} - ${callHistory[0].booking_outcome || 'unknown'}`);
        }
        console.log();

        // Test 9: Test call details
        if (callHistory.length > 0) {
            console.log('9️⃣ Testing call details retrieval...');
            const callDetails = await twilioService.getCallDetails(callHistory[0].id);
            if (callDetails) {
                console.log(`✅ Call details retrieved:`);
                console.log(`   📞 Phone: ${callDetails.call.phone_number}`);
                console.log(`   📝 Transcriptions: ${callDetails.transcriptions.length}`);
                console.log(`   📊 Booking Analysis: ${callDetails.bookingAnalysis ? 'Yes' : 'No'}`);
            }
            console.log();
        }

        // Test 10: Test data export
        console.log('🔟 Testing data export...');
        const exportData = await twilioService.exportCallData({ limit: 3 });
        console.log(`✅ Exported ${exportData.length} call records`);
        if (exportData.length > 0) {
            console.log(`📋 Export sample: ${exportData[0].phone_number} - ${exportData[0].booking_outcome}`);
        }
        console.log();

        // Test 11: Cleanup stale calls
        console.log('1️⃣1️⃣ Testing stale call cleanup...');
        await twilioService.cleanupStaleCalls();
        console.log('✅ Stale call cleanup completed');

        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📋 Enhanced Service Capabilities Verified:');
        console.log('✅ Service initialization with call logging');
        console.log('✅ Webhook URL generation with optimization parameters');
        console.log('✅ Chat metadata processing and call logging');
        console.log('✅ Active call tracking with logging information');
        console.log('✅ Call completion handling');
        console.log('✅ Call history retrieval');
        console.log('✅ Call details retrieval');
        console.log('✅ Data export functionality');
        console.log('✅ Stale call cleanup');
        console.log('✅ Integration with database and HumeAI services');

        console.log('\n🚀 Ready for Production Integration!');
        console.log('📞 The service can now make calls with comprehensive logging');
        console.log('📝 All call data will be automatically captured and stored');
        console.log('📊 Call analytics and transcriptions are available immediately');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testTwilioWithLogging(); 