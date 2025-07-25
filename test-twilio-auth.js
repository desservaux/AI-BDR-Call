const twilio = require('twilio');

// Test configuration
const config = {
    accountSid: 'ACe35419debddfa2d27efe6de4115f698c',
    authToken: '220324e133d2b1c7bea779d7c51c8dbf'
};

async function testTwilioAuth() {
    try {
        console.log('🧪 Testing Twilio Authentication');
        console.log('================================');
        
        // Create Twilio client
        const client = twilio(config.accountSid, config.authToken);
        
        // Test by fetching account details
        console.log('📋 Fetching account details...');
        const account = await client.api.accounts(config.accountSid).fetch();
        
        console.log('✅ Authentication successful!');
        console.log(`📊 Account: ${account.friendlyName}`);
        console.log(`🆔 SID: ${account.sid}`);
        console.log(`📈 Status: ${account.status}`);
        
        // Test by listing phone numbers
        console.log('\n📱 Fetching phone numbers...');
        const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 5 });
        
        console.log(`📞 Found ${phoneNumbers.length} phone numbers:`);
        phoneNumbers.forEach(number => {
            console.log(`   - ${number.phoneNumber} (${number.friendlyName || 'No name'})`);
        });
        
        return {
            success: true,
            account: account.friendlyName,
            phoneNumbers: phoneNumbers.map(n => n.phoneNumber)
        };
        
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        console.error('🔍 Error details:', {
            code: error.code,
            status: error.status,
            moreInfo: error.moreInfo
        });
        throw error;
    }
}

// Run test
testTwilioAuth()
    .then(result => {
        console.log('\n🎉 Twilio authentication test successful!');
        console.log('📊 Result:', JSON.stringify(result, null, 2));
    })
    .catch(error => {
        console.error('\n💥 Authentication test failed');
        process.exit(1);
    }); 