// Script to sync Google Calendar events to Firestore
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

// Sync Google Calendar events to Firestore
async function syncCalendarToFirestore() {
  const db = await init();
  const { calendar, calendarId } = await getCalendarClient();
  
  if (!calendar || !calendarId) {
    console.error('Failed to initialize Google Calendar client');
    process.exit(1);
  }
  
  try {
    // Get events from Google Calendar
    console.log('Fetching events from Google Calendar...');
    
    // Calculate time range (from now to 6 months in the future)
    const timeMin = new Date().toISOString();
    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 6);
    
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax: timeMax.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    if (response.data.items.length === 0) {
      console.log('No events found in Google Calendar');
      return;
    }
    
    console.log(`Found ${response.data.items.length} events in Google Calendar`);
    
    // Filter events to include both spellings of "Availability"
    const availabilityEvents = response.data.items.filter(event => 
      event.summary && (
        event.summary.includes('Delivery Availability') || 
        event.summary.includes('Delivery Availabilty') ||
        event.summary.includes('Hearthfire Farm Delivery')
      )
    );
    
    console.log(`Found ${availabilityEvents.length} delivery availability events`);
    
    if (availabilityEvents.length === 0) {
      console.log('No delivery availability events found');
      return;
    }
    
    // Process and write to Firestore
    console.log('Processing events and writing to Firestore...');
    
    const batch = db.batch();
    let processedCount = 0;
    
    for (const event of availabilityEvents) {
      try {
        const eventDate = new Date(event.start.dateTime || event.start.date);
        
        // Create a schedule document in Firestore
        const scheduleData = {
          date: new Date(
            eventDate.getFullYear(),
            eventDate.getMonth(),
            eventDate.getDate(),
            15, // 3 PM - arbitrary time for the date
            0
          ),
          slots: [
            {
              id: 'morning',
              name: 'Morning',
              time: '9am - 12pm',
              available: true,
              maxOrders: 10,
              currentOrders: 0
            },
            {
              id: 'afternoon',
              name: 'Afternoon',
              time: '1pm - 5pm',
              available: true,
              maxOrders: 10,
              currentOrders: 0
            }
          ],
          zipCodes: ['12345', '23456', '34567'], // Default zip codes
          cutoffTime: '6pm day before',
          googleCalendarEventId: event.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Use the Google Calendar event ID as the document ID
        const scheduleRef = db.collection('deliverySchedules').doc(event.id);
        batch.set(scheduleRef, scheduleData);
        
        processedCount++;
        console.log(`Processed event: ${event.summary} on ${eventDate.toDateString()}`);
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
      }
    }
    
    // Commit the batch
    await batch.commit();
    console.log(`✅ Successfully synced ${processedCount} events to Firestore`);
    
    // Verify by listing the schedules from Firestore
    const schedulesRef = db.collection('deliverySchedules');
    const snapshot = await schedulesRef.get();
    
    console.log(`\nVerifying: Found ${snapshot.size} schedules in Firestore`);
    
    if (!snapshot.empty) {
      snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.date.toDate ? data.date.toDate() : new Date(data.date);
        console.log(`- Schedule ID: ${doc.id}, Date: ${date.toDateString()}`);
      });
    }
    
  } catch (error) {
    console.error('Error syncing Google Calendar to Firestore:', error);
  }
}

// Run the script
syncCalendarToFirestore(); 