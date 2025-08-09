const { createClient } = require('@supabase/supabase-js');

async function migratePhoneNumbers() {
    const supabaseUrl = 'https://elvnlecliyhdlflzmzeh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdm5sZWNsaXloZGxmbHptemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MjEyODgsImV4cCI6MjA2OTI5NzI4OH0.SOds2z36iJuHv4tSusH1vlSqUNLM6oT9oFpBy2bL624';
    
    const client = createClient(supabaseUrl, supabaseKey);
    
    try {
        console.log('🔄 Starting phone number migration...');

        // Step 1: Clean up duplicate phone numbers
        console.log('🧹 Cleaning up duplicate phone numbers...');
        
        // Get all phone numbers to find duplicates
        const { data: allPhoneNumbers, error: allError } = await client
            .from('phone_numbers')
            .select('id, phone_number, created_at');

        if (allError) {
            console.error('Error fetching phone numbers:', allError);
        } else if (allPhoneNumbers) {
            // Find duplicates manually
            const phoneNumberCounts = {};
            allPhoneNumbers.forEach(pn => {
                phoneNumberCounts[pn.phone_number] = (phoneNumberCounts[pn.phone_number] || 0) + 1;
            });

            const duplicates = Object.keys(phoneNumberCounts).filter(pn => phoneNumberCounts[pn] > 1);
            
            if (duplicates.length > 0) {
                console.log(`Found ${duplicates.length} phone numbers with duplicates`);
                
                for (const phoneNumber of duplicates) {
                    // Keep the first record, delete the rest
                    const phoneRecords = allPhoneNumbers
                        .filter(pn => pn.phone_number === phoneNumber)
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                    if (phoneRecords.length > 1) {
                        const toDelete = phoneRecords.slice(1).map(r => r.id);
                        const { error: deleteError } = await client
                            .from('phone_numbers')
                            .delete()
                            .in('id', toDelete);

                        if (deleteError) {
                            console.error(`Error deleting duplicates for ${phoneNumber}:`, deleteError);
                        } else {
                            console.log(`✅ Cleaned up duplicates for ${phoneNumber}`);
                        }
                    }
                }
            } else {
                console.log('✅ No duplicate phone numbers found');
            }
        }

        // Step 2: Get calls without phone_number_id
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

        // Step 3: Get unique phone numbers from calls
        const uniquePhoneNumbers = [...new Set(calls.map(call => call.phone_number))];
        console.log(`📱 Found ${uniquePhoneNumbers.length} unique phone numbers`);

        // Step 4: Create phone number records for missing numbers
        const phoneRecords = [];
        for (const phoneNumber of uniquePhoneNumbers) {
            // Check if phone number already exists
            const { data: existingPhone, error: checkError } = await client
                .from('phone_numbers')
                .select('id')
                .eq('phone_number', phoneNumber)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error(`Error checking phone number ${phoneNumber}:`, checkError);
                continue;
            }

            if (!existingPhone) {
                // Create new phone number record
                const phoneRecord = {
                    phone_number: phoneNumber,
                    phone_type: 'mobile',
                    is_primary: true,
                    do_not_call: false
                };

                const { data: createdPhone, error: createError } = await client
                    .from('phone_numbers')
                    .insert([phoneRecord])
                    .select('id, phone_number')
                    .single();

                if (createError) {
                    console.error(`Error creating phone number ${phoneNumber}:`, createError);
                    continue;
                }

                phoneRecords.push(createdPhone);
                console.log(`✅ Created phone number record for ${phoneNumber}`);
            }
        }

        console.log(`✅ Created ${phoneRecords.length} new phone number records`);

        // Step 5: Update calls with phone_number_id
        let updatedCalls = 0;
        for (const call of calls) {
            // Find the phone number record
            const { data: phoneRecord, error: findError } = await client
                .from('phone_numbers')
                .select('id')
                .eq('phone_number', call.phone_number)
                .single();

            if (findError) {
                console.error(`Error finding phone number for call ${call.id}:`, findError);
                continue;
            }

            if (phoneRecord) {
                // Update call with phone_number_id
                const { error: updateError } = await client
                    .from('calls')
                    .update({ phone_number_id: phoneRecord.id })
                    .eq('id', call.id);

                if (updateError) {
                    console.error(`Error updating call ${call.id}:`, updateError);
                } else {
                    updatedCalls++;
                }
            }
        }

        console.log(`✅ Updated ${updatedCalls} calls with phone_number_id`);

        // Step 6: Verify migration
        const { data: remainingCalls, error: verifyError } = await client
            .from('calls')
            .select('id, phone_number')
            .is('phone_number_id', null)
            .neq('phone_number', 'unknown');

        if (verifyError) {
            console.error('Error verifying migration:', verifyError);
        } else {
            console.log(`📊 Remaining calls without phone_number_id: ${remainingCalls.length}`);
        }

        console.log('✅ Phone number migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migratePhoneNumbers()
        .then(() => {
            console.log('🎉 Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migratePhoneNumbers }; 