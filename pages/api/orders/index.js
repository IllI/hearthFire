import googleCalendar from '../../../lib/google-calendar';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { orderFromRow, orderToRow } from '../../../lib/supabase-mappers';
const emailService = require('../../../lib/email-service');

async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = req.cookies?.idToken;
  const token = bearerToken || cookieToken;

  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      return { id: 'dev-user-id', email: 'dev@example.com', isAdmin: true };
    }
    return null;
  }

  if (process.env.NODE_ENV === 'development' && token.includes('admin-override')) {
    return { id: 'dev-admin-user', email: 'dev-admin@example.com', isAdmin: true };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    if (process.env.NODE_ENV === 'development') {
      return { id: 'dev-user-id', email: 'dev@example.com', isAdmin: true };
    }
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  return {
    id: data.user.id,
    email: data.user.email,
    isAdmin: profile?.role === 'admin'
  };
}

async function updateProductInventory(orderItems) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return [];

  const updatedProducts = [];

  for (const item of orderItems) {
    if (!item.productId || !item.quantity) continue;

    const { data: product, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('id,name,stock,quantity')
      .eq('id', item.productId)
      .single();

    if (fetchError || !product) {
      console.warn(`Product not found for inventory update: ${item.productId}`, fetchError?.message);
      continue;
    }

    const currentStock = Number(product.stock ?? product.quantity ?? 0);
    const orderQuantity = Number(item.quantity || 0);
    const newInventory = Math.max(0, currentStock - orderQuantity);

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({ stock: newInventory, quantity: newInventory })
      .eq('id', item.productId);

    if (updateError) {
      console.error(`Failed to update inventory for ${item.productId}:`, updateError);
      continue;
    }

    updatedProducts.push({
      productId: item.productId,
      name: product.name,
      previousStock: currentStock,
      newStock: newInventory,
      quantityDecremented: orderQuantity
    });
  }

  return updatedProducts;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const user = await getUserFromRequest(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      let query = supabaseAdmin
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!user.isAdmin) {
        query = query.eq('customer_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json((data || []).map(orderFromRow));
    } catch (error) {
      console.error('Error fetching orders from Supabase:', error);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }

  if (req.method === 'POST') {
    try {
      const user = await getUserFromRequest(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const orderData = req.body;
      if (!orderData || !Array.isArray(orderData.items)) {
        return res.status(400).json({ error: 'Invalid order data format' });
      }

      const orderId = `${Date.now()}`;
      const isPickupOrder = orderData.orderType === 'pickup' || orderData.type === 'pickup';
      const row = orderToRow({ ...orderData, userId: user.id }, orderId);

      if (isPickupOrder && row.pickup_info?.date) {
        row.pickup_info = {
          ...row.pickup_info,
          date: String(row.pickup_info.date).split('T')[0]
        };
      }

      try {
        if (isPickupOrder) {
          const calendarEvent = await googleCalendar.createPickupCalendarEvent({
            ...orderData,
            id: orderId,
            pickupInfo: row.pickup_info
          });

          if (calendarEvent?.id) {
            row.pickup_info = {
              ...(row.pickup_info || {}),
              calendarEventId: calendarEvent.id
            };
          }
        } else {
          const calendarEvent = await googleCalendar.createDeliveryCalendarEvent({
            ...orderData,
            id: orderId
          });

          if (calendarEvent?.id) {
            row.delivery_info = {
              ...(row.delivery_info || {}),
              calendarEventId: calendarEvent.id,
              scheduledWindow: calendarEvent.summary?.split(' - ')[1] || row.delivery_info?.scheduledWindow || ''
            };
          }
        }
      } catch (calendarError) {
        console.error('Error creating calendar event for order:', calendarError);
      }

      const { data: insertedOrder, error } = await supabaseAdmin
        .from('orders')
        .insert(row)
        .select()
        .single();

      if (error) throw error;

      const completeOrderData = orderFromRow(insertedOrder);
      global[`orders_${orderId}`] = completeOrderData;
      global.lastOrderType = completeOrderData.orderType;
      global.lastOrderId = orderId;
      global.lastOrderTime = new Date().toISOString();

      try {
        if (completeOrderData.customerEmail) {
          await emailService.sendOrderConfirmationToCustomer(completeOrderData);
        }
        await emailService.sendOrderNotificationToAdmin(completeOrderData);
      } catch (emailError) {
        console.error('Error sending order emails:', emailError);
      }

      try {
        await updateProductInventory(orderData.items);
      } catch (inventoryError) {
        console.error('Error updating inventory:', inventoryError);
      }

      return res.status(201).json({
        success: true,
        orderId,
        id: orderId,
        orderType: completeOrderData.orderType
      });
    } catch (error) {
      console.error('Error creating order in Supabase:', error);
      return res.status(500).json({ error: 'Failed to create order' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
