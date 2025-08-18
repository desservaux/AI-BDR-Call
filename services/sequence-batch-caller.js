const sequenceManager = require('./sequence-manager');
const elevenLabs = require('./elevenlabs');
const SupabaseDBService = require('./supabase-db');

class SequenceBatchCallerService {
    constructor() {
        this.enabled = false;
        this.maxRecipients = 50;
        this.intervalMs = 3600000; // 1 hour
        this.lockSeconds = 600;
        this.scheduleOffsetSec = 0;
        this.timer = null;
        this.isTicking = false;
        this.db = new SupabaseDBService();
    }

    updateConfigFromEnv() {
        const rawEnabled = (process.env.BATCH_CALLING_ENABLED ?? 'true').toString().trim().toLowerCase();
        this.enabled = !(rawEnabled === '0' || rawEnabled === 'false' || rawEnabled === 'no' || rawEnabled === 'off');

        const parsedMax = parseInt(process.env.BATCH_CALLING_MAX_RECIPIENTS || '50', 10);
        this.maxRecipients = Number.isFinite(parsedMax) && parsedMax > 0 ? Math.min(parsedMax, 50) : 50;

        const parsedInterval = parseInt(process.env.BATCH_CALLING_INTERVAL_MS || '3600000', 10);
        this.intervalMs = Number.isFinite(parsedInterval) && parsedInterval >= 30000 ? parsedInterval : 3600000;

        const parsedLock = parseInt(process.env.BATCH_CALLING_LOCK_SECONDS || '600', 10);
        this.lockSeconds = Number.isFinite(parsedLock) && parsedLock > 0 ? parsedLock : 600;

        const parsedSched = parseInt(process.env.BATCH_CALLING_SCHEDULE_OFFSET_SEC || '0', 10);
        this.scheduleOffsetSec = Number.isFinite(parsedSched) && parsedSched >= 0 ? parsedSched : 0;
    }

    getStatus() {
        return {
            enabled: this.enabled,
            isTicking: this.isTicking,
            maxRecipients: this.maxRecipients,
            intervalMs: this.intervalMs,
            lockSeconds: this.lockSeconds,
            scheduleOffsetSec: this.scheduleOffsetSec
        };
    }

    start() {
        this.updateConfigFromEnv();
        if (!this.enabled) {
            console.log('⏸️ Sequence Batch Caller disabled (BATCH_CALLING_ENABLED=false)');
            return false;
        }
        if (!sequenceManager.initialized) {
            sequenceManager.initialize().catch(e => console.error('SequenceManager init failed:', e.message));
        }
        if (this.timer) clearInterval(this.timer);
        console.log(`⏱️ Starting Sequence Batch Caller: maxRecipients=${this.maxRecipients}, intervalMs=${this.intervalMs}`);
        this.timer = setInterval(() => this.tick().catch(() => {}), this.intervalMs);
        // Kick first tick immediately
        this.tick().catch(() => {});
        return true;
    }

    async stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        const start = Date.now();
        while (this.isTicking && Date.now() - start < 10000) {
            await new Promise(r => setTimeout(r, 100));
        }
        console.log('🛑 Sequence Batch Caller stopped');
    }

    async tick() {
        if (this.isTicking) return;
        this.isTicking = true;
        try {
            // 1) Fetch up to maxRecipients entries ready for calling
            const ready = await this.db.getReadySequenceEntries(this.maxRecipients);
            if (!ready || ready.length === 0) {
                console.log('✅ No ready sequence entries for batch');
                return;
            }

            // 2) Claim entries to avoid double-submission
            const claimed = [];
            for (const entry of ready) {
                try {
                    const ok = await this.db.claimSequenceEntry(entry.id, this.lockSeconds);
                    if (ok) claimed.push(entry);
                } catch (_) {
                    // skip on claim failure
                }
            }
            if (claimed.length === 0) {
                console.log('✅ Nothing to batch after claiming');
                return;
            }

            // 3) Build recipients array with per-recipient dynamic variables
            const recipients = claimed
                .filter(e => e?.phone_numbers?.phone_number)
                .map(e => {
                    const tz = e?.sequences?.timezone || 'UTC';
                    const firstName = (e?.phone_numbers?.contacts?.first_name || '').trim() || null;
                    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(new Date());

                    const convData = {};
                    // Only include dynamic_variables if there is at least one meaningful value
                    const dyn = {};
                    if (firstName) dyn.name_test = firstName;
                    dyn.weekday = weekday;
                    convData.dynamic_variables = dyn;
                    convData.source_info = { source: 'twilio' };

                    return {
                        phone_number: e.phone_numbers.phone_number,
                        conversation_initiation_client_data: convData
                    };
                });

            // 4) Submit in chunks of 50 max
            const chunks = [];
            for (let i = 0; i < recipients.length; i += 50) {
                chunks.push(recipients.slice(i, i + 50));
            }

            const agentId = process.env.ELEVENLABS_AGENT_ID;
            const agentPhoneId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
            if (!agentId || !agentPhoneId) {
                console.error('Missing ELEVENLABS_AGENT_ID or ELEVENLABS_PHONE_NUMBER_ID');
                return;
            }

            let scheduled_time_unix = null;
            if (this.scheduleOffsetSec > 0) {
                scheduled_time_unix = Math.floor((Date.now() + this.scheduleOffsetSec * 1000) / 1000);
            }

            const callNameBase = `seq-batch-${new Date().toISOString()}`;
            let jobsSubmitted = 0;

            for (let c = 0; c < chunks.length; c++) {
                const chunk = chunks[c];
                const call_name = chunks.length === 1 ? callNameBase : `${callNameBase}-${c + 1}`;
                const resp = await elevenLabs.submitBatchCalling({
                    call_name,
                    agent_id: agentId,
                    agent_phone_number_id: agentPhoneId,
                    scheduled_time_unix,
                    recipients: chunk
                });
                if (!resp.success) {
                    console.error('Batch submit error:', resp.error);
                    continue;
                }
                jobsSubmitted++;
                console.log(`✅ Batch job submitted: ${resp.job?.id} (${chunk.length} recipients)`);
            }

            if (jobsSubmitted > 0) {
                // 5) Bump attempt and schedule next_call_time for each claimed entry
                for (const entry of claimed) {
                    try {
                        await this.db.updateSequenceEntryAfterCall(entry.id, { successful: false });
                    } catch (e) {
                        console.warn(`Failed to update entry ${entry.id} after batch submission: ${e.message}`);
                    }
                }
            } else {
                console.warn('No batch jobs submitted, leaving entries claimed until lock expires');
            }
        } catch (e) {
            console.error('Batch tick error:', e.message);
        } finally {
            this.isTicking = false;
        }
    }
}

module.exports = new SequenceBatchCallerService();


