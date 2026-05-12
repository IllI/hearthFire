// This script updates Google Calendar settings in Firestore
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Check if a calendar ID was provided as a command line argument
const args = process.argv.slice(2);
const providedCalendarId = args.length > 0 ? args[0] : null;

if (providedCalendarId) {
  console.log(`Using provided calendar ID: ${providedCalendarId}`);
}

// Initialize Firebase Admin SDK
let firebaseAdmin;
try {
  console.log('Initializing Firebase Admin...');
  
  // Parse the service account key JSON
  let serviceAccount;
  
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('Initializing Firebase Admin with service account credentials');
  } catch (error) {
    console.error('Error parsing service account key:', error);
    process.exit(1);
  }
  
  firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
  
  console.log('✅ Firebase Admin initialized successfully with service account');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  process.exit(1);
}

const db = admin.firestore();

// Helper to properly format the private key
function formatPrivateKey(key) {
  if (!key) return null;
  
  // Just do a simple newline replacement without any additional transformations
  return key ? key.replace(/\\n/g, '\n') : null;
}

async function updateCalendarSettings() {
  try {
    console.log('Getting Google Calendar settings from Firestore...');
    
    // Get reference to settings document
    const settingsRef = db.collection('settings').doc('googleCalendar');
    const doc = await settingsRef.get();
    
    // Get configuration from environment variables
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!serviceAccountEmail || !rawPrivateKey) {
      console.error('Missing Google service account credentials in environment variables');
      process.exit(1);
    }
    
    // Format the private key for proper JWT authentication
    const privateKey = formatPrivateKey(rawPrivateKey);
    
    // Prepare new settings
    const newSettings = {
      enabled: true,
      serviceAccountEmail,
      privateKey,
      // Use provided calendar ID if available, otherwise use service account email
      calendarId: providedCalendarId || process.env.GOOGLE_CALENDAR_ID || serviceAccountEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await settingsRef.set(newSettings);
    
    console.log('✅ Google Calendar settings updated successfully in Firestore');
    console.log('Calendar ID set to:', providedCalendarId || process.env.GOOGLE_CALENDAR_ID || serviceAccountEmail);
    console.log('Service Account Email:', serviceAccountEmail);
    console.log('Private Key length:', privateKey ? privateKey.length : 0, 'characters');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating Google Calendar settings:', error);
    process.exit(1);
  }
}

updateCalendarSettings(); 