import { withAdminAuth } from '../../../lib/admin-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [
      { count: productCount, error: productsError },
      { count: orderCount, error: ordersError },
      { count: customerCount, error: customersError },
      { data: orders, error: revenueError }
    ] = await Promise.all([
      supabaseAdmin.from('products').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabaseAdmin.from('orders').select('total')
    ]);

    const error = productsError || ordersError || customersError || revenueError;
    if (error) throw error;

    const revenue = (orders || []).reduce((sum, order) => sum + Number(order.total || 0), 0);

    return res.status(200).json({
      products: productCount || 0,
      orders: orderCount || 0,
      customers: customerCount || 0,
      revenue: Number(revenue.toFixed(2))
    });
  } catch (error) {
    console.error('Error fetching admin stats from Supabase:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

export default withAdminAuth(handler);
