'use strict';

const https = require('https');

function postJson(url, payload, headers = {}) {
	return new Promise((resolve, reject) => {
		const body = JSON.stringify(payload);
		const u = new URL(url);
		const options = {
			method: 'POST',
			hostname: u.hostname,
			path: u.pathname + (u.search || ''),
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'Content-Length': Buffer.byteLength(body),
				...headers
			}
		};

		const req = https.request(options, (res) => {
			let data = '';
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => {
				let parsed;
				try {
					parsed = data ? JSON.parse(data) : {};
				} catch (_) {
					parsed = { raw: data };
				}
				if (res.statusCode >= 200 && res.statusCode < 300) {
					resolve({ statusCode: res.statusCode, data: parsed });
				} else {
					const errorMessage = parsed?.detail || parsed?.message || `HTTP ${res.statusCode}`;
					const error = new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
					error.statusCode = res.statusCode;
					error.response = parsed;
					reject(error);
				}
			});
		});

		req.on('error', reject);
		req.write(body);
		req.end();
	});
}

(async () => {
	try {
		const apiKey = process.env.ELEVENLABS_API_KEY;
		const agentId = process.env.ELEVENLABS_AGENT_ID;
		const agentPhoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

		if (!apiKey) {
			console.error('ELEVENLABS_API_KEY is required');
			process.exit(1);
		}
		if (!agentId || !agentPhoneNumberId) {
			console.error('Missing ELEVENLABS_AGENT_ID or ELEVENLABS_PHONE_NUMBER_ID');
			process.exit(1);
		}

		const callName = `manual-batch-${new Date().toISOString()}`;
		const payload = {
			call_name: callName,
			agent_id: agentId,
			agent_phone_number_id: agentPhoneNumberId,
			scheduled_time_unix: Math.floor(Date.now() / 1000), // Current time in Unix seconds
			recipients: [
				{
					phone_number: '+33643584946',
					conversation_initiation_client_data: {
						source: 'manual-script',
						request_id: callName,
						dynamic_variables: {
							name_test: 'Martin',
							weekday: 'Monday',
							company: 'Test Company',
							role: 'Test Manager'
						}
					},
					source_info: {
						source: 'manual-batch-script',
						test_run: true
					}
				}
			]
		};

		console.log('Submitting ElevenLabs batch calling job...');
		console.log('Payload:', JSON.stringify(payload, null, 2));
		console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
		console.log('Agent ID:', agentId);
		console.log('Phone Number ID:', agentPhoneNumberId);
		console.log('Raw HTTP Body that will be sent:');
		console.log(JSON.stringify(payload));
		
		try {
			const response = await postJson(
				'https://api.elevenlabs.io/v1/convai/batch-calling/submit',
				payload,
				{ 'xi-api-key': apiKey }
			);

			console.log('✅ Batch job submitted successfully');
			console.log('Response:', JSON.stringify(response, null, 2));
		} catch (apiError) {
			console.error('API call failed:', apiError.message);
			throw apiError;
		}
		process.exit(0);
	} catch (err) {
		console.error('Unexpected error submitting batch job:', err.message || err);
		console.error('Full error:', err);
		process.exit(1);
	}
})();


