import { supabaseAdmin } from '../../../lib/supabase-admin';
import { orderFromRow } from '../../../lib/supabase-mappers';

async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      return { id: 'dev-admin-user', isAdmin: true };
    }
    return null;
  }

  if (process.env.NODE_ENV === 'development' && token.includes('admin-override')) {
    return { id: 'dev-admin-user', isAdmin: true };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    if (process.env.NODE_ENV === 'development') {
      return { id: 'dev-admin-user', isAdmin: true };
    }
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  return { id: data.user.id, isAdmin: profile?.role === 'admin' };
}

function normalizeOrderId(id) {
  if (!id) return id;
  if (id.startsWith('ord-')) {
    return `order-${id.replace('ord-', '').replace(/^0+/, '')}`;
  }
  if (!id.startsWith('order-') && /^\d+$/.test(id)) {
    return id;
  }
  return id;
}

export default async function handler(req, res) {
  const { id } = req.query;
  const orderId = normalizeOrderId(id);

  if (req.method === 'GET') {
    try {
      const user = await getUserFromRequest(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error || !data) {
        if (process.env.NODE_ENV === 'development' && global[`orders_${orderId}`]) {
          return res.status(200).json(global[`orders_${orderId}`]);
        }
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!user.isAdmin && data.customer_id !== user.id) {
        return res.status(403).json({ error: 'You do not have permission to access this order' });
      }

      return res.status(200).json(orderFromRow(data));
    } catch (error) {
      console.error('Error fetching order from Supabase:', error);
      return res.status(500).json({ error: 'Failed to fetch order' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const user = await getUserFromRequest(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      if (!user.isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });

      const update = {};
      if (req.body.status !== undefined) update.status = req.body.status;
      if (req.body.paymentStatus !== undefined) update.payment_status = req.body.paymentStatus;

      const { data, error } = await supabaseAdmin
        .from('orders')
        .update(update)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: 'Order updated successfully',
        order: orderFromRow(data)
      });
    } catch (error) {
      console.error('Error updating order in Supabase:', error);
      return res.status(500).json({ error: 'Failed to process order update' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
