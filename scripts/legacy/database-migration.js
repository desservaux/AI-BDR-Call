const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const fs = require('fs');
const path = require('path');

async function runSql(sql) {
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) throw error;
}

async function runMigration() {
  console.log('🚀 Starting database migration from /migrations/*.sql ...');
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('⚠️ No migration files found in /migrations');
      return;
    }

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      console.log(`📄 Running migration: ${file}`);
      await runSql(sql);
      console.log(`✅ Migration applied: ${file}`);
    }

    console.log('🎉 All migrations applied successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message || error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration }; 