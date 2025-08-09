const getSupabaseClient = require('./dbClient');

class BookingAnalysisRepo {
  constructor() {
    this.client = getSupabaseClient();
  }

  async insertBookingAnalysis(bookingData) {
    const { data, error } = await this.client
      .from('booking_analysis')
      .insert([bookingData])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getBookingAnalysisByCallId(callId) {
    const { data, error } = await this.client
      .from('booking_analysis')
      .select('*')
      .eq('call_id', callId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }
}

module.exports = BookingAnalysisRepo;

