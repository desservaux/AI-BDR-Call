const DbService = require('../db/DbService');

class CallService {
  constructor() {
    this.db = new DbService();
  }

  async testConnection() {
    return this.db.testConnection();
  }

  async createCall(callData) {
    return this.db.createCall(callData);
  }

  async updateCallStatus(callId, status) {
    return this.db.updateCallStatus(callId, status);
  }

  async updateCall(callId, updateData) {
    return this.db.updateCall(callId, updateData);
  }

  async insertTranscriptions(transcriptionData) {
    return this.db.insertTranscriptions(transcriptionData);
  }

  async deleteTranscriptionsByCallId(callId) {
    return this.db.deleteTranscriptionsByCallId(callId);
  }

  async insertEvents(eventData) {
    return this.db.insertEvents(eventData);
  }

  async insertBookingAnalysis(bookingData) {
    return this.db.insertBookingAnalysis(bookingData);
  }

  async getCallStatistics() {
    return this.db.getCallStatistics();
  }

  async getCallDetails(callId) {
    return this.db.getCallDetails(callId);
  }

  async getCallByConversationId(conversationId) {
    return this.db.getCallByConversationId(conversationId);
  }

  async deleteCallsByCriteria(criteria) {
    return this.db.deleteCallsByCriteria(criteria);
  }

  async getCallAnalytics() {
    return this.db.getCallAnalytics();
  }

  async getRecentCallsSince(isoSince) {
    const { data, error } = await this.db.client
      .from('calls')
      .select('created_at, status, duration_seconds, call_result, phone_number')
      .gte('created_at', isoSince)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }
}

module.exports = CallService;

