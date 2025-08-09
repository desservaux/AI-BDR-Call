const DbService = require('./services/db/DbService');
const supabaseDb = new DbService();

async function testDatabase() {
    console.log('🧪 Testing database connection...');
    
    try {
        // Test connection
        const connected = await supabaseDb.testConnection();
        console.log('Connection test result:', connected);
        
        // Test getAllCalls
        console.log('📊 Testing getAllCalls...');
        const calls = await supabaseDb.getAllCalls();
        console.log(`Found ${calls.length} calls`);
        
        if (calls.length > 0) {
            console.log('First call:', JSON.stringify(calls[0], null, 2));
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDatabase().then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
}); 