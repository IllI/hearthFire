import { withAdminAuth } from '../../../../lib/admin-auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id,email,display_name,role,phone,created_at,updated_at')
      .eq('id', id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('total,created_at,items')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    const safeOrders = orders || [];
    const totalSpent = safeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const products = safeOrders.flatMap(order => order.items || []);

    return res.status(200).json({
      id: profile.id,
      name: profile.display_name || profile.email,
      email: profile.email,
      phone: profile.phone,
      address: null,
      role: profile.role || 'customer',
      isGuest: false,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      orders: safeOrders.length,
      totalSpent,
      lastOrderDate: safeOrders[0]?.created_at || null,
      averageOrderValue: safeOrders.length ? totalSpent / safeOrders.length : null,
      products
    });
  } catch (error) {
    console.error('[Admin Customer Detail API] Error fetching customer from Supabase:', error);
    return res.status(500).json({ error: 'Failed to fetch customer data' });
  }
}

export default withAdminAuth(handler);
