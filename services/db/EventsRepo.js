const getSupabaseClient = require('./dbClient');

class EventsRepo {
  constructor() {
    this.client = getSupabaseClient();
  }

  async insertEvents(eventData) {
    const { data, error } = await this.client
      .from('events')
      .insert(eventData)
      .select();
    if (error) throw error;
    return data;
  }
}

module.exports = EventsRepo;

