const getSupabaseClient = require('./dbClient');

class TranscriptionsRepo {
  constructor() {
    this.client = getSupabaseClient();
  }

  async insertTranscriptions(transcriptionData) {
    const { data, error } = await this.client
      .from('transcriptions')
      .insert(transcriptionData)
      .select();
    if (error) throw error;
    return data;
  }

  async deleteByCallId(callId) {
    const { data, error } = await this.client
      .from('transcriptions')
      .delete()
      .eq('call_id', callId)
      .select();
    if (error) throw error;
    return data.length;
  }

  async getByCallId(callId) {
    const { data, error } = await this.client
      .from('transcriptions')
      .select('*')
      .eq('call_id', callId)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return data;
  }
}

module.exports = TranscriptionsRepo;

