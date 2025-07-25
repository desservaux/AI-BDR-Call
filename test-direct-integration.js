const twilio = require('twilio');

// Test configuration
const config = {
    accountSid: 'ACe35419debddfa2d27efe6de4115f698c',
    authToken: '220324e133d2b1c7bea779d7c51c8dbf',
    twilioNumber: '+447846855904',
    humeConfigId: '9d00fd96-7e92-44c1-b781-4af52331c629',
    humeApiKey: 'sUxoFMRiwyAqRsKgiFt5ZIl8yeSVvGPKOGec8mWpN5DpVIsD'
};

// Create Twilio client
const client = twilio(config.accountSid, config.authToken);

async function testDirectIntegration(phoneNumber) {
    try {
        console.log('🧪 Testing Direct Twilio-HumeAI Integration');
        console.log('==========================================');
        
        // Create HumeAI webhook URL
        const webhookUrl = `https://api.hume.ai/v0/evi/twilio?config_id=${config.humeConfigId}&api_key=${config.humeApiKey}`;
        
        console.log(`📞 Calling: ${phoneNumber}`);
        console.log(`🔗 Webhook: ${webhookUrl}`);
        
        // Make the call using Twilio's direct webhook integration
        const call = await client.calls.create({
            to: phoneNumber,
            from: config.twilioNumber,
            url: webhookUrl,
            method: 'POST',
            statusCallback: undefined, // No status callback for test
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST',
            record: false, // HumeAI handles conversation
            timeout: 30, // Ring timeout
            machineDetection: 'Enable',
            machineDetectionTimeout: 5
        });

        console.log('✅ Call initiated successfully!');
        console.log(`📋 Call SID: ${call.sid}`);
        console.log(`📱 Status: ${call.status}`);
        console.log(`🤖 HumeAI will handle the conversation directly`);
        console.log(`🎯 Configuration ID: ${config.humeConfigId}`);
        
        return {
            success: true,
            callSid: call.sid,
            status: call.status,
            webhookUrl: webhookUrl,
            configId: config.humeConfigId
        };
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    }
}

// Run test if called directly
if (require.main === module) {
    const phoneNumber = process.argv[2];
    
    if (!phoneNumber) {
        console.log('Usage: node test-direct-integration.js +1234567890');
        process.exit(1);
    }
    
    testDirectIntegration(phoneNumber)
        .then(result => {
            console.log('\n🎉 Direct integration test completed successfully!');
            console.log('📊 Result:', JSON.stringify(result, null, 2));
        })
        .catch(error => {
            console.error('\n💥 Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testDirectIntegration, config }; 