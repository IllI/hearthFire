import { randomUUID } from 'crypto';
import googleCalendar from '../../../../lib/google-calendar';
import { verifyAdminAccess } from '../../../../lib/admin-auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { scheduleFromRow, scheduleToRow } from '../../../../lib/supabase-mappers';

function createMockDeliverySchedules() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  return [tomorrow, nextWeek].map((date, index) => ({
    id: `test-schedule-${index + 1}`,
    name: `Delivery ${index + 1}`,
    type: 'delivery',
    date: date.toISOString(),
    slots: [
      { id: 'morning', name: 'Morning', time: '9am - 12pm', available: true, maxOrders: 2, currentOrders: 0 },
      { id: 'afternoon', name: 'Afternoon', time: '1pm - 5pm', available: true, maxOrders: 3, currentOrders: 0 }
    ],
    timeSlots: [
      { id: 'morning', name: 'Morning', time: '9am - 12pm', available: true, maxOrders: 2, currentOrders: 0 },
      { id: 'afternoon', name: 'Afternoon', time: '1pm - 5pm', available: true, maxOrders: 3, currentOrders: 0 }
    ],
    zipCodes: ['12345', '23456', '34567'],
    cutoffTime: '6pm day before',
    googleCalendarEventId: `mock-event-${index + 1}`,
    isActive: true
  }));
}

function normalizeSchedule(schedule) {
  const slots = schedule.slots || schedule.timeSlots || [];
  return {
    ...schedule,
    slots,
    timeSlots: schedule.timeSlots || slots
  };
}

function getScheduleDateKey(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === 'string') {
    const match = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function hasAvailableFutureSlot(schedule) {
  const scheduleDateKey = getScheduleDateKey(schedule.date || schedule.scheduleDate);
  const scheduleDate = scheduleDateKey ? new Date(`${scheduleDateKey}T12:00:00`) : new Date(NaN);
  if (Number.isNaN(scheduleDate.getTime()) || scheduleDate < new Date()) return false;
  return (schedule.slots || []).some(slot => slot.available && Number(slot.currentOrders || 0) < Number(slot.maxOrders || 999));
}

async function requireAdmin(req, res) {
  const auth = await verifyAdminAccess(req, res);
  if (!auth.isAuthenticated) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!auth.isAdmin) {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return false;
  }
  return true;
}

function getCalendarWindow() {
  const now = new Date();
  const sixMonthsLater = new Date(now);
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

  return {
    timeMin: now.toISOString(),
    timeMax: sixMonthsLater.toISOString()
  };
}

async function syncAvailabilityCache(calendarSchedules) {
  const { data: beforeRows, error: beforeError } = await supabaseAdmin
    .from('delivery_schedules')
    .select('id,google_calendar_event_id')
    .not('google_calendar_event_id', 'is', null);

  if (beforeError) throw beforeError;

  const existingIdByEventId = new Map();
  const duplicateIds = [];

  for (const row of beforeRows || []) {
    if (!row.google_calendar_event_id) continue;

    if (existingIdByEventId.has(row.google_calendar_event_id)) {
      duplicateIds.push(row.id);
    } else {
      existingIdByEventId.set(row.google_calendar_event_id, row.id);
    }
  }

  const calendarEventIds = new Set(
    calendarSchedules
      .map(schedule => schedule.googleCalendarEventId || schedule.id)
      .filter(Boolean)
  );

  const staleIds = (beforeRows || [])
    .filter(row => row.google_calendar_event_id && !calendarEventIds.has(row.google_calendar_event_id))
    .map(row => row.id);

  const rows = calendarSchedules.map(schedule => {
    const eventId = schedule.googleCalendarEventId || schedule.id;
    const rowId = existingIdByEventId.get(eventId) || eventId || randomUUID();

    return scheduleToRow(
      {
        ...schedule,
        id: rowId,
        googleCalendarEventId: eventId,
        isActive: true
      },
      rowId
    );
  });

  if (rows.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('delivery_schedules')
      .upsert(rows);

    if (upsertError) throw upsertError;
  }

  const idsToDelete = [...new Set([...staleIds, ...duplicateIds])];
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('delivery_schedules')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) throw deleteError;
  }

  return {
    total: calendarSchedules.length,
    upserted: rows.length,
    deleted: idsToDelete.length
  };
}

