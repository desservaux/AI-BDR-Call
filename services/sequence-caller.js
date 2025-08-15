const sequenceManager = require('./sequence-manager');

class SequenceCallerService {
	constructor() {
		this.enabled = false;
		this.batchSize = 10;
		this.intervalMs = 60000;
		this.timer = null;
		this.isTicking = false;
		this.metrics = {
			enabled: false,
			isTicking: false,
			ticks: 0,
			lastTickStartedAt: null,
			lastTickFinishedAt: null,
			lastTickDurationMs: null,
			callsInitiated: 0,
			errors: [],
			config: {}
		};
	}

	updateConfigFromEnv() {
		const rawEnabled = process.env.SEQUENCE_CALLER_ENABLED;
		const normalized = String(rawEnabled === undefined || rawEnabled === null ? '' : rawEnabled).trim().toLowerCase();
		// Default to enabled when not provided; only disable on explicit false-like values
		if (normalized === '') {
			this.enabled = true;
		} else {
			this.enabled = !(normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off');
		}
		const parsedBatch = parseInt(process.env.SEQUENCE_CALLER_BATCH_SIZE || '10', 10);
		this.batchSize = Number.isFinite(parsedBatch) && parsedBatch > 0 ? parsedBatch : 10;
		const parsedInterval = parseInt(process.env.SEQUENCE_CALLER_INTERVAL_MS || '60000', 10);
		this.intervalMs = Number.isFinite(parsedInterval) && parsedInterval >= 1000 ? parsedInterval : 60000;
		this.metrics.config = {
			enabled: this.enabled,
			batchSize: this.batchSize,
			intervalMs: this.intervalMs,
			lockSeconds: parseInt(process.env.SEQUENCE_CALLER_LOCK_SECONDS || '120', 10)
		};
	}

	getStatus() {
		return {
			...this.metrics
		};
	}

	async tick() {
		if (this.isTicking) {
			// Prevent overlapping ticks
			return;
		}
		this.isTicking = true;
		this.metrics.isTicking = true;
		this.metrics.lastTickStartedAt = new Date().toISOString();
		const started = Date.now();
		try {
			const result = await sequenceManager.processReadySequenceEntries(this.batchSize);
			this.metrics.callsInitiated += (result && result.calls_initiated) ? result.calls_initiated : 0;
			this.metrics.ticks += 1;
		} catch (error) {
			this.metrics.errors.push(`${new Date().toISOString()}: ${error.message}`);
			if (this.metrics.errors.length > 50) {
				this.metrics.errors = this.metrics.errors.slice(-50);
			}
		} finally {
			this.metrics.lastTickFinishedAt = new Date().toISOString();
			this.metrics.lastTickDurationMs = Date.now() - started;
			this.isTicking = false;
			this.metrics.isTicking = false;
		}
	}

	start() {
		this.updateConfigFromEnv();
		if (!this.enabled) {
			console.log('⏸️ Sequence Caller disabled (SEQUENCE_CALLER_ENABLED=false)');
			this.metrics.enabled = false;
			return false;
		}
		this.metrics.enabled = true;
		// Ensure sequence manager is initialized
		if (!sequenceManager.initialized) {
			console.log('🔧 Initializing Sequence Manager for Sequence Caller...');
			// Fire and forget; processReadySequenceEntries will throw if not ready
			sequenceManager.initialize().catch(err => {
				console.error('❌ Failed to initialize Sequence Manager:', err.message);
			});
		}
		if (this.timer) {
			clearInterval(this.timer);
		}
		console.log(`⏱️ Starting Sequence Caller: batchSize=${this.batchSize}, intervalMs=${this.intervalMs}`);
		this.timer = setInterval(() => {
			this.tick();
		}, this.intervalMs);
		// Kick an immediate first tick
		this.tick();
		return true;
	}

	async stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		// Wait briefly for in-flight tick
		const waitStart = Date.now();
		while (this.isTicking && Date.now() - waitStart < 10000) {
			await new Promise(r => setTimeout(r, 100));
		}
		console.log('🛑 Sequence Caller stopped');
	}
}

module.exports = new SequenceCallerService();


