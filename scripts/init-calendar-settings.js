// This script initializes Google Calendar settings in Firestore
// Run with: node scripts/init-calendar-settings.js

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
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

// Helper to properly format the private key
function formatPrivateKey(key) {
  if (!key) return null;
  
  // Just do a simple newline replacement without any additional transformations
  return key ? key.replace(/\\n/g, '\n') : null;
}

async function initializeCalendarSettings() {
  try {
    console.log('Checking for existing Google Calendar settings...');
    
    const firestore = admin.firestore();
    const settingsRef = firestore.collection('settings').doc('googleCalendar');
    const settingsDoc = await settingsRef.get();
    
    if (settingsDoc.exists) {
      console.log('Google Calendar settings already exist:');
      const settings = settingsDoc.data();
      console.log({
        enabled: settings.enabled,
        calendarId: settings.calendarId,
        serviceAccountEmail: settings.serviceAccountEmail,
        privateKey: settings.privateKey ? '[PRIVATE KEY EXISTS]' : '[NO PRIVATE KEY]'
      });
      
      // Check if we need to update the settings
      const needsUpdate = !settings.enabled || 
        !settings.calendarId || 
        !settings.serviceAccountEmail || 
        !settings.privateKey;
      
      if (needsUpdate) {
        console.log('Settings incomplete, updating...');
      } else {
        console.log('Settings look complete, no update needed');
        return;
      }
    }
    
    // Check if we have the required environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 
        !process.env.GOOGLE_PRIVATE_KEY || 
        !process.env.GOOGLE_CALENDAR_ID) {
      console.error('Missing required environment variables:');
      console.error('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✓' : '✗');
      console.error('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✓' : '✗');
      console.error('GOOGLE_CALENDAR_ID:', process.env.GOOGLE_CALENDAR_ID ? '✓' : '✗');
      process.exit(1);
    }
    
    // Format the private key properly before saving
    const privateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY);
    
    // Create or update the settings
    const settings = {
      enabled: true,
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: privateKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await settingsRef.set(settings, { merge: true });
    
    console.log('Successfully initialized Google Calendar settings in Firestore:');
    console.log({
      enabled: settings.enabled,
      calendarId: settings.calendarId,
      serviceAccountEmail: settings.serviceAccountEmail,
      privateKey: '[PRIVATE KEY HIDDEN]'
    });
  } catch (error) {
    console.error('Error initializing Google Calendar settings:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeCalendarSettings()
  .then(() => {
    console.log('Initialization complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Initialization failed:', error);
    process.exit(1);
  }); 