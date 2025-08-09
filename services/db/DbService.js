const XLSX = require('xlsx');
const getSupabaseClient = require('./dbClient');
const CallsRepo = require('./CallsRepo');
const TranscriptionsRepo = require('./TranscriptionsRepo');
const EventsRepo = require('./EventsRepo');
const BookingAnalysisRepo = require('./BookingAnalysisRepo');
const ContactsRepo = require('./ContactsRepo');
const PhoneNumbersRepo = require('./PhoneNumbersRepo');
const SequencesRepo = require('./SequencesRepo');
const SequenceEntriesRepo = require('./SequenceEntriesRepo');

class DbService {
    constructor() {
        this.client = getSupabaseClient();
        this.callsRepo = new CallsRepo();
        this.transcriptionsRepo = new TranscriptionsRepo();
        this.eventsRepo = new EventsRepo();
        this.bookingAnalysisRepo = new BookingAnalysisRepo();
        this.contactsRepo = new ContactsRepo();
        this.phoneNumbersRepo = new PhoneNumbersRepo();
        this.sequencesRepo = new SequencesRepo();
        this.sequenceEntriesRepo = new SequenceEntriesRepo();
    }

    async testConnection() {
        try {
            const { error } = await this.client
                .from('calls')
                .select('id')
                .limit(1);
            if (error) throw error;
            console.log('✅ Supabase connection successful');
            return true;
        } catch (error) {
            console.error('❌ Supabase connection failed:', error.message);
            return false;
        }
    }

    async createCall(callData) {
        try {
            return await this.callsRepo.createCall(callData);
        } catch (error) {
            console.error('Error creating call:', error.message);
            throw new Error(`Failed to create call: ${error.message}`);
        }
    }

    async updateCallStatus(callId, status) {
        try {
            const data = await this.callsRepo.updateCallStatus(callId, status);
            console.log(`✅ Call ${callId} status updated to: ${status}`);
            return data;
        } catch (error) {
            console.error('Error updating call status:', error.message);
            throw new Error(`Failed to update call status: ${error.message}`);
        }
    }

    async insertTranscriptions(transcriptionData) {
        try {
            const data = await this.transcriptionsRepo.insertTranscriptions(transcriptionData);
            console.log(`✅ Inserted ${data.length} transcription records`);
            return data;
        } catch (error) {
            console.error('Error inserting transcriptions:', error.message);
            throw new Error(`Failed to insert transcriptions: ${error.message}`);
        }
    }

    async deleteTranscriptionsForCall(callId) {
        try {
            const deleted = await this.transcriptionsRepo.deleteByCallId(callId);
            console.log(`🗑️ Deleted ${deleted} transcription records for call ${callId}`);
            return deleted;
        } catch (error) {
            console.error('Error deleting transcriptions:', error.message);
            throw new Error(`Failed to delete transcriptions: ${error.message}`);
        }
    }

    async createTranscriptions(transcriptionData) { return this.insertTranscriptions(transcriptionData); }
    async deleteTranscriptionsByCallId(callId) { return this.deleteTranscriptionsForCall(callId); }

    async insertEvents(eventData) {
        try {
            const data = await this.eventsRepo.insertEvents(eventData);
            console.log(`✅ Inserted ${data.length} event records`);
            return data;
        } catch (error) {
            console.error('Error inserting events:', error.message);
            throw new Error(`Failed to insert events: ${error.message}`);
        }
    }

    async insertBookingAnalysis(bookingData) {
        try {
            const data = await this.bookingAnalysisRepo.insertBookingAnalysis(bookingData);
            console.log(`✅ Booking analysis inserted for call: ${bookingData.call_id}`);
            return data;
        } catch (error) {
            console.error('Error inserting booking analysis:', error.message);
            throw new Error(`Failed to insert booking analysis: ${error.message}`);
        }
    }

    async getBookingAnalysisByCallId(callId) {
        try {
            return await this.bookingAnalysisRepo.getBookingAnalysisByCallId(callId);
        } catch (error) {
            console.error('Error getting booking analysis by call ID:', error.message);
            return null;
        }
    }

