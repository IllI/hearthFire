import googleCalendar from '../../../../lib/google-calendar';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { scheduleFromRow, scheduleToRow } from '../../../../lib/supabase-mappers';
import { verifyAdminAccess } from '../../../../lib/admin-auth';

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

function cleanZipCodes(zipCodes) {
  return (zipCodes || []).map(zip => String(zip).trim()).filter(Boolean);
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Schedule ID is required' });

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('delivery_schedules')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return res.status(404).json({ error: 'Schedule not found' });
      return res.status(200).json(scheduleFromRow(data));
    } catch (error) {
      console.error('Error fetching schedule from Supabase:', error);
      return res.status(500).json({ error: 'Failed to fetch schedule' });
    }
  }

  if (req.method === 'PUT') {
    if (!(await requireAdmin(req, res))) return;

    try {
      const { data: existingRow, error: fetchError } = await supabaseAdmin
        .from('delivery_schedules')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingRow) {
        return res.status(404).json({ success: false, message: 'Delivery schedule not found' });
      }

      const existingSchedule = scheduleFromRow(existingRow);
      const scheduleType = req.body.type || existingSchedule.type;
      const nextSchedule = {
        ...existingSchedule,
        ...req.body,
        id,
        type: scheduleType,
        date: getScheduleDateKey(req.body.date || existingSchedule.date),
        slots: req.body.slots || existingSchedule.slots,
        timeSlots: req.body.timeSlots || req.body.slots || existingSchedule.timeSlots,
        notes: req.body.notes || existingSchedule.notes || '',
        cutoffTime: req.body.cutoffTime || existingSchedule.cutoffTime,
        zipCodes: scheduleType === 'pickup' ? [] : cleanZipCodes(req.body.zipCodes || existingSchedule.zipCodes),
        location: scheduleType === 'pickup' ? (req.body.location || existingSchedule.location || '') : '',
        locationDetails: scheduleType === 'pickup'
          ? (req.body.locationDetails || existingSchedule.locationDetails || {})
          : null
      };

      if (existingSchedule.googleCalendarEventId) {
        try {
          await googleCalendar.updateAvailabilityEvent(existingSchedule.googleCalendarEventId, nextSchedule);
        } catch (calendarError) {
          console.error('Error updating Google Calendar event:', calendarError);
        }
      }

      const { data, error } = await supabaseAdmin
        .from('delivery_schedules')
        .update(scheduleToRow(nextSchedule, id))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: scheduleFromRow(data)
      });
    } catch (error) {
      console.error('Error updating delivery schedule in Supabase:', error);
      return res.status(500).json({
        success: false,
        message: `Failed to update schedule: ${error.message}`
      });
    }
  }

  if (req.method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return;

    try {
      const { data: existingRow, error: fetchError } = await supabaseAdmin
        .from('delivery_schedules')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const schedule = existingRow ? scheduleFromRow(existingRow) : null;
      const calendarEventId = schedule?.googleCalendarEventId || id;
      if (calendarEventId) {
        try {
          await googleCalendar.deleteEvent(calendarEventId);
        } catch (calendarError) {
          const message = calendarError.message || '';
          const eventAlreadyGone = message.includes('notFound') || message.includes('Not Found') || message.includes('404');

          if (!eventAlreadyGone) {
            console.error('Error deleting Google Calendar event:', calendarError);
            return res.status(502).json({
              error: 'Failed to delete linked Google Calendar event',
              message: calendarError.message
            });
          }
        }
      }

      const { error } = await supabaseAdmin
        .from('delivery_schedules')
        .delete()
        .or(`id.eq.${id},google_calendar_event_id.eq.${calendarEventId}`);

      if (error) throw error;

      return res.status(200).json({ message: 'Schedule deleted successfully' });
    } catch (error) {
      console.error('Error deleting schedule from Supabase:', error);
      return res.status(500).json({ error: 'Failed to delete schedule' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
