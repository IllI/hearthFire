export function toIsoString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  if (value._seconds) return new Date(value._seconds * 1000).toISOString();
  return new Date(value).toISOString();
}

export function orderFromRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    orderId: row.id,
    items: row.items || [],
    subtotal: Number(row.subtotal || 0),
    tax: Number(row.tax || 0),
    deliveryFee: Number(row.delivery_fee || 0),
    total: Number(row.total || 0),
    status: row.status,
    orderType: row.order_type,
    userId: row.customer_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    stripeSessionId: row.stripe_session_id,
    pickupInfo: row.pickup_info,
    deliveryInfo: row.delivery_info,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function orderToRow(order, id) {
  const isPickupOrder = order.orderType === 'pickup' || order.type === 'pickup';
  const deliveryFee = isPickupOrder ? 0 : Number(order.deliveryFee || order.delivery_fee || 10);
  const subtotal = Number(order.subtotal || 0);
  const tax = Number(order.tax || 0);
  const total = order.total !== undefined ? Number(order.total) : subtotal + tax + deliveryFee;

  return {
    id,
    items: order.items || [],
    subtotal,
    tax,
    delivery_fee: deliveryFee,
    total,
    status: order.status || 'pending',
    order_type: isPickupOrder ? 'pickup' : 'delivery',
    customer_id: order.userId && /^[0-9a-f-]{36}$/i.test(order.userId) ? order.userId : null,
    customer_name: order.customerName || order.customer?.name || '',
    customer_email: order.customerEmail || order.customer?.email || '',
    customer_phone: order.customerPhone || order.customer?.phone || '',
    payment_method: order.paymentMethod || order.payment?.method || 'cash',
    payment_status: order.paymentStatus || order.payment?.status || 'pending',
    stripe_session_id: order.stripeSessionId || order.stripe_session_id || null,
    pickup_info: order.pickupInfo || null,
    delivery_info: order.deliveryInfo || null
  };
}

export function scheduleFromRow(row) {
  if (!row) return null;
  const date = row.schedule_date ? new Date(`${row.schedule_date}T00:00:00`).toISOString() : null;
  const slots = row.slots || row.time_slots || [];

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    type: row.type,
    date,
    scheduleDate: row.schedule_date,
    slots,
    timeSlots: row.time_slots?.length ? row.time_slots : slots,
    zipCodes: row.zip_codes || [],
    location: row.location || '',
    locationDetails: row.location_details,
    cutoffTime: row.cutoff_time,
    notes: row.notes || '',
    googleCalendarEventId: row.google_calendar_event_id,
    isActive: row.is_active,
    capacity: row.capacity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUpdated: row.last_updated
  };
}

export function scheduleToRow(schedule, id) {
  const slots = schedule.slots || schedule.timeSlots || [];
  const scheduleDate = schedule.date
    ? new Date(schedule.date).toISOString().split('T')[0]
    : schedule.scheduleDate || null;

  return {
    id,
    name: schedule.name || schedule.locationName || schedule.location || id,
    address: schedule.address || schedule.locationDetails?.address || null,
    type: schedule.type,
    schedule_date: scheduleDate,
    slots,
    time_slots: schedule.timeSlots || slots,
    zip_codes: schedule.zipCodes || [],
    location: schedule.location || '',
    location_details: schedule.locationDetails || null,
    cutoff_time: schedule.cutoffTime || null,
    notes: schedule.notes || schedule.note || '',
    google_calendar_event_id: schedule.googleCalendarEventId || null,
    is_active: schedule.isActive !== undefined ? schedule.isActive : true,
    capacity: schedule.capacity || null,
    last_updated: new Date().toISOString()
  };
}
