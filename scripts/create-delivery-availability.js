// Script to create multiple delivery availability events in Google Calendar
// with the correct spelling of "Availability"
const admin = require('firebase-admin');
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
async function init() {
  try {
    console.log('Initializing Firebase Admin...');
    
    if (!admin.apps.length) {
      try {
        const serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID || 'hearthfire-farms',
          clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          privateKey: process.env.GOOGLE_PRIVATE_KEY ? 
            process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
        };

        if (serviceAccount.clientEmail && serviceAccount.privateKey) {
          console.log('Initializing Firebase Admin with service account credentials');
          console.log('Service account email:', serviceAccount.clientEmail);
          console.log('Private key length:', serviceAccount.privateKey.length);
          
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://hearthfire-farms.firebaseio.com'
          });
        } else {
          console.log('No valid service account key found. Initializing with application default credentials...');
          admin.initializeApp();
        }
        
        console.log('✅ Firebase Admin initialized successfully');
      } catch (error) {
        console.error('Error initializing Firebase Admin:', error);
        process.exit(1);
      }
    }
    
    return admin.firestore();
  } catch (error) {
    console.error('Error in initialization:', error);
    process.exit(1);
  }
}

// Get Google Calendar client
async function getCalendarClient() {
  try {
    console.log('Getting calendar settings...');
    const db = admin.firestore();
    const settingsRef = db.collection('settings').doc('googleCalendar');
    const settingsDoc = await settingsRef.get();
    
    if (!settingsDoc.exists) {
      console.error('No Google Calendar settings found in Firestore');
      return null;
    }
    
    const settings = settingsDoc.data();
    if (!settings.enabled) {
      console.error('Google Calendar integration is disabled in settings');
      return null;
    }
    
    const { serviceAccountEmail, privateKey, calendarId } = settings;
    
    console.log('Calendar ID:', calendarId);
    
    // Initialize auth
    let formattedKey = privateKey;
    if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      formattedKey = privateKey.replace(/\\n/g, '\n');
    }
    
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    
    // Test authorization
    console.log('Testing authorization...');
    await auth.authorize();
    console.log('✅ Authorization successful');
    
    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth });
    
    return { calendar, calendarId };
  } catch (error) {
    console.error('Error getting Google Calendar client:', error);
    return null;
  }
}

// Create a delivery availability event
async function createAvailabilityEvent(date, { calendar, calendarId }) {
  try {
    // Create an all-day event for delivery availability
    const event = {
      summary: 'Hearthfire Farm Delivery Availability',
      description: 'Delivery day with available time slots: Morning (9am-12pm) and Afternoon (1pm-5pm)',
      start: {
        dateTime: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          9, // 9 AM
          0
        ).toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          17, // 5 PM
          0
        ).toISOString(),
        timeZone: 'America/New_York',
      },
    };
    
    const response = await calendar.events.insert({
      calendarId,
      resource: event,
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating event:', error);
    if (error.response) {
      console.error('Error data:', error.response.data);
    }
    return null;
  }
}

// Create multiple delivery availability events
async function createDeliveryEvents() {
  const db = await init();
  const { calendar, calendarId } = await getCalendarClient();
  
  if (!calendar || !calendarId) {
    console.error('Failed to initialize Google Calendar client');
    process.exit(1);
  }
  
  // Create delivery dates for the next 8 weeks on Thursdays and Saturdays
  const today = new Date();
  const events = [];
  
  for (let i = 0; i < 8; i++) {
    // Calculate next Thursday
    const thursday = new Date(today);
    thursday.setDate(today.getDate() + ((4 + 7 - today.getDay()) % 7) + (i * 7));
    
    // Calculate next Saturday
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + ((6 + 7 - today.getDay()) % 7) + (i * 7));
    
    // Create events for Thursday and Saturday
    console.log(`Creating event for Thursday: ${thursday.toDateString()}`);
    const thursdayEvent = await createAvailabilityEvent(thursday, { calendar, calendarId });
    
    console.log(`Creating event for Saturday: ${saturday.toDateString()}`);
    const saturdayEvent = await createAvailabilityEvent(saturday, { calendar, calendarId });
    
    if (thursdayEvent) {
      console.log(`✅ Created event for ${thursday.toDateString()}: ${thursdayEvent.htmlLink}`);
      events.push(thursdayEvent);
    }
    
    if (saturdayEvent) {
      console.log(`✅ Created event for ${saturday.toDateString()}: ${saturdayEvent.htmlLink}`);
      events.push(saturdayEvent);
    }
  }
  
  console.log(`\nCreated ${events.length} delivery availability events`);
  
  // List all events to verify
  console.log('\nListing all events:');
  const response = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  if (response.data.items.length === 0) {
    console.log('No events found');
  } else {
    console.log(`Found ${response.data.items.length} events:`);
    response.data.items.forEach(event => {
      const date = new Date(event.start.dateTime || event.start.date);
      console.log(`- ${event.summary} on ${date.toDateString()} (${event.id})`);
    });
  }
}

// Run the script
createDeliveryEvents(); 