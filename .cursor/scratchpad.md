### Background and Motivation

We need to decouple Gemini transcript analysis from the call sync flow so that syncing can enqueue arbitrarily many analyses while a background queue drains at a fixed rate. We also need robust retry/backoff on transient errors, status metrics, and a backfill endpoint to enqueue calls missing analysis.

### What Was Done (So Far)
- Final calls only are persisted; `call_result` computed via `computeOutcomeFrom(status_raw, duration)` and written to `calls`.
- Transcriptions are replaced on reprocess: delete-by-`call_id`, then insert new messages.
- Booking analysis is idempotent: `booking_analysis` upserted by `call_id` (DB enforces UNIQUE(call_id)).
- Phase 1 complete: Gemini analysis reads batch and retry settings from environment variables with safe defaults.

### Technical Specs (Targeted)
- `services/call-sync.js`
  - Fire-and-forget enqueue for analysis during sync; do not await per-item analysis. Results are upserted by `call_id` as they arrive.
- `services/supabase-db.js`
  - `insertBookingAnalysis(bookingData)`: UPSERT on `call_id`.
  - Add helper to query calls missing analysis for backfill.
- `services/gemini-analysis.js`
  - Read env-configured batch and retry settings; process in batches with optional per-item stagger; capped exponential backoff on retryable errors; expose queue/metrics.
- Routes in `index.js`
  - `GET /api/gemini/status` for queue/metrics, `POST /api/analysis/backfill` to enqueue missing analyses.

### Key Challenges and Analysis
- Decoupling analysis from sync without losing results: use enqueue + idempotent upsert by `call_id`.
- Rate limiting with retries: batch window limiter and exponential backoff with jitter.
- Observability: expose metrics for queue length, processing, processed/failed counts, retries, last errors.

### Database Schema (Quick Reference)
- Core tables: `contacts`, `phone_numbers`, `calls`, `transcriptions`, `events`, `booking_analysis`, `sequences`, `sequence_entries`.
- Constraints:
  - `booking_analysis(call_id)` UNIQUE (one analysis row per call).
  - `sequence_entries(sequence_id, phone_number_id)` UNIQUE (prevents duplicates).
- Triggers: `update_updated_at` on major tables including `booking_analysis`.
- View: `calls_with_analysis` joins `calls` with contact and analysis fields for filtering/sorting.
- Indexes: on common filters (phone, status, call_result, timestamps, sequence fields). See full definitions in `supabase-schema.sql`.

### High-level Task Breakdown
1) Phase 1: Configuration
   - Add env flags: `GEMINI_BATCH_SIZE`, `GEMINI_BATCH_INTERVAL_MS`, `GEMINI_MAX_RETRIES`, `GEMINI_RETRY_BASE_MS`; default to safe values if absent.
   - Success criteria: Service reads values at startup; reporting endpoint reflects configured values.
2) Phase 2: Make sync fire-and-forget
   - Replace `await analyzeTranscript` with `then(storeAnalysisResults).catch(log)` in `processDetailedConversation`.
   - Success criteria: `/api/sync-calls` returns without waiting for queue drain; analyses continue in background and persist.
3) Phase 3: Harden Gemini analysis queue
   - Batch processing per env; 100–200ms stagger within a batch.
   - Retry on 429/503/timeouts/ECONNRESET/quota with capped backoff and jitter; stop after max retries and mark failed.
   - Metrics: queueLength, isProcessing, processedCount, failedCount, retryCount, lastBatchAt, lastErrorCode, lastErrorAt.
   - Success criteria: Status endpoint shows metrics updating during load tests; retries/backoff observed in logs.

### Project Status Board
- [x] Phase 1: Env-driven configuration for Gemini batch and retry settings
- [x] Phase 2: Fire-and-forget enqueue in `services/call-sync.js`
- [x] Phase 3: Retry/backoff, stagger, and metrics in `services/gemini-analysis.js`
- [x] Status route and backfill route in `index.js`
 - [x] Supabase DB: add `getAllCalls()` for maintenance scripts
 - [x] Harden `/make-call` to require env IDs (no baked-in defaults)
 - [x] Validate request body for `/api/sequences/:id/entries`
 - [x] Fix `parseInt` radix usage for env parsing in `services/gemini-analysis.js`

