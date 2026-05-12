import { withAdminAuth } from '../../../../../lib/admin-auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { orderFromRow } from '../../../../../lib/supabase-mappers';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json((orders || []).map(orderFromRow));
  } catch (error) {
    console.error('[Admin Customer Orders API] Error fetching customer orders from Supabase:', error);
    return res.status(500).json({
      error: 'Failed to fetch customer orders',
      details: error.message
    });
  }
}

export default withAdminAuth(handler);
