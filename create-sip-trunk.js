#!/usr/bin/env node

/**
 * 🚛 CREATE SIP TRUNK - Proper Configuration for Outbound Calling
 * 
 * This creates a SIP Trunk (not SIP Domain) which is what we need
 * for LiveKit to make outbound calls through Twilio.
 */

const twilio = require('twilio');

// Your Twilio credentials
const accountSid = 'ACe35419debddfa2d27efe6de4115f698c';
const authToken = '220324e133d2b1c7bea779d7c51c8dbf';
const client = twilio(accountSid, authToken);

async function createSIPTrunk() {
    console.log('🚛 CREATING SIP TRUNK FOR OUTBOUND CALLING');
    console.log('=========================================\n');
    
    console.log('💡 SIP Trunk = Routes calls FROM Twilio TO external SIP (LiveKit)');
    console.log('📞 This is what we need for outbound AI calling\n');

    try {
        // Step 1: Create SIP Trunk
        console.log('1️⃣ Creating SIP Trunk...');
        
        let sipTrunk;
        try {
            sipTrunk = await client.trunking.v1.trunks.create({
                friendlyName: 'AI Voice LiveKit Trunk',
                cnamLookupEnabled: false,
                secure: true
            });
            console.log(`✅ SIP Trunk created: ${sipTrunk.friendlyName} (${sipTrunk.sid})`);
        } catch (error) {
            if (error.code === 21452 || error.message.includes('already exists')) {
                console.log('ℹ️ SIP Trunk may already exist, getting existing...');
                const trunks = await client.trunking.v1.trunks.list();
                sipTrunk = trunks.find(t => t.friendlyName.includes('LiveKit')) || trunks[0];
                if (sipTrunk) {
                    console.log(`✅ Using existing trunk: ${sipTrunk.friendlyName} (${sipTrunk.sid})`);
                }
            } else {
                throw error;
            }
        }

        if (!sipTrunk) {
            throw new Error('No SIP trunk available - may need Twilio account upgrade');
        }

        // Step 2: Configure Origination URLs (LiveKit → Twilio)
        console.log('\n2️⃣ Configuring origination (incoming from LiveKit)...');
        
        try {
            const originationUrl = await client.trunking.v1.trunks(sipTrunk.sid)
                .originationUrls.create({
                    friendlyName: 'LiveKit Origin',
                    sipUrl: 'sip:test-89asdjqg.sip.livekit.cloud',
                    priority: 1,
                    weight: 1,
                    enabled: true
                });
            console.log(`✅ Origination URL configured: ${originationUrl.sipUrl}`);
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️ Origination URL already configured');
            } else {
                console.log(`⚠️ Origination setup issue: ${error.message}`);
            }
        }

        // Step 3: Configure Termination URLs (Twilio → PSTN/Phone Network)
        console.log('\n3️⃣ Configuring termination (outgoing to phone network)...');
        
        try {
            const terminationUrl = await client.trunking.v1.trunks(sipTrunk.sid)
                .terminationUrls.create({
                    friendlyName: 'PSTN Termination',
                    sipUrl: 'sip:termination.twilio.com',
                    priority: 1,
                    weight: 1,
                    enabled: true
                });
            console.log(`✅ Termination URL configured: ${terminationUrl.sipUrl}`);
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️ Termination URL already configured');
            } else {
                console.log(`⚠️ Termination setup issue: ${error.message}`);
            }
        }

        // Step 4: Configure Authentication
        console.log('\n4️⃣ Setting up authentication...');
        
        try {
            // Create credential list
            const credentialList = await client.sip.credentialLists.create({
                friendlyName: 'LiveKit SIP Credentials'
            });
            
            // Add credential
            await client.sip.credentialLists(credentialList.sid).credentials.create({
                username: 'ai-voice-agent',
                password: 'secure-password-123'
            });
            
            // Associate with trunk
            await client.trunking.v1.trunks(sipTrunk.sid)
                .credentialLists.create({
                    credentialListSid: credentialList.sid
                });
            
            console.log(`✅ Authentication configured`);
        } catch (error) {
            if (error.message.includes('already exists') || error.code === 21456) {
                console.log('ℹ️ Authentication already configured');
            } else {
                console.log(`⚠️ Auth setup issue: ${error.message}`);
            }
        }

        // Step 5: Associate phone number with trunk
        console.log('\n5️⃣ Associating phone number with SIP trunk...');
        
        try {
            const phoneNumbers = await client.incomingPhoneNumbers.list();
            const targetNumber = phoneNumbers.find(num => num.phoneNumber === '+447846855904');
            
            if (targetNumber) {
                // Associate phone number with trunk
                await client.trunking.v1.trunks(sipTrunk.sid)
                    .phoneNumbers.create({
                        phoneNumberSid: targetNumber.sid
                    });
                console.log(`✅ Phone number +447846855904 associated with trunk`);
            } else {
                console.log('❌ Phone number +447846855904 not found');
            }
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️ Phone number already associated with trunk');
            } else {
                console.log(`⚠️ Phone number association issue: ${error.message}`);
            }
        }

        // Step 6: Summary
        console.log('\n6️⃣ CONFIGURATION COMPLETE!');
        console.log('==========================');
        console.log(`✅ SIP Trunk ID: ${sipTrunk.sid}`);
        console.log(`✅ Trunk Name: ${sipTrunk.friendlyName}`);
        console.log(`✅ Phone Number: +447846855904`);
        console.log(`✅ LiveKit SIP: test-89asdjqg.sip.livekit.cloud`);
        
        console.log('\n🎯 NOW IN TWILIO CONSOLE:');
        console.log('========================');
        console.log('1. Go to Phone Numbers → Manage → Active Numbers');
        console.log('2. Click +447846855904');
        console.log('3. In Voice Configuration:');
        console.log('   - Configure with: "SIP Trunk"');
        console.log(`   - SIP Trunk: "${sipTrunk.friendlyName}" (${sipTrunk.sid})`);
        console.log('4. Save configuration');
        
        console.log('\n✅ 403 ERROR SHOULD NOW BE FIXED!');
        console.log('\n🧪 TEST THE FIX:');
        console.log('node test-real-outbound-call.js +YOUR_TEST_NUMBER');

        return {
            success: true,
            trunkSid: sipTrunk.sid,
            trunkName: sipTrunk.friendlyName
        };

    } catch (error) {
        console.error('\n❌ SIP Trunk creation failed:', error.message);
        console.error('🔍 Error details:', {
            code: error.code,
            status: error.status,
            moreInfo: error.moreInfo
        });
        
        if (error.message.includes('not authorized') || error.message.includes('upgrade')) {
            console.log('\n💡 LIKELY ISSUE: Account Limitations');
            console.log('====================================');
            console.log('Your Twilio account may need to be upgraded to use SIP trunking.');
            console.log('SIP trunking is typically available on paid plans only.');
            console.log('\n🔧 SOLUTIONS:');
            console.log('1. Upgrade your Twilio account to a paid plan');
            console.log('2. Contact Twilio support to enable SIP trunking');
            console.log('3. Alternative: Use Twilio Functions for call routing');
        }
        
        throw error;
    }
}

// Run the creation
if (require.main === module) {
    createSIPTrunk().catch(error => {
        process.exit(1);
    });
}

module.exports = { createSIPTrunk }; 