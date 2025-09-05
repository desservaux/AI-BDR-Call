-- Migration: Add settings table and migrate phone pool from environment variable
-- Run this after applying the updated supabase-schema.sql

-- Create settings table if it doesn't exist (in case schema wasn't fully updated)
CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_settings_system ON settings(is_system);

-- Create trigger for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing ELEVENLABS_PHONE_NUMBER_POOL environment variable to database
-- Note: Replace 'YOUR_PHONE_POOL_HERE' with your actual environment variable value
-- Example: INSERT INTO settings (setting_key, setting_value, setting_type, description)
-- VALUES ('phone_pool', 'phnum_001,phnum_002,phnum_003', 'string', 'Comma-separated list of phone number IDs for random selection')
-- ON CONFLICT (setting_key) DO NOTHING;

-- Uncomment and modify the line below with your actual phone pool values:
/*
INSERT INTO settings (setting_key, setting_value, setting_type, description, is_system)
VALUES ('phone_pool', 'YOUR_PHONE_POOL_COMMA_SEPARATED_VALUES', 'string', 'Comma-separated list of phone number IDs for random selection', false)
ON CONFLICT (setting_key) DO NOTHING;
*/

-- Verify the migration
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'settings'
ORDER BY ordinal_position;

-- Check if phone pool was migrated
SELECT * FROM settings WHERE setting_key = 'phone_pool';
