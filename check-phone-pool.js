// Check current phone pool configuration
const SupabaseDBService = require('./services/supabase-db');

async function checkPhonePool() {
    console.log('📱 Current Phone Pool Configuration (Database-stored):');
    console.log('===================================================');

    try {
        const dbService = new SupabaseDBService();
        const phones = await dbService.getPhonePool();

        if (phones.length === 0) {
            console.log('❌ No phone pool configured in database');
            console.log('');
            console.log('To set up phone randomization:');
            console.log('1. Via Web Interface:');
            console.log('   - Go to http://localhost:3000');
            console.log('   - Configure phone pool through the settings UI');
            console.log('2. Via API:');
            console.log('   curl -X POST http://localhost:3000/api/settings/phone-pool \\');
            console.log('        -H "Content-Type: application/json" \\');
            console.log('        -d \'{"phones": ["phnum_001", "phnum_002", "phnum_003"]}\'');
            console.log('3. Test with: node test-phone-pool.js');
        } else {
            console.log('✅ Phone pool configured with', phones.length, 'phones:');
            phones.forEach((phone, index) => {
                console.log(`   ${index + 1}. ${phone}`);
            });
            console.log('');
            console.log('📊 Each call will randomly select from these phones (stored in database)');
            console.log('🧪 Test randomization: node test-phone-pool.js');
        }
    } catch (error) {
        console.error('❌ Error checking phone pool:', error.message);
        console.log('');
        console.log('💡 Make sure your Supabase database is configured and accessible');
    }
}

// Run the check
checkPhonePool().then(() => {
    console.log('');
    console.log('📋 Where phone pool is used:');
    console.log('- Manual calls via web interface');
    console.log('- Sequence batch calls');
    console.log('- Agent assignments (when no specific phone assigned)');
}).catch(console.error);
