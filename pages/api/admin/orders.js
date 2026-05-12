import { withAdminAuth } from '../../../lib/admin-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { orderFromRow } from '../../../lib/supabase-mappers';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return res.status(200).json((data || []).map(orderFromRow));
  } catch (error) {
    console.error('Error fetching admin orders from Supabase:', error);
    return res.status(500).json({ error: 'Error fetching orders' });
  }
}

export default withAdminAuth(handler);
