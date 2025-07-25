const axios = require('axios');

// Configuration
const config = {
    baseUrl: 'http://localhost:3000',
    testPhoneNumber: '+33643584946',
    testMessage: 'Hello, this is an ultra-low latency AI assistant calling.',
    accountSid: 'ACe35419debddfa2d27efe6de4115f698c',
    authToken: '223d73109eea82c0539efbc7730cf2bb',
    twilioNumber: '+447846855904',
    humeConfigId: '9d00fd96-7e92-44c1-b781-4af52331c629',
    humeApiKey: 'sUxoFMRiwyAqRsKgiFt5ZIl8yeSVvGPKOGec8mWpN5DpVIsD'
};

async function testCall() {
    console.log('🚀 Testing Ultra-Low Latency Twilio-HumeAI Integration');
    console.log('==================================================');
    console.log(`📞 Test phone: ${config.testPhoneNumber}`);
    console.log(`🔗 Server: ${config.baseUrl}`);
    console.log('');

    try {
        // 1. Check server health
        console.log('1️⃣ Checking server health...');
        const healthResponse = await axios.get(`${config.baseUrl}/health`);
        console.log(`✅ Server health: ${healthResponse.data.status}`);
        console.log('');

        // 2. Test Twilio connection
        console.log('2️⃣ Testing Twilio connection...');
        try {
            const twilioResponse = await axios.get(`${config.baseUrl}/test-twilio`);
            if (twilioResponse.data.success) {
                console.log(`✅ Twilio connection: ${twilioResponse.data.message}`);
                console.log(`📞 Account: ${twilioResponse.data.account?.friendlyName || 'N/A'}`);
            } else {
                console.log(`❌ Twilio connection failed: ${twilioResponse.data.message}`);
            }
        } catch (error) {
            console.log(`❌ Twilio connection failed: ${error.response?.data?.message || error.message}`);
        }
        console.log('');

        // 3. Test HumeAI connection
        console.log('3️⃣ Testing HumeAI connection...');
        try {
            const humeResponse = await axios.get(`${config.baseUrl}/test-hume-evi`);
            if (humeResponse.data.success) {
                console.log(`✅ HumeAI connection: ${humeResponse.data.message}`);
            } else {
                console.log(`❌ HumeAI connection failed: ${humeResponse.data.message}`);
            }
        } catch (error) {
            console.log(`❌ HumeAI connection failed: ${error.response?.data?.message || error.message}`);
        }
        console.log('');

        // 4. Get initial latency statistics
        console.log('4️⃣ Getting initial latency statistics...');
        try {
            const statsResponse = await axios.get(`${config.baseUrl}/latency/stats`);
            const stats = statsResponse.data;
            console.log(`📊 Total calls: ${stats.latencyStats?.totalCalls || 0}`);
            console.log(`📊 Average initial latency: ${stats.latencyStats?.averageInitialLatency || 0}ms`);
            console.log(`📊 Connection pool size: ${stats.performanceStats?.connectionPoolSize || 0}`);
        } catch (error) {
            console.log('📊 No latency statistics available yet');
        }
        console.log('');

        // 5. Make ultra-low latency call
        console.log('5️⃣ Making ultra-low latency call...');
        try {
            const callStart = Date.now();
            const callResponse = await axios.post(`${config.baseUrl}/make-call`, {
                phoneNumber: config.testPhoneNumber,
                message: config.testMessage
            });
            const callDuration = Date.now() - callStart;
            
            if (callResponse.data.success) {
                console.log(`✅ Call initiated in ${callDuration}ms`);
                console.log(`📋 Call SID: ${callResponse.data.callInfo?.callSid || 'N/A'}`);
                console.log(`⚡ Setup time: ${callResponse.data.callInfo?.performance?.totalSetupTime || 'N/A'}ms`);
                console.log(`🎯 Optimization: ${callResponse.data.optimization || 'N/A'}`);
                
                // Show webhook URL details
                const webhookUrl = callResponse.data.callInfo?.webhookUrl || '';
                if (webhookUrl) {
                    console.log(`🔗 Webhook URL: ${webhookUrl}`);
                }
            } else {
                console.log(`❌ Call failed: ${callResponse.data.message}`);
            }
        } catch (error) {
            console.log(`❌ Call failed: ${error.response?.data?.message || error.message}`);
        }
        console.log('');

        // 6. Get updated latency statistics
        console.log('6️⃣ Getting updated latency statistics...');
        try {
            const statsResponse = await axios.get(`${config.baseUrl}/latency/stats`);
            const stats = statsResponse.data;
            console.log(`📊 Total calls: ${stats.latencyStats?.totalCalls || 0}`);
            console.log(`📊 Average initial latency: ${stats.latencyStats?.averageInitialLatency || 0}ms`);
            
            if (stats.latencyStats?.recentSessions && stats.latencyStats.recentSessions.length > 0) {
                console.log('📊 Recent sessions:');
                stats.latencyStats.recentSessions.slice(0, 3).forEach(session => {
                    console.log(`   - ${session.sessionId}: ${session.totalDuration || 0}ms`);
                });
            }
        } catch (error) {
            console.log('📊 Could not retrieve updated statistics');
        }
        console.log('');

        // 7. Analyze performance bottlenecks
        console.log('7️⃣ Analyzing performance bottlenecks...');
        try {
            const bottlenecksResponse = await axios.get(`${config.baseUrl}/latency/bottlenecks`);
            const bottlenecks = bottlenecksResponse.data;
            
            if (bottlenecks.analysis?.bottlenecks && bottlenecks.analysis.bottlenecks.length > 0) {
                console.log('🔍 Identified bottlenecks:');
                bottlenecks.analysis.bottlenecks.forEach(bottleneck => {
                    console.log(`   - ${bottleneck.type}: ${bottleneck.description}`);
                });
            } else {
                console.log('✅ No significant bottlenecks identified');
            }
            
            if (bottlenecks.analysis?.recommendations && bottlenecks.analysis.recommendations.length > 0) {
                console.log('💡 Recommendations:');
                bottlenecks.analysis.recommendations.forEach(rec => {
                    console.log(`   - ${rec}`);
                });
            }
        } catch (error) {
            console.log('🔍 Could not retrieve bottleneck analysis');
        }
        console.log('');

        console.log('🎯 Test Summary:');
        console.log('================');
        console.log('✅ Ultra-low latency call test completed');
        console.log('📊 Check the call performance and monitor conversation latency');
        console.log('🔍 If conversation latency is still high, check HumeAI processing pipeline');
        console.log('💡 The system now uses ultra-low latency optimizations by default');
        console.log('');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('');
        console.log('🔧 Troubleshooting tips:');
        console.log('1. Ensure the server is running: node index.js');
        console.log('2. Check server logs for any errors');
        console.log('3. Verify Twilio credentials are correct');
        console.log('4. Ensure HumeAI API key is valid');
        console.log('5. Check network connectivity');
    }
}

// Run the test
testCall(); 