    async getCalls(filters = {}) {
        try {
            return await this.callsRepo.getCalls(filters);
        } catch (error) {
            console.error('Error getting calls:', error.message);
            throw new Error(`Failed to get calls: ${error.message}`);
        }
    }

    async getCallsWithAdvancedFilters(filters = {}) {
        try {
            let query = this.client
                .from('calls_with_analysis')
                .select('*')
                .order('start_time', { ascending: false })
                .order('created_at', { ascending: false });

            if (filters.phone) query = query.ilike('phone_number', `%${filters.phone}%`);
            if (filters.status) query = query.eq('status', filters.status);
            if (filters.callResult) query = query.eq('call_result', filters.callResult);
            if (filters.answered !== undefined) query = query.eq('answered', filters.answered);
            if (filters.contactName) query = query.or(`first_name.ilike.%${filters.contactName}%,last_name.ilike.%${filters.contactName}%`);
            if (filters.company) query = query.ilike('company_name', `%${filters.company}%`);
            if (filters.dateStart) query = query.gte('created_at', new Date(filters.dateStart).toISOString());
            if (filters.dateEnd) {
                const endDate = new Date(filters.dateEnd); endDate.setDate(endDate.getDate() + 1);
                query = query.lt('created_at', endDate.toISOString());
            }
            if (filters.duration) {
                const ranges = { '0-1': { min: 0, max: 60 }, '1-5': { min: 60, max: 300 }, '5-10': { min: 300, max: 600 }, '10+': { min: 600, max: null } };
                const r = ranges[filters.duration];
                if (r) query = r.max ? query.gte('duration_seconds', r.min).lt('duration_seconds', r.max) : query.gte('duration_seconds', r.min);
            }
            if (filters.meetingBooked !== undefined && filters.meetingBooked !== null) query = query.eq('meeting_booked', filters.meetingBooked === true || filters.meetingBooked === 'true');
            if (filters.personInterested !== undefined && filters.personInterested !== null) query = query.eq('person_interested', filters.personInterested === true || filters.personInterested === 'true');
            if (filters.personUpset !== undefined && filters.personUpset !== null) query = query.eq('person_very_upset', filters.personUpset === true || filters.personUpset === 'true');
            if (filters.page && filters.limit) {
                const offset = (filters.page - 1) * filters.limit; query = query.range(offset, offset + filters.limit - 1);
            } else if (filters.limit) { query = query.limit(filters.limit); }

            const { data: calls, error } = await query;
            if (error) throw error;
            const sortedCalls = (calls || []).sort((a, b) => new Date(b.start_time || b.created_at) - new Date(a.start_time || a.created_at));
            return { calls: sortedCalls, total: sortedCalls.length };
        } catch (error) {
            console.error('Error getting calls with advanced filters:', error.message);
            throw new Error(`Failed to get calls with advanced filters: ${error.message}`);
        }
    }

    async getCallDetails(callId) {
        try {
            const { data: callData, error: callError } = await this.client.from('calls').select('*').eq('id', callId).single();
            if (callError) throw callError;
            const { data: transcriptionData, error: transcriptionError } = await this.client.from('transcriptions').select('*').eq('call_id', callId).order('timestamp', { ascending: true });
            if (transcriptionError) throw transcriptionError;
            const { data: bookingData, error: bookingError } = await this.client.from('booking_analysis').select('*').eq('call_id', callId).single();
            if (bookingError && bookingError.code !== 'PGRST116') { throw bookingError; }
            return { call: callData, transcriptions: transcriptionData, bookingAnalysis: bookingData };
        } catch (error) {
            console.error('Error getting call details:', error.message);
            throw new Error(`Failed to get call details: ${error.message}`);
        }
    }

    async getCallByConversationId(conversationId) {
        try { return await this.callsRepo.getCallByConversationId(conversationId); } catch (e) { return null; }
    }

    async updateCall(callId, updateData) {
        try { return await this.callsRepo.updateCall(callId, updateData); } catch (e) { throw new Error(`Failed to update call: ${e.message}`); }
    }

