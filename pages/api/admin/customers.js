import { withAdminAuth } from '../../../lib/admin-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id,email,display_name,role,phone,created_at,updated_at')
      .neq('role', 'admin')
      .order('display_name', { ascending: true, nullsFirst: false });

    if (error) throw error;

    const customers = await Promise.all((profiles || []).map(async (profile) => {
      const { data: orders, error: ordersError } = await supabaseAdmin
        .from('orders')
        .select('total,created_at')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.warn(`Failed to fetch orders for customer ${profile.id}:`, ordersError.message);
      }

      const safeOrders = orders || [];
      const totalSpent = safeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

      return {
        id: profile.id,
        name: profile.display_name || profile.email,
        email: profile.email,
        phone: profile.phone,
        role: profile.role || 'customer',
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        orders: safeOrders.length,
        totalSpent,
        lastOrderDate: safeOrders[0]?.created_at || null
      };
    }));

    return res.status(200).json(customers);
  } catch (error) {
    console.error('[Admin Customers API] Error fetching customers from Supabase:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAdminAuth(handler);
