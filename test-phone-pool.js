// Test script for global phone number pool functionality

// Import the database service
const SupabaseDBService = require('./services/supabase-db');
const dbService = new SupabaseDBService();

// Set up test data in database
async function setupTestData() {
    const testPhones = ['phone_001', 'phone_002', 'phone_003', 'phone_004', 'phone_005'];
    await dbService.setPhonePool(testPhones);
    console.log('✅ Test phone pool configured in database:', testPhones);
    return testPhones;
}

// Test the phone pool randomization
async function testPhonePool() {
    console.log('🧪 Testing Global Phone Number Pool Randomization (Database-stored)');

    // Setup test data
    const testPhones = await setupTestData();

    const results = {};
    const testRuns = 1000;

    // Run multiple tests to check distribution
    for (let i = 0; i < testRuns; i++) {
        const phone = await dbService.getRandomPhoneFromPool();
        results[phone] = (results[phone] || 0) + 1;
    }

    console.log('\n📊 Distribution Results:');
    Object.entries(results).forEach(([phone, count]) => {
        const percentage = ((count / testRuns) * 100).toFixed(1);
        console.log(`${phone}: ${count} times (${percentage}%)`);
    });

    console.log('\n✅ Phone pool randomization test completed!');
    console.log('Each phone should appear roughly the same number of times.');
    console.log('Expected per phone:', Math.round(testRuns / testPhones.length), 'times');
}

// Run the test
testPhonePool().catch(console.error);

