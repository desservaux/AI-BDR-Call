require('dotenv').config();

const DbService = require('./services/db/DbService');
const supabaseDb = new DbService();

async function testGetCalls() {
    console.log('🧪 Testing getCalls...');
    
    try {
        const dbService = new supabaseDb();
        console.log('✅ Database service created');
        
        const calls = await dbService.getAllCalls();
        console.log(`📊 Found ${calls.length} calls`);
        
        if (calls.length > 0) {
            console.log('First call ID:', calls[0].id);
            console.log('First call conversation ID:', calls[0].elevenlabs_conversation_id);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testGetCalls().then(() => {
    console.log('🏁 Test completed');
}).catch(error => {
    console.error('💥 Test failed:', error);
}); 