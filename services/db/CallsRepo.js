const getSupabaseClient = require('./dbClient');

class CallsRepo {
  constructor() {
    this.client = getSupabaseClient();
  }

  /**
   * Create a new call record with optional upsert of phone number.
   * Mirrors existing behavior used by SupabaseDBService.createCall.
   */
  async createCall(callData) {
    const phoneNumber = callData.phoneNumber || callData.phone_number;
    if (!phoneNumber) throw new Error('Phone number is required for call creation');

    let phoneNumberId = null;
    try {
      const { data: existingPhone, error: findError } = await this.client
        .from('phone_numbers')
        .select('id')
        .eq('phone_number', phoneNumber)
        .single();

      if (findError && findError.code !== 'PGRST116') throw findError;
      if (existingPhone) {
        phoneNumberId = existingPhone.id;
      } else {
        const { data: newPhone, error: createError } = await this.client
          .from('phone_numbers')
          .upsert([
            {
              phone_number: phoneNumber,
              phone_type: 'mobile',
              is_primary: true,
              do_not_call: false,
            },
          ], {
            onConflict: 'phone_number',
            ignoreDuplicates: false,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        phoneNumberId = newPhone.id;
      }
    } catch (error) {
      console.error('Error ensuring phone number exists:', error.message);
    }

    const insertData = {
      phone_number: phoneNumber,
      phone_number_id: phoneNumberId,
      chat_id: callData.chatId,
      chat_group_id: callData.chatGroupId,
      status: callData.status || 'active',
      call_attempts: callData.call_attempts || 1,
      last_call_time: callData.last_call_time || new Date().toISOString(),
      next_call_time: callData.next_call_time,
      sequence_status: callData.sequence_status || 'active',
      created_at: callData.created_at || new Date().toISOString(),
    };

    if (callData.elevenlabs_conversation_id)
      insertData.elevenlabs_conversation_id = callData.elevenlabs_conversation_id;
    if (callData.agent_id) insertData.agent_id = callData.agent_id;
    if (callData.agent_name) insertData.agent_name = callData.agent_name;
    if (callData.call_result) insertData.call_result = callData.call_result;
    if (callData.answered !== undefined) insertData.answered = callData.answered;
    if (callData.duration_seconds) insertData.duration_seconds = callData.duration_seconds;
    if (callData.message_count) insertData.message_count = callData.message_count;
    if (callData.start_time) insertData.start_time = callData.start_time;
    if (callData.call_summary_title) insertData.call_summary_title = callData.call_summary_title;
    if (callData.transcript_summary) insertData.transcript_summary = callData.transcript_summary;
    if (callData.is_external_call !== undefined)
      insertData.is_external_call = callData.is_external_call;

    Object.keys(insertData).forEach((key) => {
      if (insertData[key] === undefined) delete insertData[key];
    });

    let { data, error } = await this.client
      .from('calls')
      .insert([insertData])
      .select()
      .single();

    if (error && error.message.includes('column') && error.message.includes('does not exist')) {
      const basicInsertData = {
        phone_number: insertData.phone_number,
        phone_number_id: insertData.phone_number_id,
        status: insertData.status,
        created_at: insertData.created_at,
      };
      if (insertData.elevenlabs_conversation_id)
        basicInsertData.elevenlabs_conversation_id = insertData.elevenlabs_conversation_id;

      const { data: basicData, error: basicError } = await this.client
        .from('calls')
        .insert([basicInsertData])
        .select()
        .single();
      if (basicError) throw basicError;
      data = basicData;
    } else if (error) {
      throw error;
    }

    console.log(`✅ Call created with ID: ${data.id}, phone_number_id: ${phoneNumberId}`);
    return data;
  }

  async updateCallStatus(callId, status) {
    const updateData = { status };
    if (status === 'completed' || status === 'failed') {
      updateData.end_time = new Date().toISOString();
    }
    const { data, error } = await this.client
      .from('calls')
      .update(updateData)
      .eq('id', callId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCall(callId, updateData) {
    const { data, error } = await this.client
      .from('calls')
      .update(updateData)
      .eq('id', callId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getCallByConversationId(conversationId) {
    try {
      let { data, error } = await this.client
        .from('calls')
        .select('*')
        .eq('elevenlabs_conversation_id', conversationId)
        .single();
      if (error && error.code === 'PGRST116') return null;
      if (error && error.message.includes('column calls.elevenlabs_conversation_id does not exist')) {
        return null;
      }
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  }

  async getCallById(callId) {
    const { data, error } = await this.client
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async getCalls(filters = {}) {
    let query = this.client
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.phone) query = query.ilike('phone_number', `%${filters.phone}%`);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.date) {
      const dateObj = new Date(filters.date);
      const startOfDay = dateObj.toISOString();
      const endOfDay = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', startOfDay).lt('created_at', endOfDay);
    }
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getCallStatistics() {
    const { data: calls, error } = await this.client
      .from('calls')
      .select('status, call_result, duration_seconds, is_external_call');
    if (error) throw error;

    const stats = {
      total_calls: calls.length,
      internal_calls: 0,
      external_calls: 0,
      successful_calls: 0,
      failed_calls: 0,
      average_duration: 0,
      total_duration: 0,
    };

    calls.forEach((call) => {
      if (call.is_external_call) stats.external_calls++; else stats.internal_calls++;
      if (call.call_result === 'answered') stats.successful_calls++; else stats.failed_calls++;
      if (call.duration_seconds) stats.total_duration += call.duration_seconds;
    });
    stats.average_duration = stats.total_calls > 0 ? stats.total_duration / stats.total_calls : 0;
    return stats;
  }

  async getCallsByPhoneNumber(phoneNumber, options = {}) {
    let query = this.client
      .from('calls')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('created_at', { ascending: false });

    if (options.limit) query = query.limit(options.limit);
    if (options.status) query = query.eq('status', options.status);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async deleteCallsByCriteria(criteria) {
    let query = this.client.from('calls').delete();
    if (criteria.elevenlabs_conversation_id === null) {
      query = query.is('elevenlabs_conversation_id', null);
    }
    if (criteria.phone_number) {
      query = query.eq('phone_number', criteria.phone_number);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data?.length || 0;
  }
}
module.exports = CallsRepo;

