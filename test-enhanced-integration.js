const TwilioWithLoggingService = require('./services/twilio-with-logging');

async function testEnhancedService() {
    try {
        console.log('🧪 Testing Enhanced Twilio Service Integration...');
        
        // Create service instance
        const enhancedService = new TwilioWithLoggingService();
        console.log('✅ Service instance created');
        
        // Test initialization
        console.log('🔄 Initializing service...');
        enhancedService.initialize();
        console.log('✅ Service initialized');
        
        // Test connection
        console.log('🔗 Testing connection...');
        const connectionTest = await enhancedService.testConnection();
        console.log('✅ Connection test result:', connectionTest);
        
        // Test active calls
        console.log('📞 Getting active calls...');
        const activeCalls = await enhancedService.getActiveCallsWithLogging();
        console.log('✅ Active calls result:', activeCalls);
        
        console.log('🎉 Enhanced service integration test completed successfully!');
        
    } catch (error) {
        console.error('❌ Enhanced service test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testEnhancedService(); 