async function getDeliverySchedules(req, res) {
  const skipCalendarCheck = process.env.NODE_ENV === 'development' && req.query.skipCalendar === 'true';

  try {
    if (skipCalendarCheck) {
      const { data, error } = await supabaseAdmin
        .from('delivery_schedules')
        .select('*')
        .eq('is_active', true)
        .order('schedule_date', { ascending: true });

      if (error) throw error;

      const cachedSchedules = (data || []).map(scheduleFromRow).map(normalizeSchedule).filter(hasAvailableFutureSlot);
      return res.status(200).json(cachedSchedules.length ? cachedSchedules : createMockDeliverySchedules());
    }

    const { timeMin, timeMax } = getCalendarWindow();
    const calendarSchedules = await googleCalendar.getDeliverySchedulesFromCalendar(timeMin, timeMax);
    await syncAvailabilityCache(calendarSchedules);

    const schedules = calendarSchedules.map(normalizeSchedule).filter(hasAvailableFutureSlot);
    return res.status(200).json(schedules);
  } catch (error) {
    console.error('Error fetching delivery schedules from Google Calendar:', error);

    if (process.env.NODE_ENV === 'development') {
      return res.status(200).json(createMockDeliverySchedules());
    }

    return res.status(502).json({ error: 'Failed to fetch availability from Google Calendar' });
  }
}

function processScheduleData(scheduleData) {
  if (!scheduleData.date) throw new Error('Date is required');
  if (!scheduleData.type) throw new Error('Schedule type is required');
  if (scheduleData.type === 'delivery' && scheduleData.zipCodes && !Array.isArray(scheduleData.zipCodes)) {
    throw new Error('Zip codes must be provided as a list');
  }
  if (scheduleData.type === 'pickup' && !scheduleData.location) {
    throw new Error('Location is required for pickup schedules');
  }
  if (!scheduleData.slots || !Array.isArray(scheduleData.slots) || scheduleData.slots.length === 0) {
    throw new Error('At least one time slot is required');
  }

  const slots = scheduleData.slots.map((slot, index) => {
    const maxOrders = parseInt(slot.maxOrders, 10);
    if (!slot.time || Number.isNaN(maxOrders) || maxOrders <= 0) {
      throw new Error(`Invalid slot ${index + 1}`);
    }

    return {
      id: slot.id || `slot-${index + 1}`,
      name: slot.name || slot.time,
      time: slot.time,
      maxOrders,
      currentOrders: Number(slot.currentOrders || 0),
      available: slot.available !== undefined ? slot.available : true
    };
  });

  const scheduleDate = getScheduleDateKey(scheduleData.date);
  if (!scheduleDate) throw new Error('Invalid schedule date');

  const zipCodes = scheduleData.type === 'delivery'
    ? (scheduleData.zipCodes || []).map(zip => String(zip).trim()).filter(Boolean)
    : [];

  return {
    ...scheduleData,
    date: scheduleDate,
    zipCodes,
    slots,
    timeSlots: scheduleData.timeSlots || slots,
    notes: scheduleData.notes || scheduleData.note || '',
    cutoffTime: scheduleData.cutoffTime || '6pm day before',
    locationDetails: scheduleData.type === 'pickup' ? (scheduleData.locationDetails || {}) : null
  };
}

async function createDeliverySchedule(req, res) {
  if (!(await requireAdmin(req, res))) return;

  try {
    const scheduleData = processScheduleData(req.body);
    const calendarEvent = await googleCalendar.createAvailabilityEvent(scheduleData);

    if (!calendarEvent?.id) {
      throw new Error('Google Calendar did not return an event ID');
    }

    const scheduleId = calendarEvent.id;
    const schedule = {
      ...scheduleData,
      id: scheduleId,
      googleCalendarEventId: calendarEvent.id
    };

    const row = scheduleToRow(schedule, scheduleId);
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .upsert(row)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data: scheduleFromRow(data)
    });
  } catch (error) {
    console.error('Error creating delivery schedule:', error);
    return res.status(500).json({
      success: false,
      message: `Failed to create schedule: ${error.message}`
    });
  }
}

async function updateAllScheduleCapacities(req, res) {
  try {
    const { data: schedules, error } = await supabaseAdmin
      .from('delivery_schedules')
      .select('*');

    if (error) throw error;
    if (!schedules?.length) return res.status(404).json({ error: 'No schedules found' });

    const updates = schedules.map(row => {
      const schedule = scheduleFromRow(row);
      const slots = (schedule.slots || []).map(slot => ({
        ...slot,
        maxOrders: slot.id === 'morning' ? 2 : slot.id === 'afternoon' ? 3 : slot.maxOrders
      }));

      return supabaseAdmin
        .from('delivery_schedules')
        .update({ slots, time_slots: slots, last_updated: new Date().toISOString() })
        .eq('id', row.id);
    });

    await Promise.all(updates);
    return res.status(200).json({ message: `Updated ${schedules.length} schedules with correct capacities` });
  } catch (error) {
    console.error('Error updating schedules:', error);
    return res.status(500).json({ error: 'Failed to update schedules' });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return getDeliverySchedules(req, res);
  if (req.method === 'POST') return createDeliverySchedule(req, res);
  if (req.method === 'PATCH') return updateAllScheduleCapacities(req, res);

  res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
  return res.status(405).json({ error: 'Method not allowed' });
}
