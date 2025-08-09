const getSupabaseClient = require('./dbClient');

class PhoneNumbersRepo {
  constructor() {
    this.client = getSupabaseClient();
  }

  async getPhoneNumbers(filters = {}) {
    let query = this.client
      .from('phone_numbers')
      .select(`
        *,
        contacts (
          id,
          first_name,
          last_name,
          email,
          company_name,
          position
        )
      `)
      .order('created_at', { ascending: false });

    if (filters.phoneNumber) query = query.ilike('phone_number', `%${filters.phoneNumber}%`);
    if (filters.contactId) query = query.eq('contact_id', filters.contactId);
    if (filters.phoneType) query = query.eq('phone_type', filters.phoneType);
    if (filters.doNotCall !== undefined) query = query.eq('do_not_call', filters.doNotCall);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getPhoneNumberById(phoneId) {
    const { data, error } = await this.client
      .from('phone_numbers')
      .select(`
        *,
        contacts (
          id,
          first_name,
          last_name,
          email,
          company_name,
          position
        )
      `)
      .eq('id', phoneId)
      .single();
    if (error) throw error;
    return data;
  }

  async updatePhoneNumber(phoneId, updateData) {
    const { data, error } = await this.client
      .from('phone_numbers')
      .update(updateData)
      .eq('id', phoneId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deletePhoneNumber(phoneId) {
    const { error } = await this.client
      .from('phone_numbers')
      .delete()
      .eq('id', phoneId);
    if (error) throw error;
    return true;
  }
}

module.exports = PhoneNumbersRepo;

