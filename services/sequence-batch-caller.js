const sequenceManager = require('./sequence-manager');
const elevenLabs = require('./elevenlabs');
const SupabaseDBService = require('./supabase-db');

class SequenceBatchCallerService {
    constructor() {
        this.enabled = false;
        this.maxRecipients = 50;
        this.intervalMs = 120000; // 2 minutes default
        this.lockSeconds = 600;
        this.scheduleOffsetSec = 0;
        this.maxJobsPerTick = 5;
        this.timer = null;
        this.isTicking = false;
        this.db = new SupabaseDBService();
    }

    updateConfigFromEnv() {
        const rawEnabled = (process.env.BATCH_CALLING_ENABLED ?? 'true').toString().trim().toLowerCase();
        this.enabled = !(rawEnabled === '0' || rawEnabled === 'false' || rawEnabled === 'no' || rawEnabled === 'off');

        const parsedMax = parseInt(process.env.BATCH_CALLING_MAX_RECIPIENTS || '50', 10);
        this.maxRecipients = Number.isFinite(parsedMax) && parsedMax > 0 ? Math.min(parsedMax, 50) : 50;

        const parsedInterval = parseInt(process.env.BATCH_CALLING_INTERVAL_MS || '120000', 10);
        this.intervalMs = Number.isFinite(parsedInterval) && parsedInterval >= 30000 ? parsedInterval : 120000;

        const parsedLock = parseInt(process.env.BATCH_CALLING_LOCK_SECONDS || '600', 10);
        this.lockSeconds = Number.isFinite(parsedLock) && parsedLock > 0 ? parsedLock : 600;

        const parsedSched = parseInt(process.env.BATCH_CALLING_SCHEDULE_OFFSET_SEC || '0', 10);
        this.scheduleOffsetSec = Number.isFinite(parsedSched) && parsedSched >= 0 ? parsedSched : 0;

        const parsedJobsPerTick = parseInt(process.env.BATCH_CALLING_MAX_JOBS_PER_TICK || '5', 10);
        this.maxJobsPerTick = Number.isFinite(parsedJobsPerTick) && parsedJobsPerTick > 0 ? parsedJobsPerTick : 5;
    }

