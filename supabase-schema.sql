-- ElevenLabs Voice Agent - Complete Database Schema
-- Run this SQL in your Supabase SQL Editor to set up all tables and columns

-- Drop existing tables if they exist (be careful with this in production!)
DROP TABLE IF EXISTS booking_analysis CASCADE;
DROP TABLE IF EXISTS transcriptions CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS phone_numbers CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;

-- Create contacts table for people management
CREATE TABLE contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    company_name TEXT,
    position TEXT,
    notes TEXT,
    do_not_call BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create phone_numbers table to handle multiple phones per contact
CREATE TABLE phone_numbers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL UNIQUE,
    phone_type TEXT DEFAULT 'mobile' CHECK (phone_type IN ('mobile', 'home', 'work', 'other')),
    is_primary BOOLEAN DEFAULT FALSE,
    do_not_call BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the main calls table with updated schema
CREATE TABLE calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number TEXT NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
    elevenlabs_conversation_id TEXT UNIQUE,
    chat_id TEXT, -- Keep for backward compatibility
    chat_group_id TEXT, -- Keep for backward compatibility
    
    -- Enhanced status fields
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'unknown')),
    call_result TEXT CHECK (call_result IN ('answered', 'failed', 'unanswered', 'busy', 'no_answer')),
    answered BOOLEAN DEFAULT FALSE,
    
    -- ElevenLabs metadata
    agent_id TEXT,
    agent_name TEXT,
    call_successful BOOLEAN DEFAULT FALSE,
    duration_seconds INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    start_time TIMESTAMP WITH TIME ZONE,
    call_summary_title TEXT,
    transcript_summary TEXT,
    is_external_call BOOLEAN DEFAULT FALSE,
    
    -- Sequence tracking fields
    call_attempts INTEGER DEFAULT 1,
    last_call_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_call_time TIMESTAMP WITH TIME ZONE,
    sequence_status TEXT DEFAULT 'active' CHECK (sequence_status IN ('active', 'completed', 'stopped', 'max_attempts_reached')),
    sequence_id UUID, -- For future sequence management
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transcriptions table
CREATE TABLE transcriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    speaker TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type TEXT DEFAULT 'message',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create booking analysis table (for Gemini analysis results)
CREATE TABLE booking_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE UNIQUE,
    
    -- Boolean analysis fields
    meeting_booked BOOLEAN DEFAULT FALSE,
    person_interested BOOLEAN DEFAULT FALSE,
    person_very_upset BOOLEAN DEFAULT FALSE,
    
    -- Additional analysis fields
    confidence_score DECIMAL(3,2) DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    key_topics TEXT[] DEFAULT '{}',
    sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    action_items TEXT[] DEFAULT '{}',
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sequences table for managing call sequences
CREATE TABLE sequences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    max_attempts INTEGER DEFAULT 3,
    retry_delay_hours INTEGER DEFAULT 24,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sequence_entries table to track numbers in sequences
CREATE TABLE sequence_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE CASCADE,
    current_attempt INTEGER DEFAULT 0,
    next_call_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped', 'max_attempts_reached')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sequence_id, phone_number_id)
);

-- Create indexes for optimal performance
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_name);
CREATE INDEX idx_contacts_do_not_call ON contacts(do_not_call);

CREATE INDEX idx_phone_numbers_contact_id ON phone_numbers(contact_id);
CREATE INDEX idx_phone_numbers_phone_number ON phone_numbers(phone_number);
CREATE INDEX idx_phone_numbers_do_not_call ON phone_numbers(do_not_call);