    async getCallsByPhoneNumber(phoneNumber, options = {}) {
        try { return await this.callsRepo.getCallsByPhoneNumber(phoneNumber, options); } catch (e) { throw new Error(`Failed to get calls by phone number: ${e.message}`); }
    }

    async getCallStatistics() { return this.callsRepo.getCallStatistics(); }

    async exportCallData(filters = {}) {
        try {
            const calls = await this.getCalls(filters);
            return calls.map((call) => ({
                id: call.id,
                phone_number: call.phone_number,
                start_time: call.start_time,
                end_time: call.end_time,
                duration: call.duration,
                status: call.status,
                booking_outcome: call.booking_outcome,
                confidence_score: call.confidence_score,
                created_at: call.created_at,
            }));
        } catch (error) {
            console.error('Error exporting call data:', error.message);
            throw new Error(`Failed to export call data: ${error.message}`);
        }
    }

    // Contacts
    async getContacts(filters = {}) { return this.contactsRepo.getContacts ? this.contactsRepo.getContacts(filters) : []; }
    async getContactById(contactId) { return this.contactsRepo.getContactById ? this.contactsRepo.getContactById(contactId) : null; }
    async updateContact(contactId, updateData) { return this.contactsRepo.updateContact(contactId, updateData); }
    async deleteContact(contactId) { return this.contactsRepo.deleteContact(contactId); }

    // Phone numbers
    async getPhoneNumbers(filters = {}) { return this.phoneNumbersRepo.getPhoneNumbers(filters); }
    async getPhoneNumberById(phoneId) { return this.phoneNumbersRepo.getPhoneNumberById(phoneId); }
    async updatePhoneNumber(phoneId, updateData) { return this.phoneNumbersRepo.updatePhoneNumber(phoneId, updateData); }
    async deletePhoneNumber(phoneId) { return this.phoneNumbersRepo.deletePhoneNumber(phoneId); }

    // Sequences
    async getSequences(filters = {}) { return this.sequencesRepo.getSequences ? this.sequencesRepo.getSequences(filters) : []; }
    async getSequenceById(sequenceId) { return this.sequencesRepo.getSequenceById(sequenceId); }
    async updateSequence(sequenceId, updateData) { return this.sequencesRepo.updateSequence(sequenceId, updateData); }
    async deleteSequence(sequenceId) { return this.sequencesRepo.deleteSequence(sequenceId); }

    // Sequence entries
    async getReadySequenceEntries(limit = 10) { return this.sequenceEntriesRepo.getReadySequenceEntries(limit); }
    async updateSequenceEntry(entryId, updateData) { return this.sequenceEntriesRepo.updateSequenceEntry(entryId, updateData); }
    async findActiveSequenceEntriesForPhoneNumber(phoneNumber) { return this.sequenceEntriesRepo.findActiveSequenceEntriesForPhoneNumber(phoneNumber); }
    async getSequenceEntries(filters = {}) { return this.sequenceEntriesRepo.getSequenceEntries(filters); }

    // CSV/XLSX utils preserved for UI endpoints
    parseCSVRow(headers, values, rowNumber) {
        const data = {};
        headers.forEach((h, i) => { data[h] = values[i] || ''; });
        if (!data.first_name && !data.last_name) throw new Error('At least first_name or last_name is required');
        if (!data.phone_number) throw new Error('phone_number is required');
        const phoneNumber = data.phone_number;
        const internationalPattern = /^(\+?[1-9]\d{1,14})$/;
        if (!internationalPattern.test(phoneNumber)) throw new Error('Phone number must be in international format (e.g., +1234567890 or 1234567890)');
        data.phone_number = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        return {
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            email: data.email || '',
            company_name: data.company_name || '',
            position: data.position || '',
            notes: data.notes || '',
            phone_number: data.phone_number,
            phone_type: data.phone_type || 'mobile',
            is_primary: data.is_primary === 'true' || data.is_primary === '1',
            do_not_call: data.do_not_call === 'true' || data.do_not_call === '1',
        };
    }
}

module.exports = DbService;


