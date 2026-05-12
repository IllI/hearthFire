import googleCalendar from '../../../../lib/google-calendar';
import { verifyAdminAccess } from '../../../../lib/admin-auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAdminAccess(req, res);
  if (!auth.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });
  if (!auth.isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });

  try {
    const { data } = await supabaseAdmin
      .from('content')
      .select('data')
      .eq('id', 'googleCalendar')
      .single();

    const settings = data?.data;
    if (!settings?.enabled) {
      return res.status(200).json({ configured: false, message: 'Google Calendar integration is not enabled' });
    }
    if (!settings.calendarId) {
      return res.status(200).json({ configured: false, message: 'Google Calendar ID is not configured' });
    }
    if (!settings.serviceAccountEmail || !settings.privateKey) {
      return res.status(200).json({ configured: false, message: 'Google service account credentials are not configured' });
    }

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    await googleCalendar.listEvents(now.toISOString(), endOfDay.toISOString());

    return res.status(200).json({
      configured: true,
      message: 'Google Calendar integration is working correctly'
    });
  } catch (error) {
    console.error('Error checking Google Calendar configuration:', error);
    return res.status(200).json({
      configured: false,
      message: `Error checking configuration: ${error.message}`
    });
  }
}