CREATE INDEX idx_calls_phone_number ON calls(phone_number);
CREATE INDEX idx_calls_contact_id ON calls(contact_id);
CREATE INDEX idx_calls_phone_number_id ON calls(phone_number_id);
CREATE INDEX idx_calls_conversation_id ON calls(elevenlabs_conversation_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_call_result ON calls(call_result);
CREATE INDEX idx_calls_answered ON calls(answered);
CREATE INDEX idx_calls_created_at ON calls(created_at);
CREATE INDEX idx_calls_sequence_status ON calls(sequence_status);
CREATE INDEX idx_calls_next_call_time ON calls(next_call_time);
CREATE INDEX idx_calls_external ON calls(is_external_call);

CREATE INDEX idx_transcriptions_call_id ON transcriptions(call_id);
CREATE INDEX idx_transcriptions_timestamp ON transcriptions(timestamp);

CREATE INDEX idx_events_call_id ON events(call_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);

CREATE INDEX idx_booking_analysis_call_id ON booking_analysis(call_id);
CREATE INDEX idx_booking_analysis_meeting_booked ON booking_analysis(meeting_booked);
CREATE INDEX idx_booking_analysis_person_interested ON booking_analysis(person_interested);
CREATE INDEX idx_booking_analysis_person_very_upset ON booking_analysis(person_very_upset);

CREATE INDEX idx_sequences_name ON sequences(name);
CREATE INDEX idx_sequences_is_active ON sequences(is_active);

CREATE INDEX idx_sequence_entries_sequence_id ON sequence_entries(sequence_id);
CREATE INDEX idx_sequence_entries_phone_number_id ON sequence_entries(phone_number_id);
CREATE INDEX idx_sequence_entries_status ON sequence_entries(status);
CREATE INDEX idx_sequence_entries_next_call_time ON sequence_entries(next_call_time);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_analysis_updated_at BEFORE UPDATE ON booking_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequences_updated_at BEFORE UPDATE ON sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequence_entries_updated_at BEFORE UPDATE ON sequence_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for comprehensive call data with contact info
CREATE OR REPLACE VIEW calls_with_analysis AS
SELECT 
    c.*,
    co.first_name,
    co.last_name,
    co.email,
    co.company_name,
    co.position,
    pn.phone_type,
    ba.meeting_booked,
    ba.person_interested,
    ba.person_very_upset,
    ba.confidence_score,
    ba.key_topics,
    ba.sentiment,
    ba.action_items,
    ba.notes as analysis_notes
FROM calls c
LEFT JOIN contacts co ON c.contact_id = co.id
LEFT JOIN phone_numbers pn ON c.phone_number_id = pn.id
LEFT JOIN booking_analysis ba ON c.id = ba.call_id;

-- Create a view for sequence statistics
CREATE OR REPLACE VIEW sequence_statistics AS
SELECT 
    c.phone_number,
    co.first_name,
    co.last_name,
    co.company_name,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE c.status = 'completed') as successful_calls,
    COUNT(*) FILTER (WHERE c.status = 'failed') as failed_calls,
    AVG(c.duration_seconds) as average_duration,
    MAX(c.created_at) as last_call_time,
    MAX(c.next_call_time) as next_scheduled_call,
    MAX(c.sequence_status) as current_sequence_status,
    MAX(c.call_attempts) as total_attempts
FROM calls c
LEFT JOIN contacts co ON c.contact_id = co.id
GROUP BY c.phone_number, co.first_name, co.last_name, co.company_name;

-- Create a view for contact call history
CREATE OR REPLACE VIEW contact_call_history AS
SELECT 
    co.id as contact_id,
    co.first_name,
    co.last_name,
    co.email,
    co.company_name,
    co.position,
    pn.phone_number,
    pn.phone_type,
    COUNT(c.id) as total_calls,
    COUNT(*) FILTER (WHERE c.status = 'completed') as successful_calls,
    COUNT(*) FILTER (WHERE c.status = 'failed') as failed_calls,
    MAX(c.created_at) as last_call_time,
    MAX(c.next_call_time) as next_scheduled_call
FROM contacts co
LEFT JOIN phone_numbers pn ON co.id = pn.contact_id
LEFT JOIN calls c ON pn.id = c.phone_number_id
GROUP BY co.id, co.first_name, co.last_name, co.email, co.company_name, co.position, pn.phone_number, pn.phone_type;

-- Insert some sample data for testing (optional)
-- INSERT INTO contacts (first_name, last_name, email, company_name, position) 
-- VALUES 
--     ('John', 'Doe', 'john@example.com', 'Acme Corp', 'Manager'),
--     ('Jane', 'Smith', 'jane@example.com', 'Tech Inc', 'Director');

-- INSERT INTO phone_numbers (contact_id, phone_number, phone_type, is_primary) 
-- VALUES 
--     ((SELECT id FROM contacts WHERE email = 'john@example.com'), '+1234567890', 'mobile', true),
--     ((SELECT id FROM contacts WHERE email = 'jane@example.com'), '+0987654321', 'mobile', true);

-- INSERT INTO calls (phone_number, contact_id, phone_number_id, status, call_successful, duration_seconds, is_external_call) 
-- VALUES 
--     ('+1234567890', (SELECT id FROM contacts WHERE email = 'john@example.com'), (SELECT id FROM phone_numbers WHERE phone_number = '+1234567890'), 'completed', true, 180, true),
--     ('+0987654321', (SELECT id FROM contacts WHERE email = 'jane@example.com'), (SELECT id FROM phone_numbers WHERE phone_number = '+0987654321'), 'completed', false, 45, true);

-- Grant necessary permissions (adjust based on your Supabase setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Display table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('contacts', 'phone_numbers', 'calls', 'transcriptions', 'events', 'booking_analysis', 'sequences', 'sequence_entries')
ORDER BY table_name, ordinal_position;