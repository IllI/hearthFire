import { withAdminAuth } from '../../../lib/admin-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

function emptySalesWindow() {
  const days = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    days.push({
      date: date.toISOString().split('T')[0],
      orders: 0,
      sales: 0
    });
  }

  return days;
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id,total,status,created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const salesByDate = Object.fromEntries(emptySalesWindow().map(day => [day.date, day]));

    for (const order of orders || []) {
      if (order.status === 'cancelled') continue;

      const dateKey = new Date(order.created_at).toISOString().split('T')[0];
      if (!salesByDate[dateKey]) continue;

      salesByDate[dateKey].orders += 1;
      salesByDate[dateKey].sales = Number((salesByDate[dateKey].sales + Number(order.total || 0)).toFixed(2));
    }

    return res.status(200).json(Object.values(salesByDate));
  } catch (error) {
    console.error('Error fetching sales data from Supabase:', error);
    return res.status(500).json({ error: 'Failed to fetch sales data' });
  }
}

export default withAdminAuth(handler);
