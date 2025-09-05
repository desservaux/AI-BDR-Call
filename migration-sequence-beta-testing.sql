-- Migration for Sequence Beta Testing Feature
-- Adds agent assignment columns to sequence_entries table and agent config to sequences table

-- Add agent assignment columns to sequence_entries
ALTER TABLE sequence_entries
ADD COLUMN assigned_agent_id TEXT,
ADD COLUMN assigned_agent_phone_number_id TEXT,
ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add agent assignment config to sequences
ALTER TABLE sequences
ADD COLUMN agent_assignment_config JSONB;

-- Add indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sequence_entries_assigned_agent_id
ON sequence_entries(assigned_agent_id);

-- Update existing entries to have assigned_at timestamp
UPDATE sequence_entries
SET assigned_at = created_at
WHERE assigned_at IS NULL;

-- Comments for documentation
COMMENT ON COLUMN sequence_entries.assigned_agent_id IS 'ElevenLabs agent ID assigned for this sequence entry (for beta testing)';
COMMENT ON COLUMN sequence_entries.assigned_agent_phone_number_id IS 'ElevenLabs phone number ID for the assigned agent';
COMMENT ON COLUMN sequence_entries.assigned_at IS 'Timestamp when agent was assigned to this entry';
COMMENT ON COLUMN sequences.agent_assignment_config IS 'JSON configuration for agent assignment (single agent or weighted distribution)';

