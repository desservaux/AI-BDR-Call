// Migration script to move phone pool from environment variable to database
const SupabaseDBService = require('./services/supabase-db');

async function migratePhonePool() {
    console.log('🔄 Starting phone pool migration...');

    try {
        const dbService = new SupabaseDBService();

        // Check if phone pool already exists in database
        const existingPhones = await dbService.getPhonePool();
        if (existingPhones.length > 0) {
            console.log('✅ Phone pool already exists in database:', existingPhones);
            return;
        }

        // Get phone pool from environment variable
        const envPool = process.env.ELEVENLABS_PHONE_NUMBER_POOL;
        if (!envPool) {
            console.log('ℹ️ No ELEVENLABS_PHONE_NUMBER_POOL environment variable found');
            console.log('📝 If you have phone numbers to add, use the web interface or run:');
            console.log('   curl -X POST http://localhost:3000/api/settings/phone-pool \\');
            console.log('        -H "Content-Type: application/json" \\');
            console.log('        -d \'{"phones": ["phnum_001", "phnum_002", "phnum_003"]}\'');
            return;
        }

        // Parse and validate environment variable
        const phones = envPool.split(',').map(p => p.trim()).filter(p => p.length > 0);

        if (phones.length === 0) {
            console.log('⚠️ ELEVENLABS_PHONE_NUMBER_POOL environment variable is empty');
            return;
        }

        // Migrate to database
        await dbService.setPhonePool(phones);

        console.log('✅ Successfully migrated phone pool to database!');
        console.log(`📱 Migrated ${phones.length} phone numbers:`, phones);

        // Verify migration
        const migratedPhones = await dbService.getPhonePool();
        console.log('🔍 Verification - Database now contains:', migratedPhones);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('💡 Make sure your Supabase credentials are configured and the database is accessible');
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    migratePhonePool().then(() => {
        console.log('🏁 Migration script completed');
        process.exit(0);
    }).catch((error) => {
        console.error('💥 Migration script failed:', error);
        process.exit(1);
    });
}

module.exports = { migratePhonePool };
