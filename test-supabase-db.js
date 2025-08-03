const SupabaseDBService = require('./services/supabase-db');

async function testSupabaseDB() {
    console.log('🧪 Testing Supabase Database Service...\n');

    const dbService = new SupabaseDBService();

    try {
        // Test 1: Connection test
        console.log('1️⃣ Testing connection...');
        const connectionSuccess = await dbService.testConnection();
        if (connectionSuccess) {
            console.log('✅ Connection successful\n');
        } else {
            console.log('❌ Connection failed\n');
            return;
        }

        // Test 2: Create a test call
        console.log('2️⃣ Testing call creation...');
        const testCallData = {
            phoneNumber: '+1234567890',
            chatId: 'test-chat-id-123',
            chatGroupId: 'test-chat-group-id-123',
            status: 'active'
        };

        const createdCall = await dbService.createCall(testCallData);
        console.log(`✅ Test call created with ID: ${createdCall.id}`);
        console.log(`📞 Phone: ${createdCall.phone_number}`);
        console.log(`📅 Created: ${new Date(createdCall.created_at).toLocaleString()}\n`);

        // Test 3: Insert test transcriptions
        console.log('3️⃣ Testing transcription insertion...');
        const testTranscriptionData = [
            {
                call_id: createdCall.id,
                speaker: 'user',
                message: 'Hello, I would like to book an appointment',
                timestamp: new Date().toISOString(),
                event_type: 'user_message'
            },
            {
                call_id: createdCall.id,
                speaker: 'assistant',
                message: 'I can help you book an appointment. What time works for you?',
                timestamp: new Date().toISOString(),
                event_type: 'assistant_message'
            },
            {
                call_id: createdCall.id,
                speaker: 'user',
                message: 'Yes, I would like to book for tomorrow at 2 PM',
                timestamp: new Date().toISOString(),
                event_type: 'user_message'
            }
        ];

        const insertedTranscriptions = await dbService.insertTranscriptions(testTranscriptionData);
        console.log(`✅ Inserted ${insertedTranscriptions.length} transcription records\n`);

        // Test 4: Insert test events
        console.log('4️⃣ Testing event insertion...');
        const testEventData = [
            {
                call_id: createdCall.id,
                event_type: 'USER_MESSAGE',
                event_data: { message: 'Hello, I would like to book an appointment' },
                timestamp: new Date().toISOString()
            },
            {
                call_id: createdCall.id,
                event_type: 'ASSISTANT_MESSAGE',
                event_data: { message: 'I can help you book an appointment. What time works for you?' },
                timestamp: new Date().toISOString()
            }
        ];

        const insertedEvents = await dbService.insertEvents(testEventData);
        console.log(`✅ Inserted ${insertedEvents.length} event records\n`);

        // Test 5: Insert test booking analysis
        console.log('5️⃣ Testing booking analysis insertion...');
        const testBookingData = {
            call_id: createdCall.id,
            booking_detected: true,
            confidence_score: 0.95,
            analysis_timestamp: new Date().toISOString()
        };

        const insertedBookingAnalysis = await dbService.insertBookingAnalysis(testBookingData);
        console.log(`✅ Booking analysis inserted with ID: ${insertedBookingAnalysis.id}`);
        console.log(`📊 Booking detected: ${insertedBookingAnalysis.booking_detected}`);
        console.log(`🎯 Confidence score: ${insertedBookingAnalysis.confidence_score}\n`);

        // Test 6: Update call status
        console.log('6️⃣ Testing call status update...');
        const updatedCall = await dbService.updateCallStatus(createdCall.id, 'completed');
        console.log(`✅ Call status updated to: ${updatedCall.status}`);
        console.log(`⏱️ End time: ${updatedCall.end_time ? new Date(updatedCall.end_time).toLocaleString() : 'N/A'}\n`);

        // Test 7: Get calls with filtering
        console.log('7️⃣ Testing call retrieval with filtering...');
        const calls = await dbService.getCalls({ limit: 10 });
        console.log(`✅ Retrieved ${calls.length} calls`);
        
        if (calls.length > 0) {
            console.log('📋 Sample calls:');
            calls.slice(0, 3).forEach((call, index) => {
                console.log(`   ${index + 1}. ${call.phone_number} - ${call.booking_outcome || 'unknown'} - ${call.status}`);
            });
        }
        console.log();

        // Test 8: Get call details
        console.log('8️⃣ Testing call details retrieval...');
        const callDetails = await dbService.getCallDetails(createdCall.id);
        console.log('✅ Call details retrieved:');
        console.log(`   📞 Phone: ${callDetails.call.phone_number}`);
        console.log(`   📅 Start: ${new Date(callDetails.call.start_time).toLocaleString()}`);
        console.log(`   📅 End: ${callDetails.call.end_time ? new Date(callDetails.call.end_time).toLocaleString() : 'N/A'}`);
        console.log(`   📝 Transcriptions: ${callDetails.transcriptions.length}`);
        console.log(`   📊 Booking Analysis: ${callDetails.bookingAnalysis ? 'Yes' : 'No'}`);
        console.log();

        // Test 9: Get call statistics
        console.log('9️⃣ Testing call statistics...');
        const stats = await dbService.getCallStatistics();
        console.log('✅ Call statistics:');
        console.log(`   📊 Total calls: ${stats.total}`);
        console.log(`   ✅ Booking yes: ${stats.yes}`);
        console.log(`   ❌ Booking no: ${stats.no}`);
        console.log(`   ❓ Unknown: ${stats.unknown}`);
        console.log();

        // Test 10: Export call data
        console.log('🔟 Testing call data export...');
        const exportData = await dbService.exportCallData({ limit: 5 });
        console.log(`✅ Exported ${exportData.length} call records`);
        if (exportData.length > 0) {
            console.log('📋 Export sample:');
            console.log(JSON.stringify(exportData[0], null, 2));
        }

        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📋 Service Capabilities Verified:');
        console.log('✅ Supabase connection');
        console.log('✅ Call creation and updates');
        console.log('✅ Transcription insertion');
        console.log('✅ Event insertion');
        console.log('✅ Booking analysis insertion');
        console.log('✅ Call retrieval with filtering');
        console.log('✅ Call details retrieval');
        console.log('✅ Statistics generation');
        console.log('✅ Data export functionality');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testSupabaseDB(); 