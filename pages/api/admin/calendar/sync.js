import googleCalendar from '../../../../lib/google-calendar';
import { withAdminAuth } from '../../../../lib/admin-auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { scheduleToRow } from '../../../../lib/supabase-mappers';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const today = new Date();
    const sixMonthsLater = new Date(today);
    sixMonthsLater.setMonth(today.getMonth() + 6);

    const calendarSchedules = await googleCalendar.getDeliverySchedulesFromCalendar(
      today.toISOString(),
      sixMonthsLater.toISOString()
    );

    const rows = calendarSchedules.map(schedule => scheduleToRow(schedule, schedule.id || schedule.googleCalendarEventId));
    const { data: beforeRows, error: beforeError } = await supabaseAdmin
      .from('delivery_schedules')
      .select('id,google_calendar_event_id')
      .not('google_calendar_event_id', 'is', null);

    if (beforeError) throw beforeError;

    const existingIds = new Set((beforeRows || []).map(row => row.google_calendar_event_id));
    const { error: upsertError } = await supabaseAdmin
      .from('delivery_schedules')
      .upsert(rows)
      .select();

    if (upsertError) throw upsertError;

    const calendarEventIds = new Set(calendarSchedules.map(schedule => schedule.googleCalendarEventId).filter(Boolean));
    const staleIds = (beforeRows || [])
      .filter(row => row.google_calendar_event_id && !calendarEventIds.has(row.google_calendar_event_id))
      .map(row => row.id);

    if (staleIds.length > 0) {
      const { error: staleError } = await supabaseAdmin
        .from('delivery_schedules')
        .update({ is_active: false, last_updated: new Date().toISOString() })
        .in('id', staleIds);

      if (staleError) throw staleError;
    }

    const added = rows.filter(row => row.google_calendar_event_id && !existingIds.has(row.google_calendar_event_id)).length;
    const updated = rows.length - added;

    return res.status(200).json({
      message: 'Successfully synced with Google Calendar',
      stats: {
        total: calendarSchedules.length,
        added,
        updated,
        deleted: staleIds.length
      },
      added,
      updated,
      deleted: staleIds.length
    });
  } catch (error) {
    console.error('Error syncing with Google Calendar:', error);
    return res.status(500).json({ error: 'Failed to sync with Google Calendar' });
  }
}

export default withAdminAuth(handler);
