const express = require('express');
const twilio = require('twilio');

// Demo configuration - Real credentials
const config = {
    // Real Twilio credentials
    accountSid: 'ACe35419debddfa2d27efe6de4115f698c',
    authToken: '223d73109eea82c0539efbc7730cf2bb', 
    twilioNumber: '+447846855904',
    
    // HumeAI configuration (these are correct)
    humeConfigId: '9d00fd96-7e92-44c1-b781-4af52331c629',
    humeApiKey: 'sUxoFMRiwyAqRsKgiFt5ZIl8yeSVvGPKOGec8mWpN5DpVIsD'
};

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        integration: 'Direct Twilio-HumeAI'
    });
});

// Direct outbound calling endpoint
app.post('/make-call', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        console.log(`📞 Making direct outbound call to ${phoneNumber}`);

        // Create HumeAI webhook URL
        const webhookUrl = `https://api.hume.ai/v0/evi/twilio?config_id=${config.humeConfigId}&api_key=${config.humeApiKey}`;
        
        console.log(`🔗 Using HumeAI webhook: ${webhookUrl}`);
        
        // Create Twilio client
        const client = twilio(config.accountSid, config.authToken);
        
        // Make the call using Twilio's direct webhook integration
        const call = await client.calls.create({
            to: phoneNumber,
            from: config.twilioNumber,
            url: webhookUrl,
            method: 'POST',
            statusCallback: undefined,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST',
            record: false, // HumeAI handles conversation
            timeout: 30, // Ring timeout
            machineDetection: 'Enable',
            machineDetectionTimeout: 5
        });

        console.log(`✅ Call initiated: ${call.sid}`);

        res.json({
            success: true,
            message: 'Outbound call initiated successfully with direct HumeAI integration',
            callInfo: {
                callSid: call.sid,
                status: call.status,
                from: config.twilioNumber,
                to: phoneNumber
            },
            webhookUrl: webhookUrl,
            configId: config.humeConfigId,
            instructions: 'Call will connect directly to HumeAI EVI using Twilio webhook',
            status: 'calling'
        });

    } catch (error) {
        console.error('❌ Outbound call failed:', error.message);
        res.status(500).json({
            success: false,
            message: error.message,
            errorCode: error.code,
            errorStatus: error.status
        });
    }
});

// Test endpoint to show configuration
app.get('/config', (req, res) => {
    res.json({
        integration: 'Direct Twilio-HumeAI',
        humeConfigId: config.humeConfigId,
        webhookUrl: `https://api.hume.ai/v0/evi/twilio?config_id=${config.humeConfigId}&api_key=${config.humeApiKey}`,
        instructions: [
            '1. Replace Twilio credentials in config object',
            '2. Ensure Twilio phone number is verified',
            '3. Test with a verified phone number',
            '4. HumeAI will handle the entire conversation'
        ]
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Direct Twilio-HumeAI Integration Demo`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Config info: http://localhost:${PORT}/config`);
    console.log(`📞 Make call: POST http://localhost:${PORT}/make-call`);
    console.log('');
    console.log('✅ Twilio credentials configured!');
    console.log(`   - Account SID: ${config.accountSid}`);
    console.log(`   - Phone Number: ${config.twilioNumber}`);
    console.log('   - Ready for testing!');
    console.log('');
    console.log('✅ HumeAI configuration is ready:');
    console.log(`   - Config ID: ${config.humeConfigId}`);
    console.log(`   - API Key: ${config.humeApiKey}`);
    console.log(`   - Webhook: https://api.hume.ai/v0/evi/twilio?config_id=${config.humeConfigId}&api_key=${config.humeApiKey}`);
}); 
 
 