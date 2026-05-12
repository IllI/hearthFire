// This script updates existing delivery schedules in Firestore 
// by adding Google Calendar event IDs if they're missing
// Run with: node scripts/update-schedule-calendar-ids.js

const admin = require('firebase-admin');
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin SDK
try {
  // Check if we have the service account key in the environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Parse the service account key from the environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('Initialized Firebase Admin SDK with service account from environment variable');
  } else {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found');
    process.exit(1);
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

// Initialize Google Calendar client
async function getCalendarClient() {
  try {
    console.log('Initializing Google Calendar client...');
    
    // Check if we have Google Calendar credentials
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error('Missing Google Calendar credentials in environment variables');
      process.exit(1);
    }
    
    // Format private key correctly
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Set up auth with service account
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    
    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth });
    
    // Get calendar ID
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    if (!calendarId) {
      console.error('Missing GOOGLE_CALENDAR_ID in environment variables');
      process.exit(1);
    }
    
    console.log('Google Calendar client initialized successfully');
    return { calendar, calendarId };
  } catch (error) {
    console.error('Error initializing Google Calendar client:', error);
    throw error;
  }
}

// Create a calendar event for a schedule
async function createCalendarEvent(schedule, { calendar, calendarId }) {
  // Extract schedule date
  const scheduleDate = new Date(schedule.date);
  
  // Create time slots description
  const slotsDescription = schedule.slots
    .map(slot => `${slot.time}: ${slot.maxOrders} slots available`)
    .join('\n');
  
  // Create zip codes description
  const zipCodesDescription = `Available for zip codes: ${schedule.zipCodes.join(', ')}`;
  
  // Format the date for the event summary
  const formattedDate = scheduleDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  
  // Create the event
  const event = {
    summary: `Hearthfire Farm Delivery Availability - ${formattedDate}`,
    description: `Delivery slots available for ${formattedDate}\n\n${slotsDescription}\n\n${zipCodesDescription}\n\nCutoff Time: ${schedule.cutoffTime} hours before delivery\n\n${schedule.note || ''}`,
    start: {
      date: scheduleDate.toISOString().split('T')[0], // Use all-day event format
    },
    end: {
      date: new Date(scheduleDate.getTime() + 86400000).toISOString().split('T')[0], // Next day for all-day event
    },
    extendedProperties: {
      private: {
        type: 'delivery-availability',
        scheduleId: schedule.id,
        slots: JSON.stringify(schedule.slots),
        zipCodes: JSON.stringify(schedule.zipCodes),
        cutoffTime: schedule.cutoffTime.toString()
      }
    }
  };
  
  try {
    const response = await calendar.events.insert({
      calendarId,
      resource: event,
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating event in Google Calendar:', error);
    throw error;
  }
}

async function updateSchedulesWithCalendarIds() {
  try {
    console.log('Starting update of delivery schedules...');
    
    // Get calendar client
    const calendarClient = await getCalendarClient();
    
    // Get all delivery schedules from Firestore
    const firestore = admin.firestore();
    const schedulesSnapshot = await firestore.collection('deliverySchedules').get();
    
    if (schedulesSnapshot.empty) {
      console.log('No delivery schedules found in Firestore');
      return;
    }
    
    console.log(`Found ${schedulesSnapshot.size} delivery schedules in Firestore`);
    
    // Filter schedules without a Google Calendar event ID
    const schedulesWithoutEventId = [];
    schedulesSnapshot.forEach(doc => {
      const schedule = {
        id: doc.id,
        ...doc.data()
      };
      
      if (!schedule.googleCalendarEventId) {
        schedulesWithoutEventId.push(schedule);
      }
    });
    
    console.log(`Found ${schedulesWithoutEventId.length} schedules without a Google Calendar event ID`);
    
    // Update each schedule with a new calendar event
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const schedule of schedulesWithoutEventId) {
      try {
        console.log(`Creating calendar event for schedule ${schedule.id}`);
        
        // Create a calendar event
        const calendarEvent = await createCalendarEvent(schedule, calendarClient);
        
        // Update the schedule with the event ID
        await firestore.collection('deliverySchedules').doc(schedule.id).update({
          googleCalendarEventId: calendarEvent.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Updated schedule ${schedule.id} with calendar event ID ${calendarEvent.id}`);
        updatedCount++;
      } catch (error) {
        console.error(`Error updating schedule ${schedule.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Update complete: ${updatedCount} schedules updated, ${errorCount} errors`);
  } catch (error) {
    console.error('Error updating schedules with calendar IDs:', error);
    process.exit(1);
  }
}

// Run the update
updateSchedulesWithCalendarIds()
  .then(() => {
    console.log('Process completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Process failed:', error);
    process.exit(1);
  }); 