const getSupabaseClient = require('./dbClient');

class ContactsRepo {
  constructor() {
    this.client = getSupabaseClient();
  }

  async updateContact(contactId, updateData) {
    const { data, error } = await this.client
      .from('contacts')
      .update(updateData)
      .eq('id', contactId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteContact(contactId) {
    const { error } = await this.client
      .from('contacts')
      .delete()
      .eq('id', contactId);
    if (error) throw error;
    return true;
  }
}

module.exports = ContactsRepo;

