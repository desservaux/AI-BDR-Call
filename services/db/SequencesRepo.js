const getSupabaseClient = require('./dbClient');

class SequencesRepo {
  constructor() {
    this.client = getSupabaseClient();
  }

  async getSequenceById(sequenceId) {
    const { data, error } = await this.client
      .from('sequences')
      .select('*')
      .eq('id', sequenceId)
      .single();
    if (error) throw error;
    return data;
  }

  async updateSequence(sequenceId, updateData) {
    const { data, error } = await this.client
      .from('sequences')
      .update(updateData)
      .eq('id', sequenceId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteSequence(sequenceId) {
    const { error } = await this.client
      .from('sequences')
      .delete()
      .eq('id', sequenceId);
    if (error) throw error;
    return true;
  }
}

module.exports = SequencesRepo;

