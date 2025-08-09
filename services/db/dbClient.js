const { createClient } = require('@supabase/supabase-js');

/**
 * Returns a singleton Supabase client instance configured from environment variables.
 * Throws a clear error if required variables are missing.
 */
let cachedClient = null;

function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing required SUPABASE environment variables: SUPABASE_URL and SUPABASE_ANON_KEY'
    );
  }

  cachedClient = createClient(supabaseUrl, supabaseKey);
  return cachedClient;
}

module.exports = getSupabaseClient;

