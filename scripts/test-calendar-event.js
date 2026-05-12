// Script to test creating a Google Calendar event
const admin = require('firebase-admin');
const googleCalendar = require('../lib/google-calendar');
require('dotenv').config({ path: '.env.local' });

// Helper to properly format the private key
function formatPrivateKey(key) {
  if (!key) return null;
  
  // Replace escaped newlines with actual newlines
  let formattedKey = key.replace(/\\n/g, '\n');
  
  // Add BEGIN/END markers if missing
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }
  
  return formattedKey.trim();
}

async function testCalendarEvent() {
  try {
    console.log('Attempting to initialize Firebase Admin...');
    
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      try {
        // Get private key from environment
        const privateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY);
        
        const serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID || 'hearthfire-farms',
          clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          privateKey: privateKey
        };

        if (serviceAccount.clientEmail && serviceAccount.privateKey) {
          console.log('Initializing Firebase Admin with service account credentials');
          console.log('Service account email:', serviceAccount.clientEmail);
          console.log('Private key properly formatted:', !!serviceAccount.privateKey);
          
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://hearthfire-farms.firebaseio.com'
          });
        } else {
          console.log('No valid service account key found. Initializing with application default credentials...');
          admin.initializeApp();
        }
        
        console.log('✅ Firebase Admin initialized successfully with service account');
      } catch (error) {
        console.error('Error initializing Firebase Admin:', error);
        console.log('Initializing with application default credentials as fallback...');
        admin.initializeApp();
        console.log('✅ Firebase Admin initialized with application default credentials');
      }
    } else {
      console.log('Firebase Admin already initialized');
    }
    
    console.log('Firebase Admin using REAL implementations');
    const db = admin.firestore();
    
    // Get calendar settings
    console.log('Getting calendar settings...');
    const settingsRef = db.collection('settings').doc('googleCalendar');
    const settingsDoc = await settingsRef.get();
    
    if (!settingsDoc.exists) {
      console.error('❌ No Google Calendar settings found in Firestore');
      return;
    }
    
    const settings = settingsDoc.data();
    if (!settings.enabled) {
      console.error('❌ Google Calendar integration is disabled in settings');
      return;
    }
    
    console.log('Calendar ID:', settings.calendarId);
    
    // Initialize Google Calendar client
    const { calendar } = await googleCalendar.getCalendarClient();
    console.log('✅ Google Calendar client initialized successfully');
    
    // List available calendars
    console.log('Attempting to list available calendars...');
    const calendars = await googleCalendar.listCalendars();
    console.log(`Found ${calendars.length} calendars`);
    
    // Create two test events - one with correct spelling, one with misspelled title
    console.log('Creating test event with misspelled title (Availabilty)...');
    const misspelledEvent = await googleCalendar.createEvent({
      summary: 'Hearthfire Farm Delivery Availabilty',
      description: 'This is a test delivery availability event (misspelled)',
      start: {
        dateTime: new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(), // 8 hours after start
        timeZone: 'America/New_York',
      },
    });
    
    console.log('Creating test event with correct spelling (Availability)...');
    const correctEvent = await googleCalendar.createEvent({
      summary: 'Hearthfire Farm Delivery Availability',
      description: 'This is a test delivery availability event (correctly spelled)',
      start: {
        dateTime: new Date(new Date().getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days from now
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: new Date(new Date().getTime() + 6 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(), // 8 hours after start
        timeZone: 'America/New_York',
      },
    });
    
    console.log('✅ Test events created successfully');
    console.log('Misspelled event ID:', misspelledEvent.id);
    console.log('Misspelled event link:', misspelledEvent.htmlLink);
    console.log('Correct event ID:', correctEvent.id);
    console.log('Correct event link:', correctEvent.htmlLink);
    
    // List events to verify
    const events = await googleCalendar.listEvents();
    console.log(`Found ${events.length} events in calendar`);
    events.forEach(event => {
      console.log(`- ${event.summary} (${event.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error testing Google Calendar event creation:', error);
  }
}

testCalendarEvent(); 