    getStatus() {
        return {
            enabled: this.enabled,
            isTicking: this.isTicking,
            maxRecipients: this.maxRecipients,
            intervalMs: this.intervalMs,
            lockSeconds: this.lockSeconds,
            scheduleOffsetSec: this.scheduleOffsetSec,
            maxJobsPerTick: this.maxJobsPerTick
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
            // Fail fast if required env vars are missing (avoid claiming entries)
            const agentIdEnv = process.env.ELEVENLABS_AGENT_ID;
            const agentPhoneIdEnv = process.env.ELEVENLABS_PHONE_NUMBER_ID;
            if (!agentIdEnv || !agentPhoneIdEnv) {
                console.error('Missing ELEVENLABS_AGENT_ID or ELEVENLABS_PHONE_NUMBER_ID; skipping tick');
                return;
            }
            let totalJobsSubmitted = 0;
            let loopIndex = 0;
            while (totalJobsSubmitted < this.maxJobsPerTick) {
                // 1) Fetch up to maxRecipients entries ready for calling
                const ready = await this.db.getReadySequenceEntries(this.maxRecipients);
                if (!ready || ready.length === 0) {
                    if (totalJobsSubmitted === 0) {
                        console.log('✅ No ready sequence entries for batch');
                    }
                    break;
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
                    if (totalJobsSubmitted === 0) {
                        console.log('✅ Nothing to batch after claiming');
                    }
                    break;
                }

                // 3) Group entries by assigned agent (or fallback to env)
                const agentGroups = {};
                for (const entry of claimed) {
                    if (!entry?.phone_numbers?.phone_number) continue;

                    // Use assigned agent if present, otherwise use env fallback
                    const assignedAgentId = entry.assigned_agent_id || agentIdEnv;
                    let assignedAgentPhoneId = entry.assigned_agent_phone_number_id;

                    // If no phone assigned to agent, try global pool or env fallback
                    if (!assignedAgentPhoneId) {
                        assignedAgentPhoneId = await this.db.getRandomPhoneFromPool() || agentPhoneIdEnv;
                    }

                    if (!assignedAgentId || !assignedAgentPhoneId) {
                        console.warn(`⚠️ Skipping entry ${entry.id} - no agent assigned and no env fallback`);
                        continue;
                    }

                    const groupKey = `${assignedAgentId}:${assignedAgentPhoneId}`;
                    if (!agentGroups[groupKey]) {
                        agentGroups[groupKey] = {
                            agentId: assignedAgentId,
                            agentPhoneId: assignedAgentPhoneId,
                            entries: []
                        };
                    }
                    agentGroups[groupKey].entries.push(entry);
                }

                // 4) Process each agent group
                const callNameBase = `seq-batch-${new Date().toISOString()}-${loopIndex + 1}`;
                let jobsSubmittedThisLoop = 0;
                let anyChunkSucceeded = false;

                for (const [groupKey, group] of Object.entries(agentGroups)) {
                    if (totalJobsSubmitted >= this.maxJobsPerTick) break;

                    console.log(`🤖 Processing ${group.entries.length} entries for agent ${group.agentId}`);

                    // Build recipients array for this agent group
                    const recipients = group.entries.map(e => {
                        const tz = e?.sequences?.timezone || 'UTC';
                        const firstName = (e?.phone_numbers?.contacts?.first_name || '').trim() || null;
                        const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(new Date());

                        const agentFirstNameKey = process.env.BATCH_CALLING_FIRST_NAME_KEY || 'name_test';
                        const agentCompanyKey = process.env.BATCH_CALLING_COMPANY_KEY || 'company';
                        const agentRoleKey = process.env.BATCH_CALLING_ROLE_KEY || 'role';

                        const dynVars = {};
                        dynVars[agentFirstNameKey] = firstName || '';
                        dynVars.weekday = weekday;

                        // Add company and role from contact data if available
                        const company = e?.phone_numbers?.contacts?.company_name || '';
                        const role = e?.phone_numbers?.contacts?.position || '';

                        if (company) dynVars[agentCompanyKey] = company;
                        if (role) dynVars[agentRoleKey] = role;

                        return {
                            phone_number: e.phone_numbers.phone_number,
                            conversation_initiation_client_data: {
                                sequence_id: e?.sequences?.id,
                                sequence_entry_id: e?.id,
                                dynamic_variables: dynVars
                            },
                            source_info: {
                                source: 'sequence-batch',
                                sequence_id: e?.sequences?.id,
                                sequence_entry_id: e?.id
                            }
                        };
                    });

                    // Submit in chunks of 50 max for this agent
                    const chunks = [];
                    for (let i = 0; i < recipients.length; i += 50) {
                        chunks.push(recipients.slice(i, i + 50));
                    }

                    // Always schedule for now + offset (avoid null which can be rejected by some orgs)
                    let scheduled_time_unix = Math.floor(Date.now() / 1000) + this.scheduleOffsetSec;

                    for (let c = 0; c < chunks.length; c++) {
                        if (totalJobsSubmitted >= this.maxJobsPerTick) break;

                        const chunk = chunks[c];
                        const call_name = chunks.length === 1
                            ? `${callNameBase}-${group.agentId}`
                            : `${callNameBase}-${group.agentId}-${c + 1}`;

                        const resp = await elevenLabs.submitBatchCalling({
                            call_name,
                            agent_id: group.agentId,
                            agent_phone_number_id: group.agentPhoneId,
                            scheduled_time_unix,
                            recipients: chunk
                        });

                        if (!resp.success) {
                            console.error(`Batch submit error for agent ${group.agentId}:`, resp.error);
                            continue;
                        }

                        totalJobsSubmitted++;
                        jobsSubmittedThisLoop++;
                        anyChunkSucceeded = true;
                        console.log(`✅ Batch job submitted for agent ${group.agentId}: ${resp.job?.id} (${chunk.length} recipients)`);

                        // Update attempts/next_call_time only for entries in this successfully submitted chunk
                        const entryIdsForChunk = chunk
                            .map(r => r?.conversation_initiation_client_data?.sequence_entry_id)
                            .filter(id => !!id);

                        for (const entryId of entryIdsForChunk) {
                            try {
                                await this.db.updateSequenceEntryAfterCall(entryId, { successful: false });
                            } catch (e) {
                                console.warn(`Failed to update entry ${entryId} after batch submission: ${e.message}`);
                            }
                        }
                    }
                }

                if (!anyChunkSucceeded) {
                    console.warn('No batch jobs submitted, leaving entries claimed until lock expires');
                    break;
                }

                loopIndex++;
            }
        } catch (e) {
            console.error('Batch tick error:', e.message);
        } finally {
            this.isTicking = false;
        }
    }
}

module.exports = new SequenceBatchCallerService();


