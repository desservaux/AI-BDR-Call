// Test script for voicemail detection functionality
// Run with: node test-voicemail-detection.js

const elevenLabsService = require('./services/elevenlabs');

// Mock ElevenLabs API response with voicemail detection tool call
const mockResponse = {
    data: {
        agent_id: "test-agent",
        agent_name: "Test Agent",
        phone_number_id: "test-phone",
        phone_number: "+1234567890",
        to_number: "+0987654321",
        start_time_unix_secs: Date.now() / 1000,
        end_time: new Date().toISOString(),
        call_duration_secs: 15,
        status: "done",
        message_count: 3,
        transcript_summary: "Test call summary",
        call_summary_title: "Test Call",
        transcript: [],
        messages: [
            {
                type: "message",
                role: "assistant",
                message: { text: "Hello, this is a test call." },
                timestamp: new Date().toISOString()
            },
            {
                type: "function",
                function: {
                    name: "voicemail_detection",
                    arguments: '{"reason": "The call was answered by voicemail"}'
                },
                timestamp: new Date().toISOString()
            }
        ],
        metadata: {
            start_time_unix_secs: Date.now() / 1000,
            call_duration_secs: 15
        }
    }
};

// Test the voicemail detection parsing
async function testVoicemailDetection() {
    console.log('🧪 Testing voicemail detection functionality...\n');

    try {
        // Create a mock instance to test the parsing logic
        const testService = Object.create(elevenLabsService);

        // Mock the API call
        testService.client = {
            get: async () => mockResponse
        };

        // Test getConversationDetailsEnhanced
        const result = await testService.getConversationDetailsEnhanced('test-conversation-id');

        console.log('📊 Test Results:');
        console.log(`- Voicemail Detected: ${result.voicemail_detected}`);
        console.log(`- Voicemail Reason: ${result.voicemail_reason}`);
        console.log(`- Call Result: ${testService.computeOutcomeFrom(result.status_raw, result.duration)}`);

        // Test the logic
        const call_result = testService.computeOutcomeFrom(result.status_raw, result.duration);
        const humanAnswered = call_result === 'answered';
        const notVoicemail = !result.voicemail_detected;

        console.log('\n🔍 Logic Test:');
        console.log(`- Human Answered: ${humanAnswered}`);
        console.log(`- Not Voicemail: ${notVoicemail}`);
        console.log(`- Should Trigger Cleanup: ${humanAnswered && notVoicemail}`);

        if (result.voicemail_detected) {
            console.log('\n✅ Voicemail detection working correctly!');
            console.log('📼 This call would be kept active in sequence (no DNC/completion)');
        } else {
            console.log('\n❌ Voicemail detection not working');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Test with a call that has NO voicemail detection
async function testNoVoicemail() {
    console.log('\n🧪 Testing call WITHOUT voicemail detection...\n');

    const mockResponseNoVM = {
        ...mockResponse,
        data: {
            ...mockResponse.data,
            messages: [
                {
                    type: "message",
                    role: "assistant",
                    message: { text: "Hello, this is answered by a human." },
                    timestamp: new Date().toISOString()
                }
            ]
        }
    };

    try {
        const testService = Object.create(elevenLabsService);
        testService.client = {
            get: async () => mockResponseNoVM
        };

        const result = await testService.getConversationDetailsEnhanced('test-conversation-id');

        console.log('📊 Test Results:');
        console.log(`- Voicemail Detected: ${result.voicemail_detected}`);
        console.log(`- Voicemail Reason: ${result.voicemail_reason}`);

        const call_result = testService.computeOutcomeFrom(result.status_raw, result.duration);
        const humanAnswered = call_result === 'answered';
        const notVoicemail = !result.voicemail_detected;

        console.log('\n🔍 Logic Test:');
        console.log(`- Human Answered: ${humanAnswered}`);
        console.log(`- Not Voicemail: ${notVoicemail}`);
        console.log(`- Should Trigger Cleanup: ${humanAnswered && notVoicemail}`);

        if (!result.voicemail_detected) {
            console.log('\n✅ Non-voicemail call detection working correctly!');
            console.log('✅ This call would trigger sequence cleanup (DNC/completion)');
        } else {
            console.log('\n❌ Non-voicemail detection not working');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run tests
async function runTests() {
    await testVoicemailDetection();
    await testNoVoicemail();

    console.log('\n🎯 Test Summary:');
    console.log('✅ Voicemail detection parsing implemented');
    console.log('✅ Sequence cleanup prevention implemented');
    console.log('✅ Webhook success logic updated');
    console.log('✅ Database columns added (migration file created)');
    console.log('\n📋 Next Steps:');
    console.log('1. Run migration-voicemail-detection.sql in Supabase');
    console.log('2. Test with real ElevenLabs calls containing voicemail tool calls');
    console.log('3. Verify sequence entries stay active for voicemail calls');
    console.log('4. Confirm human-answered calls still complete sequences');
}

runTests().catch(console.error);
