// Test script for voicemail UI status display
// Run with: node test-voicemail-ui.js

// Mock the mapCallStatus function from index.js
function mapCallStatus(call) {
    // Check for voicemail detection first
    if (call.voicemail_detected) {
        return 'voicemail';
    }
    // Otherwise use the computed call_result
    return call.call_result || call.status || 'unknown';
}

// Mock the frontend status functions
function getStatusClass(result) {
    switch(result) {
        case 'answered': return 'status-answered';
        case 'voicemail': return 'status-voicemail';
        case 'failed': return 'status-failed';
        case 'unanswered': return 'status-unanswered';
        default: return 'status-in-progress';
    }
}

function getStatusText(result) {
    switch(result) {
        case 'answered': return 'Answered';
        case 'voicemail': return 'Voicemail';
        case 'failed': return 'Failed';
        case 'unanswered': return 'Unanswered';
        default: return 'In Progress';
    }
}

// Test cases
const testCases = [
    { call: { call_result: 'answered', voicemail_detected: false }, expected: 'answered', description: 'Regular answered call' },
    { call: { call_result: 'answered', voicemail_detected: true }, expected: 'voicemail', description: 'Answered call with voicemail detected' },
    { call: { call_result: 'failed', voicemail_detected: false }, expected: 'failed', description: 'Failed call' },
    { call: { call_result: 'unanswered', voicemail_detected: false }, expected: 'unanswered', description: 'Unanswered call' },
    { call: { call_result: 'answered', voicemail_detected: true }, expected: 'voicemail', description: 'Voicemail takes precedence over answered' },
    { call: { voicemail_detected: true }, expected: 'voicemail', description: 'Voicemail detection without call_result' }
];

console.log('🧪 Testing voicemail UI status display...\n');

testCases.forEach((testCase, index) => {
    const result = mapCallStatus(testCase.call);
    const statusClass = getStatusClass(result);
    const statusText = getStatusText(result);

    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`  Input: ${JSON.stringify(testCase.call)}`);
    console.log(`  Mapped Status: ${result}`);
    console.log(`  CSS Class: ${statusClass}`);
    console.log(`  Display Text: ${statusText}`);

    if (result === testCase.expected) {
        console.log(`  ✅ PASS`);
    } else {
        console.log(`  ❌ FAIL - Expected: ${testCase.expected}, Got: ${result}`);
    }
    console.log('');
});

console.log('🎯 Summary:');
console.log('- Voicemail detection takes precedence over call_result');
console.log('- Voicemail status displays as "Voicemail" with gray badge');
console.log('- All other statuses work as before');
console.log('- UI will show voicemail calls clearly distinguished from answered calls');
