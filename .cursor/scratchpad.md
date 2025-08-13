### Background and Motivation

Keep a compact, high-signal record of the completed work, key learnings, implementation specs, and database schema references.

### What Was Done (Final State)
- Final calls only are persisted; `call_result` computed via `computeOutcomeFrom(status_raw, duration)` and written to `calls`.
- Transcriptions are replaced on reprocess: delete-by-`call_id`, then insert new messages.
- Booking analysis is idempotent: `booking_analysis` upserted by `call_id` (DB enforces UNIQUE(call_id)).
- Gemini analysis uses strict batch rate limiting: up to 10 requests per 60 seconds; status reflects batch config and queue length.
- Sequences dialing respects pause: DB query excludes inactive sequences; dialer also guards and skips paused sequences.
- Concurrency protections: optimistic claim of sequence entries; accurate delete counts in cleanup; idempotent sequence add (unique `(sequence_id, phone_number_id)`).
- API/data consistency: server-side ordering with Node fallback; advanced filtering via `calls_with_analysis` view.

### Technical Specs (Current)
- `services/call-sync.js`
  - `processConversation`: skips non-final calls, fetches details, creates/updates minimal row, calls `processDetailedConversation`.
  - `processDetailedConversation`: updates call fields, replaces transcriptions, triggers Gemini analysis when eligible.
- `services/supabase-db.js`
  - `insertBookingAnalysis(bookingData)`: UPSERT on `call_id`; updates `updated_at`, preserves `created_at` if provided.
  - `getReadySequenceEntries(limit)`: filters by `status='active'`, `next_call_time <= now`, and `sequences.is_active = true`; includes business hours fields; post-filters as fallback.
  - Sequence helpers: atomic `claimSequenceEntry`, `updateSequenceEntryAfterCall` with BH-aware scheduling.
- `services/gemini-analysis.js`
  - Batch limiter: `maxBatchSize=10`, `batchIntervalMs=60000`; `analyzeTranscript` enqueues; `processQueue` runs batches in parallel and sleeps between.
  - `getRateLimitStatus()`: exposes batch settings and queue length.
- `services/sequence-manager.js`
  - `processReadySequenceEntries`: skips paused sequences and DNC numbers; claims entries; initiates calls with required envs; schedules next attempt via BH.

### Key Learnings (Condensed)
- Treat `PGRST116` as “not found”; handle as a normal absence, not an error.
- Handle Postgres `23505` (unique violation) as an idempotency signal when appropriate.
- Avoid filtering on embedded/joined fields in Supabase queries; resolve FK then filter base table.
- Prefer batch-based rate limiting for stability and simpler observability over drifting counters.
- Compute `call_result` centrally from status and duration; do not rely on webhook strings.
- Preserve explicit `false` with nullish coalescing (`??`) instead of `||`.

### Database Schema (Quick Reference)
- Core tables: `contacts`, `phone_numbers`, `calls`, `transcriptions`, `events`, `booking_analysis`, `sequences`, `sequence_entries`.
- Constraints:
  - `booking_analysis(call_id)` UNIQUE (one analysis row per call).
  - `sequence_entries(sequence_id, phone_number_id)` UNIQUE (prevents duplicates).
- Triggers: `update_updated_at` on major tables including `booking_analysis`.
- View: `calls_with_analysis` joins `calls` with contact and analysis fields for filtering/sorting.
- Indexes: on common filters (phone, status, call_result, timestamps, sequence fields). See full definitions in `supabase-schema.sql`.

### Project Status
- All planned work completed; system is stable and production-ready.


database schema is in supabase-schema.sql
