import googleCalendar from '../../../../lib/google-calendar';
import { withAdminAuth } from '../../../../lib/admin-auth';

async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Authentication is handled by the withAdminAuth middleware
    console.log('Fetching calendar events for admin user:', req.user?.email || req.user?.uid);
    
    // Get events from Google Calendar
    const today = new Date();
    const sixMonthsLater = new Date(today);
    sixMonthsLater.setMonth(today.getMonth() + 6);
    
    const events = await googleCalendar.listEvents({
      timeMin: today.toISOString(),
      timeMax: sixMonthsLater.toISOString(),
      maxResults: 100
    });
    
    // Sort events by date (ascending)
    events.sort((a, b) => {
      const aDate = new Date(a.start.dateTime || a.start.date);
      const bDate = new Date(b.start.dateTime || b.start.date);
      return aDate - bDate;
    });
    
    return res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
}

export default withAdminAuth(handler); 
