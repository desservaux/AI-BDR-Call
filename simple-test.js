console.log('🧪 Starting simple test...');

try {
    const supabaseDb = require('./services/supabase-db');
    console.log('✅ Supabase service imported');
    
    const elevenLabsService = require('./services/elevenlabs');
    console.log('✅ ElevenLabs service imported');
    
    console.log('🏁 Services imported successfully');
} catch (error) {
    console.error('❌ Error importing services:', error);
} 