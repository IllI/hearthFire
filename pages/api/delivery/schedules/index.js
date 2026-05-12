import { randomUUID } from 'crypto';
import googleCalendar from '../../../../lib/google-calendar';
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

function hasAvailableFutureSlot(schedule) {
  const scheduleDate = new Date(schedule.date || schedule.scheduleDate);
  if (Number.isNaN(scheduleDate.getTime()) || scheduleDate < new Date()) return false;
  return (schedule.slots || []).some(slot => slot.available && Number(slot.currentOrders || 0) < Number(slot.maxOrders || 999));
}

async function getDeliverySchedules(req, res) {
  const syncWithCalendar = req.query.sync === 'true' || req.query.syncCalendar === 'true';
  const skipCalendarCheck = req.query.skipCalendar === 'true';

  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .select('*')
      .eq('is_active', true)
      .order('schedule_date', { ascending: true });

    if (error) throw error;

    let schedules = (data || []).map(scheduleFromRow).map(normalizeSchedule).filter(hasAvailableFutureSlot);

    if (!skipCalendarCheck && (syncWithCalendar || schedules.length === 0)) {
      try {
        const now = new Date();
        const sixMonthsLater = new Date();
        sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

        const calendarSchedules = await googleCalendar.getDeliverySchedulesFromCalendar(
          now.toISOString(),
          sixMonthsLater.toISOString()
        );

        if (calendarSchedules.length > 0) {
          const rows = calendarSchedules.map(schedule => scheduleToRow(schedule, schedule.id || randomUUID()));
          const { error: upsertError } = await supabaseAdmin
            .from('delivery_schedules')
            .upsert(rows);

          if (upsertError) {
            console.error('Error syncing calendar schedules to Supabase:', upsertError);
          }

          schedules = calendarSchedules.map(normalizeSchedule).filter(hasAvailableFutureSlot);
        }
      } catch (calendarError) {
        console.error('Error fetching schedules from Google Calendar:', calendarError);
      }
    }

    if (schedules.length === 0 && process.env.NODE_ENV === 'development') {
      schedules = createMockDeliverySchedules();
    }

    return res.status(200).json(schedules);
  } catch (error) {
    console.error('Error fetching delivery schedules from Supabase:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery schedules' });
  }
}

function processScheduleData(scheduleData) {
  if (!scheduleData.date) throw new Error('Date is required');
  if (!scheduleData.type) throw new Error('Schedule type is required');
  if (scheduleData.type === 'delivery' && (!scheduleData.zipCodes || !Array.isArray(scheduleData.zipCodes))) {
    throw new Error('Zip codes are required for delivery schedules');
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

  return {
    ...scheduleData,
    date: new Date(scheduleData.date).toISOString(),
    slots,
    timeSlots: scheduleData.timeSlots || slots,
    notes: scheduleData.notes || scheduleData.note || '',
    cutoffTime: scheduleData.cutoffTime || '6pm day before',
    locationDetails: scheduleData.type === 'pickup' ? (scheduleData.locationDetails || {}) : null
  };
}

async function createDeliverySchedule(req, res) {
  try {
    const scheduleId = randomUUID();
    const schedule = {
      ...processScheduleData(req.body),
      id: scheduleId
    };

    try {
      const calendarEvent = await googleCalendar.createAvailabilityEvent(schedule);
      if (calendarEvent?.id) {
        schedule.googleCalendarEventId = calendarEvent.id;
      }
    } catch (calendarError) {
      console.error('Error creating Google Calendar event:', calendarError);
    }

    const row = scheduleToRow(schedule, scheduleId);
    const { data, error } = await supabaseAdmin
      .from('delivery_schedules')
      .insert(row)
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
