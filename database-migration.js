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

async function runMigration() {
    console.log('🚀 Starting database migration for contacts and phone_numbers...');
    
    try {
        // Step 1: Create new tables
        console.log('📋 Step 1: Creating new tables...');
        
        // Create contacts table
        const { error: contactsError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS contacts (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    first_name TEXT,
                    last_name TEXT,
                    email TEXT,
                    company_name TEXT,
                    position TEXT,
                    notes TEXT,
                    do_not_call BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `
        });
        
        if (contactsError) {
            console.error('❌ Error creating contacts table:', contactsError);
            return;
        }
        console.log('✅ Contacts table created');

        // Create phone_numbers table
        const { error: phoneNumbersError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS phone_numbers (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
                    phone_number TEXT NOT NULL UNIQUE,
                    phone_type TEXT DEFAULT 'mobile' CHECK (phone_type IN ('mobile', 'home', 'work', 'other')),
                    is_primary BOOLEAN DEFAULT FALSE,
                    do_not_call BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `
        });
        
        if (phoneNumbersError) {
            console.error('❌ Error creating phone_numbers table:', phoneNumbersError);
            return;
        }
        console.log('✅ Phone_numbers table created');

        // Drop and recreate sequences table with business hours support (not in production)
        console.log('🗑️ Dropping existing sequences table...');
        const { error: dropSequencesError } = await supabase.rpc('exec_sql', {
            sql: `DROP TABLE IF EXISTS sequences CASCADE;`
        });
        
        if (dropSequencesError) {
            console.error('❌ Error dropping sequences table:', dropSequencesError);
            return;
        }
        console.log('✅ Sequences table dropped');

        // Create sequences table with business hours support
        const { error: sequencesError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE sequences (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    max_attempts INTEGER DEFAULT 3,
                    retry_delay_hours INTEGER DEFAULT 24,
                    is_active BOOLEAN DEFAULT TRUE,
                    timezone TEXT DEFAULT 'UTC',
                    business_hours_start TIME DEFAULT '09:00:00',
                    business_hours_end TIME DEFAULT '17:00:00',
                    exclude_weekends BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `
        });
        
        if (sequencesError) {
            console.error('❌ Error creating sequences table:', sequencesError);
            return;
        }
        console.log('✅ Sequences table created');

        // Create sequence_entries table
        const { error: sequenceEntriesError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS sequence_entries (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,
                    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE CASCADE,
                    current_attempt INTEGER DEFAULT 0,
                    next_call_time TIMESTAMP WITH TIME ZONE,
                    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped', 'max_attempts_reached')),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(sequence_id, phone_number_id)
                );
            `
        });
        
        if (sequenceEntriesError) {
            console.error('❌ Error creating sequence_entries table:', sequenceEntriesError);
            return;
        }
        console.log('✅ Sequence_entries table created');

        // Step 2: Add new columns to calls table
        console.log('📋 Step 2: Adding new columns to calls table...');
        
        const { error: addColumnsError } = await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE calls 
                ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS call_result TEXT CHECK (call_result IN ('answered', 'failed', 'unanswered', 'busy', 'no_answer')),
                ADD COLUMN IF NOT EXISTS answered BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS sequence_id UUID;
            `
        });
        
        if (addColumnsError) {
            console.error('❌ Error adding columns to calls table:', addColumnsError);
            return;
        }
        console.log('✅ New columns added to calls table');

        // Step 3: Create indexes for new tables
        console.log('📋 Step 3: Creating indexes...');
        
        const { error: indexesError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
                CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_name);
                CREATE INDEX IF NOT EXISTS idx_contacts_do_not_call ON contacts(do_not_call);
                
                CREATE INDEX IF NOT EXISTS idx_phone_numbers_contact_id ON phone_numbers(contact_id);
                CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone_number ON phone_numbers(phone_number);
                CREATE INDEX IF NOT EXISTS idx_phone_numbers_do_not_call ON phone_numbers(do_not_call);
                
                CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);
                CREATE INDEX IF NOT EXISTS idx_calls_phone_number_id ON calls(phone_number_id);
                CREATE INDEX IF NOT EXISTS idx_calls_call_result ON calls(call_result);
                CREATE INDEX IF NOT EXISTS idx_calls_answered ON calls(answered);
                
                CREATE INDEX IF NOT EXISTS idx_sequences_name ON sequences(name);
                CREATE INDEX IF NOT EXISTS idx_sequences_is_active ON sequences(is_active);
                CREATE INDEX IF NOT EXISTS idx_sequences_timezone ON sequences(timezone);
                CREATE INDEX IF NOT EXISTS idx_sequences_business_hours ON sequences(business_hours_start, business_hours_end);
                CREATE INDEX IF NOT EXISTS idx_sequences_exclude_weekends ON sequences(exclude_weekends);
                
                CREATE INDEX IF NOT EXISTS idx_sequence_entries_sequence_id ON sequence_entries(sequence_id);
                CREATE INDEX IF NOT EXISTS idx_sequence_entries_phone_number_id ON sequence_entries(phone_number_id);
                CREATE INDEX IF NOT EXISTS idx_sequence_entries_status ON sequence_entries(status);
                CREATE INDEX IF NOT EXISTS idx_sequence_entries_next_call_time ON sequence_entries(next_call_time);
            `
        });
        
        if (indexesError) {
            console.error('❌ Error creating indexes:', indexesError);
            return;
        }
        console.log('✅ Indexes created');

        // Step 4: Create triggers for updated_at
        console.log('📋 Step 4: Creating triggers...');
        
        const { error: triggersError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ language 'plpgsql';

                DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
                CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

                DROP TRIGGER IF EXISTS update_phone_numbers_updated_at ON phone_numbers;
                CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

                DROP TRIGGER IF EXISTS update_sequences_updated_at ON sequences;
                CREATE TRIGGER update_sequences_updated_at BEFORE UPDATE ON sequences
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

                DROP TRIGGER IF EXISTS update_sequence_entries_updated_at ON sequence_entries;
                CREATE TRIGGER update_sequence_entries_updated_at BEFORE UPDATE ON sequence_entries
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            `
        });
        
        if (triggersError) {
            console.error('❌ Error creating triggers:', triggersError);
            return;
        }
        console.log('✅ Triggers created');

        // Step 5: Backfill phone_numbers from existing calls
        console.log('📋 Step 5: Backfilling phone_numbers from existing calls...');
        
        // Get all unique phone numbers from calls
        const { data: calls, error: callsError } = await supabase
            .from('calls')
            .select('phone_number')
            .not('phone_number', 'is', null);
        
        if (callsError) {
            console.error('❌ Error fetching calls:', callsError);
            return;
        }

        // Extract unique phone numbers
        const uniquePhoneNumbers = [...new Set(calls.map(call => call.phone_number))];
        console.log(`📞 Found ${uniquePhoneNumbers.length} unique phone numbers to backfill`);

        // Create phone_number entries for each unique number
        for (const phoneNumber of uniquePhoneNumbers) {
            const { error: insertError } = await supabase
                .from('phone_numbers')
                .insert({
                    phone_number: phoneNumber,
                    phone_type: 'mobile',
                    is_primary: true
                })
                .select();
            
            if (insertError && !insertError.message.includes('duplicate key')) {
                console.error(`❌ Error inserting phone number ${phoneNumber}:`, insertError);
            }
        }
        console.log('✅ Phone numbers backfilled');

        // Step 6: Update calls table to link with phone_numbers
        console.log('📋 Step 6: Linking calls with phone_numbers...');
        
        const { error: updateCallsError } = await supabase.rpc('exec_sql', {
            sql: `
                UPDATE calls 
                SET phone_number_id = pn.id
                FROM phone_numbers pn
                WHERE calls.phone_number = pn.phone_number
                AND calls.phone_number_id IS NULL;
            `
        });
        
        if (updateCallsError) {
            console.error('❌ Error updating calls with phone_number_id:', updateCallsError);
            return;
        }
        console.log('✅ Calls linked with phone_numbers');

        // Step 7: Create updated views
        console.log('📋 Step 7: Creating updated views...');
        
        const { error: viewsError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE OR REPLACE VIEW calls_with_analysis AS
                SELECT 
                    c.*,
                    co.first_name,
                    co.last_name,
                    co.email,
                    co.company_name,
                    co.position,
                    pn.phone_type,
                    ba.meeting_booked,
                    ba.person_interested,
                    ba.person_very_upset,
                    ba.confidence_score,
                    ba.key_topics,
                    ba.sentiment,
                    ba.action_items,
                    ba.notes as analysis_notes
                FROM calls c
                LEFT JOIN contacts co ON c.contact_id = co.id
                LEFT JOIN phone_numbers pn ON c.phone_number_id = pn.id
                LEFT JOIN booking_analysis ba ON c.id = ba.call_id;

                CREATE OR REPLACE VIEW sequence_statistics AS
                SELECT 
                    c.phone_number,
                    co.first_name,
                    co.last_name,
                    co.company_name,
                    COUNT(*) as total_calls,
                    COUNT(*) FILTER (WHERE c.status = 'completed') as successful_calls,
                    COUNT(*) FILTER (WHERE c.status = 'failed') as failed_calls,
                    AVG(c.duration_seconds) as average_duration,
                    MAX(c.created_at) as last_call_time,
                    MAX(c.next_call_time) as next_scheduled_call,
                    MAX(c.sequence_status) as current_sequence_status,
                    MAX(c.call_attempts) as total_attempts
                FROM calls c
                LEFT JOIN contacts co ON c.contact_id = co.id
                GROUP BY c.phone_number, co.first_name, co.last_name, co.company_name;

                CREATE OR REPLACE VIEW contact_call_history AS
                SELECT 
                    co.id as contact_id,
                    co.first_name,
                    co.last_name,
                    co.email,
                    co.company_name,
                    co.position,
                    pn.phone_number,
                    pn.phone_type,
                    COUNT(c.id) as total_calls,
                    COUNT(*) FILTER (WHERE c.status = 'completed') as successful_calls,
                    COUNT(*) FILTER (WHERE c.status = 'failed') as failed_calls,
                    MAX(c.created_at) as last_call_time,
                    MAX(c.next_call_time) as next_scheduled_call
                FROM contacts co
                LEFT JOIN phone_numbers pn ON co.id = pn.contact_id
                LEFT JOIN calls c ON pn.id = c.phone_number_id
                GROUP BY co.id, co.first_name, co.last_name, co.email, co.company_name, co.position, pn.phone_number, pn.phone_type;
            `
        });
        
        if (viewsError) {
            console.error('❌ Error creating views:', viewsError);
            return;
        }
        console.log('✅ Views created');

        // Step 8: Verify migration
        console.log('📋 Step 8: Verifying migration...');
        
        // Check table counts
        const { data: contactsCount } = await supabase
            .from('contacts')
            .select('*', { count: 'exact' });
        
        const { data: phoneNumbersCount } = await supabase
            .from('phone_numbers')
            .select('*', { count: 'exact' });
        
        const { data: callsCount } = await supabase
            .from('calls')
            .select('*', { count: 'exact' });

        console.log(`📊 Migration verification:`);
        console.log(`   - Contacts: ${contactsCount?.length || 0}`);
        console.log(`   - Phone Numbers: ${phoneNumbersCount?.length || 0}`);
        console.log(`   - Calls: ${callsCount?.length || 0}`);

        console.log('🎉 Migration completed successfully!');
        console.log('');
        console.log('📋 Next steps:');
        console.log('   1. Update backend API to handle new schema');
        console.log('   2. Implement contacts management endpoints');
        console.log('   3. Add sequence management functionality');
        console.log('   4. Create frontend views for contacts and sequences');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration }; 