### Executor's Feedback or Assistance Requests
- Please set environment variables where the server runs:
  - `GEMINI_API_KEY`
  - `GEMINI_BATCH_SIZE=10`
  - `GEMINI_BATCH_INTERVAL_MS=70000`
  - `GEMINI_MAX_RETRIES=4`
  - `GEMINI_RETRY_BASE_MS=1500`
- Manual test suggestions:
  - Trigger `/api/sync-calls` and observe immediate response; then call `GET /api/gemini/status` to watch `queueLength` drain over time.
  - Use `POST /api/analysis/backfill` to enqueue any calls missing analysis and confirm rows upsert into `booking_analysis`.

### Lessons
- Include info useful for debugging in logs and endpoint outputs.
- Read files before editing; prefer UPSERT for idempotency on `call_id`.
 - Avoid hardcoded API IDs in server routes; fail fast when env is missing.
 - Always pass radix=10 to `parseInt` and validate env-derived numbers.


database schema is in supabase-schema.sql

### Background and Motivation (Addendum: Sequence Caller)

We also need a background sequence caller to periodically pull ready `sequence_entries` and place outbound calls via ElevenLabs. Requirements: run on an interval, advance to the next step immediately after initiating a call, avoid race conditions/duplicate dialing across overlapping ticks or multiple instances, be toggleable via environment variables, expose a status endpoint, and support graceful shutdown.

### Technical Specs (Sequence Caller Background Runner)

- `services/sequence-caller.js`
  - Reads env at startup: `SEQUENCE_CALLER_ENABLED` (bool), `SEQUENCE_CALLER_BATCH_SIZE` (int), `SEQUENCE_CALLER_INTERVAL_MS` (int), `SEQUENCE_CALLER_LOCK_SECONDS` (int, optional).
  - Exposes `start()`, `stop()`, `getStatus()`, `updateConfigFromEnv()`.
  - Maintains metrics: `enabled`, `isTicking`, `ticks`, `lastTickStartedAt`, `lastTickFinishedAt`, `lastTickDurationMs`, `callsInitiated`, `errors`, `config`.
  - Interval tick (non-overlapping): if already ticking, skip; else call `sequenceManager.processReadySequenceEntries(batchSize)` and update metrics.
  - Graceful shutdown: `stop()` clears timer and waits for any in-flight tick to finish.
- `services/sequence-manager.js`
  - Keep immediate advancement behavior: after initiating a call, schedule the next attempt via `updateSequenceEntryAfterCall`.
  - Continue atomic claims with `claimSequenceEntry(entry.id, lockSeconds)`. Allow `lockSeconds` to be read from `SEQUENCE_CALLER_LOCK_SECONDS` (default 120s).
- `index.js`
  - Initialize the sequence caller during server start if `SEQUENCE_CALLER_ENABLED=true`.
  - Add `GET /api/sequence-caller/status` to return `sequenceCaller.getStatus()`.
  - Add `SIGINT`/`SIGTERM` handlers to call `sequenceCaller.stop()` before exit.

Environment variables (with defaults):
- `SEQUENCE_CALLER_ENABLED=false`
- `SEQUENCE_CALLER_BATCH_SIZE=10`
- `SEQUENCE_CALLER_INTERVAL_MS=60000`
- `SEQUENCE_CALLER_LOCK_SECONDS=120`

### Key Challenges and Analysis (Addendum: Sequence Caller)

- Overlapping ticks: prevent with in-process `isTicking` guard; if a tick is still running, skip the next.
- Multi-instance safety: use `claimSequenceEntry` to set a short-lived lock on `next_call_time` so other workers won't pick the same entry.
- Immediate advancement: schedule the next attempt in `sequence-manager` right after dialing; call completion and final status handled by webhook `/webhook/elevenlabs-call-ended`.
- Respect DNC and paused sequences: already enforced by `getReadySequenceEntries` and subsequent checks.
- Observability: simple metrics via `/api/sequence-caller/status` including config, last tick timings, initiation counts, errors.

### High-level Task Breakdown (Additions)

