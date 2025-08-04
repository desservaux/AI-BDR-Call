require('dotenv').config();

console.log('🧪 Environment test...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? 'SET' : 'NOT SET');

try {
    const supabaseDb = require('./services/supabase-db');
    const dbService = new supabaseDb();
    
    console.log('✅ Database service created');
    
    // Test connection
    dbService.testConnection().then(result => {
        console.log('Database connection test result:', result);
    }).catch(error => {
        console.error('Database connection failed:', error);
    });
    
} catch (error) {
    console.error('❌ Error creating database service:', error);
} 