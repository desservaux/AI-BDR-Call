const axios = require('axios');
require('dotenv').config();

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const ELEVENLABS_PHONE_NUMBER_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID;

if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID || !ELEVENLABS_PHONE_NUMBER_ID) {
    console.log('❌ Missing required environment variables:');
    console.log('  ELEVENLABS_API_KEY:', ELEVENLABS_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('  ELEVENLABS_AGENT_ID:', ELEVENLABS_AGENT_ID ? '✅ Set' : '❌ Missing');
    console.log('  ELEVENLABS_PHONE_NUMBER_ID:', ELEVENLABS_PHONE_NUMBER_ID ? '✅ Set' : '❌ Missing');
    process.exit(1);
}

async function testBatchCalling() {
    try {
        console.log('🚀 Testing ElevenLabs Batch Calling...');
        console.log('📞 Phone Number: +33643584946');
        console.log('👤 Name: Martin');
        console.log('📅 Weekday: Monday');
        
        // Calculate scheduled time (5 minutes from now)
        const scheduledTime = Math.floor(Date.now() / 1000) + (5 * 60); // 5 minutes from now
        
        const batchCallData = {
            call_name: `Test Batch Call - ${new Date().toISOString()}`,
            agent_id: ELEVENLABS_AGENT_ID,
            agent_phone_number_id: ELEVENLABS_PHONE_NUMBER_ID,
            scheduled_time_unix: scheduledTime,
            recipients: [
                {
                    phone_number: '+33643584946',
                    conversation_initiation_client_data: {
                        dynamic_variables: {
                            name_test: "Martin",
                            weekday: "Monday"
                        },
                        source_info: {
                            source: "twilio", // Using allowed value from API
                            version: "1.0.0"
                        }
                    }
                }
            ]
        };
        
        console.log('\n📤 Sending batch call request to ElevenLabs...');
        console.log('📋 Request data:', JSON.stringify(batchCallData, null, 2));
        
        const response = await axios.post(
            'https://api.elevenlabs.io/v1/convai/batch-calling/submit',
            batchCallData,
            {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('\n✅ Batch call submitted successfully!');
        console.log('📊 Response:', JSON.stringify(response.data, null, 2));
        
        // Extract key information
        const batchCall = response.data;
        console.log('\n🎯 Batch Call Details:');
        console.log('  ID:', batchCall.id);
        console.log('  Name:', batchCall.name);
        console.log('  Status:', batchCall.status);
        console.log('  Scheduled Time:', new Date(batchCall.scheduled_time_unix * 1000).toISOString());
        console.log('  Total Calls Scheduled:', batchCall.total_calls_scheduled);
        console.log('  Agent:', batchCall.agent_name);
        console.log('  Phone Provider:', batchCall.phone_provider);
        
        console.log('\n⏰ The call will be made at:', new Date(scheduledTime * 1000).toISOString());
        console.log('📱 Check your ElevenLabs dashboard to monitor the call status');
        
    } catch (error) {
        console.error('\n❌ Error submitting batch call:');
        if (error.response) {
            console.error('  Status:', error.response.status);
            console.error('  Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('  Message:', error.message);
        }
    }
}

// Run the test
testBatchCalling();
