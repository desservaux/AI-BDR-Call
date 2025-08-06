const { createClient } = require('@supabase/supabase-js');

async function fixPhoneNumbers() {
    const supabaseUrl = 'https://elvnlecliyhdlflzmzeh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdm5sZWNsaXloZGxmbHptemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MjEyODgsImV4cCI6MjA2OTI5NzI4OH0.SOds2z36iJuHv4tSusH1vlSqUNLM6oT9oFpBy2bL624';
    
    const client = createClient(supabaseUrl, supabaseKey);
    
    try {
        console.log('🔄 Starting phone number migration...');

        // Get calls without phone_number_id
        const { data: calls, error: callsError } = await client
            .from('calls')
            .select('id, phone_number')
            .is('phone_number_id', null)
            .neq('phone_number', 'unknown');

        if (callsError) {
            throw new Error(`Failed to fetch calls: ${callsError.message}`);
        }

        console.log(`📊 Found ${calls.length} calls without phone_number_id`);

        if (calls.length === 0) {
            console.log('✅ No calls need migration.');
            return;
        }

        // Get unique phone numbers
        const uniquePhoneNumbers = [...new Set(calls.map(call => call.phone_number))];
        console.log(`📱 Found ${uniquePhoneNumbers.length} unique phone numbers`);

        // Create phone number records
        const phoneRecords = uniquePhoneNumbers.map(phone => ({
            phone_number: phone,
            phone_type: 'mobile',
            is_primary: true,
            do_not_call: false
        }));

        const { data: createdPhones, error: createError } = await client
            .from('phone_numbers')
            .insert(phoneRecords)
            .select('id, phone_number');

        if (createError) {
            throw new Error(`Failed to create phone numbers: ${createError.message}`);
        }

        console.log(`✅ Created ${createdPhones.length} phone number records`);

        // Update calls with phone_number_id
        let updatedCalls = 0;
        for (const call of calls) {
            const phoneRecord = createdPhones.find(p => p.phone_number === call.phone_number);
            if (phoneRecord) {
                const { error: updateError } = await client
                    .from('calls')
                    .update({ phone_number_id: phoneRecord.id })
                    .eq('id', call.id);

                if (!updateError) {
                    updatedCalls++;
                }
            }
        }

        console.log(`✅ Updated ${updatedCalls} calls with phone_number_id`);
        console.log('🎉 Migration completed!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    }
}

fixPhoneNumbers(); 