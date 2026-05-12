import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing Supabase Service Role Key environment variables. Admin functions will fail.');
}

// Server-side Supabase client (using service_role key to bypass RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
