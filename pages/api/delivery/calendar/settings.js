import googleCalendar from '../../../../lib/google-calendar';
import { verifyAdminAccess } from '../../../../lib/admin-auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

async function getSettings() {
  const { data } = await supabaseAdmin
    .from('content')
    .select('data')
    .eq('id', 'googleCalendar')
    .single();

  return data?.data || {};
}

async function saveSettings(settings) {
  const { error } = await supabaseAdmin
    .from('content')
    .upsert({
      id: 'googleCalendar',
      section: 'settings',
      data: settings
    });

  if (error) throw error;
}

export default async function handler(req, res) {
  const auth = await verifyAdminAccess(req, res);
  if (!auth.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });
  if (!auth.isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });

  try {
    if (req.method === 'GET') {
      const settings = await getSettings();
      return res.status(200).json({
        enabled: settings.enabled !== false,
        calendarId: settings.calendarId || '',
        serviceAccountEmail: settings.serviceAccountEmail || '',
        privateKey: settings.privateKey ? '************' : ''
      });
    }

    if (req.method === 'POST') {
      const { enabled, calendarId, serviceAccountEmail, privateKey } = req.body;
      if (enabled && !calendarId) {
        return res.status(400).json({ error: 'Calendar ID is required when integration is enabled' });
      }
      if (enabled && !serviceAccountEmail) {
        return res.status(400).json({ error: 'Service Account Email is required when integration is enabled' });
      }

      const currentSettings = await getSettings();
      const settings = {
        enabled: enabled !== false,
        calendarId: calendarId || currentSettings.calendarId || '',
        serviceAccountEmail: serviceAccountEmail || currentSettings.serviceAccountEmail || '',
        privateKey: privateKey !== undefined ? privateKey : currentSettings.privateKey || ''
      };

      await saveSettings(settings);

      let configured = false;
      let message = 'Google Calendar integration is not fully configured';

      if (settings.enabled && settings.calendarId && settings.serviceAccountEmail && settings.privateKey) {
        try {
          if (process.env.NODE_ENV === 'development') {
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = settings.serviceAccountEmail;
            process.env.GOOGLE_PRIVATE_KEY = settings.privateKey;
            process.env.GOOGLE_CALENDAR_ID = settings.calendarId;
          }

          googleCalendar.reinitialize();
          const now = new Date();
          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);
          await googleCalendar.listEvents(now.toISOString(), endOfDay.toISOString());

          configured = true;
          message = 'Google Calendar integration is working correctly';
        } catch (calendarError) {
          message = `Error connecting to Google Calendar: ${calendarError.message}`;
        }
      }

      return res.status(200).json({ success: true, configured, message });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in calendar settings API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