4) Sequence Caller: Background Runner and Controls
   - Add env flags: `SEQUENCE_CALLER_ENABLED`, `SEQUENCE_CALLER_BATCH_SIZE`, `SEQUENCE_CALLER_INTERVAL_MS`, `SEQUENCE_CALLER_LOCK_SECONDS`.
   - Implement `services/sequence-caller.js` with `start/stop/status`, non-overlapping interval `tick()` and metrics.
   - Update `services/sequence-manager.js` to read optional lock seconds from env when claiming entries.
   - Wire in `index.js`: initialize on boot (if enabled), add `/api/sequence-caller/status`, and graceful shutdown handlers.
   - Success criteria:
     - When enabled, initiates up to `SEQUENCE_CALLER_BATCH_SIZE` calls every `SEQUENCE_CALLER_INTERVAL_MS`.
     - No duplicate dialing across overlapping ticks or across multiple app instances (verified by logs and DB state).
     - Status endpoint reflects live metrics; disabling via env stops background dialing.

### Project Status Board (Additions)

- [ ] Sequence Caller: Env flags and defaults
- [ ] Sequence Caller: Implement `services/sequence-caller.js`
- [ ] Sequence Caller: Wire-up in `index.js` and add status endpoint
- [ ] Sequence Caller: Graceful shutdown on SIGINT/SIGTERM
- [ ] Sequence Caller: Manual QA (multi-instance, overlapping ticks, config toggles)
 - [x] Sequence Caller: Pass `name_test` and `weekday` dynamic variables from `services/sequence-manager.js` using sequence timezone

### Executor's Feedback or Assistance Requests (Additions)

- Please set:
  - `SEQUENCE_CALLER_ENABLED=true`
  - `SEQUENCE_CALLER_BATCH_SIZE` to your desired concurrent batch size per tick (e.g., 5)
  - `SEQUENCE_CALLER_INTERVAL_MS` to your desired interval between batches (e.g., 60000 for 60s)
  - `SEQUENCE_CALLER_LOCK_SECONDS=120`
- Confirm how many app instances will run concurrently; DB claim locks are designed to handle multi-instance safety.
 - Verify in ElevenLabs dashboard or logs that `dynamic_variables` include `name_test` and `weekday` for sequence calls. Weekday is computed in the sequence timezone; `name_test` is null when contact first name is missing.

### Project Status Board (Batch Calling Switch)

- [x] Disable individual per-number caller by default (`SEQUENCE_CALLER_ENABLED` now defaults to false)
- [x] Keep batch caller enabled by default (`BATCH_CALLING_ENABLED=true` default preserved)
- [x] Reduce batch tick default from 1h to 2 min (`BATCH_CALLING_INTERVAL_MS` default 120000)
- [x] Implement draining loop in `services/sequence-batch-caller.js` to submit multiple jobs per tick
- [x] Add `BATCH_CALLING_MAX_JOBS_PER_TICK` (default 5) guard to cap jobs per tick
- [x] Expose `maxJobsPerTick` in `/api/sequence-batch-caller/status`
 - [x] Batch payload fix: remove unsupported `source_info` from recipients and set `scheduled_time_unix` to now + offset
 - [x] Fail-fast guard: skip claiming if `ELEVENLABS_AGENT_ID`/`ELEVENLABS_PHONE_NUMBER_ID` missing
 - [x] Update only successfully submitted entries per chunk instead of all claimed
 - [x] Always include configurable first-name key in `dynamic_variables` (env: `BATCH_CALLING_FIRST_NAME_KEY`, default `name_test`); send empty string when missing

### Decommission Legacy Sequence Caller

- [x] Remove `services/sequence-caller.js`
- [x] Remove import, startup, stop hooks, and status endpoint from `index.js`
- [x] Remove Sequence Caller status UI and JS from `public/index.html`
- [x] Update any `source_info` references to `sequence-batch` where applicable

### Executor's Feedback or Assistance Requests (Batch Calling Switch)

- Please ensure envs (only if you override defaults):
  - `SEQUENCE_CALLER_ENABLED=false` (now the default; set explicitly if previously true)
  - `BATCH_CALLING_ENABLED=true` (default)
  - `BATCH_CALLING_INTERVAL_MS=120000` (2 minutes)
  - `BATCH_CALLING_MAX_RECIPIENTS=50` (API max per job; default enforced)
  - `BATCH_CALLING_MAX_JOBS_PER_TICK=5` (optional; increases/decreases throughput)
