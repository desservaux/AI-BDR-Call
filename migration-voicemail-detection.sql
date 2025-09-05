-- Migration to add voicemail detection columns to calls table
-- Run this in your Supabase SQL editor

-- Add voicemail_detected boolean column
alter table calls add column if not exists voicemail_detected boolean default false;

-- Add voicemail_reason text column
alter table calls add column if not exists voicemail_reason text;

-- Create index on voicemail_detected for better query performance
create index if not exists idx_calls_voicemail_detected on calls(voicemail_detected);

-- Optional: Create index on voicemail_reason if needed for filtering
-- create index if not exists idx_calls_voicemail_reason on calls(voicemail_reason);