- Manual QA:
  - GET `/api/sequence-batch-caller/status` → `enabled=true`, `intervalMs≈120000`, `maxJobsPerTick=5`.
  - Load >50 ready entries; observe multiple batch submissions per tick until capped by `maxJobsPerTick`.
  - Confirm sequence entries are advanced immediately after submission.
  - Validate ElevenLabs job submissions succeed (no 400/422). Check that recipients only include `phone_number`, `conversation_initiation_client_data`, and `dynamic_variables`.
  - Verify `scheduled_time_unix` on requests equals current time ± `BATCH_CALLING_SCHEDULE_OFFSET_SEC`.
  - Simulate missing envs and ensure tick logs error and does not claim entries.
  - Set `BATCH_CALLING_FIRST_NAME_KEY` to match the agent (e.g., `user_name`), confirm `dynamic_variables` always includes that key; when first name absent, value is `""`.

### Background and Motivation (Addendum: Contact Import Phone Normalization)

Users often provide international phone numbers with embedded spaces (e.g., "+44 7515 88089"). Our current CSV/XLSX import rejects these in early validation, even though later normalization can handle them. We should strip whitespace prior to validation so spaced numbers are accepted and normalized consistently.

### Key Challenges and Analysis (Contact Import)

- Early validation in `parseCSVRow` uses a strict regex that fails on spaces.
- The later `normalizePhoneNumber` already removes non-digits except "+", but it is never reached if validation fails first.
- Must ensure deduplication and sequence-adding flows remain unchanged (phone stored in canonical `+E.164` format).

### High-level Task Breakdown (Contact Import)

1) Parser: Strip all whitespace from `phone_number` in `parseCSVRow` before validation.
   - Success: "+44 7515 88089" passes validation and proceeds to normalization.
2) Normalization: Reuse existing `normalizePhoneNumber` (no behavior change) during row processing.
   - Success: Stored number becomes `+44751588089`.
3) UI copy: Update upload modal to tell users spaces are OK.
   - Success: Copy mentions acceptance of spaces with example.
4) Manual QA: Upload CSV and XLSX with spaced numbers; verify contacts/phones created and sequences can be populated.
   - Success: No errors; duplicates still detected; sequence add works.

### Project Status Board (Contact Import)

- [x] Contact Import: Strip whitespace before validation in `parseCSVRow`
- [x] Contact Import: Update upload modal copy to mention spaces are OK
- [ ] Contact Import: Manual QA for CSV/XLSX with spaced numbers

### Executor's Feedback or Assistance Requests (Agent Assignment Config Column)

- Observed error when creating/updating sequences with agent config: "Could not find the 'agent_assignment_config' column of 'sequences' in the schema cache". This indicates the DB migration hasn't been applied.
- Implemented backend fallback: if the column is missing, create/update proceeds without `agent_assignment_config` (feature disabled until migration).
- Please run the migration to enable the feature fully.

Migration steps (Supabase SQL):
1) Open SQL editor and run statements from `migration-sequence-beta-testing.sql`:
   - Add `agent_assignment_config` JSONB to `sequences`
   - Add assignment columns to `sequence_entries` and index
2) If using CLI, apply the SQL file directly.
3) After running, refresh schema cache (Supabase auto-refreshes; otherwise do a quick SELECT on `sequences`).

Verification:
- `select agent_assignment_config from sequences limit 1;` should succeed.
- Create/edit a sequence with Single/Distribute agent config; it should persist.

### Project Status Board (Agent Assignment Config)

- [x] UI: Hidden-required fix for distribute agents inputs in `public/index.html`
- [x] UI: Optional phone IDs in single/distribute config
- [x] UI: Initialize toggle/required state on open and changes
- [x] Backend: Fallback when `agent_assignment_config` column missing (graceful degrade)
- [ ] Ops: Apply `migration-sequence-beta-testing.sql` to add the missing column

### Lessons (Addendum)

- When adding optional JSON config columns, guard server writes with fallbacks so core flows work even if migrations are pending.
