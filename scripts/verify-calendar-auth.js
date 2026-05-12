// Script to verify Google Calendar authentication
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

// Helper to properly format the private key
function formatPrivateKey(key) {
  if (!key) return null;
  
  // Just do a simple newline replacement without any additional transformations
  return key ? key.replace(/\\n/g, '\n') : null;
}

async function verifyCalendarAuth() {
  console.log('Verifying Google Calendar authentication...');
  
  // Get credentials from environment variables
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  
  // Validate required credentials
  if (!serviceAccountEmail) {
    console.error('❌ Error: GOOGLE_SERVICE_ACCOUNT_EMAIL is not defined in .env.local');
    process.exit(1);
  }
  
  if (!rawPrivateKey) {
    console.error('❌ Error: GOOGLE_PRIVATE_KEY is not defined in .env.local');
    process.exit(1);
  }
  
  if (!calendarId) {
    console.error('❌ Error: GOOGLE_CALENDAR_ID is not defined in .env.local');
    console.log('ℹ️  Note: Will attempt to use service account email as calendar ID');
  }
  
  // Format the private key
  const privateKey = formatPrivateKey(rawPrivateKey);
  console.log('✅ Private key formatted successfully');
  
  // Initialize JWT auth client with Google credentials
  try {
    console.log('\nApproach 1: Using Google Calendar service account credentials');
    console.log('Service Account Email:', serviceAccountEmail);
    console.log('Calendar ID:', calendarId || serviceAccountEmail);
    
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    
    // Test the authentication
    console.log('Attempting to authenticate with Google Calendar credentials...');
    await auth.authorize();
    console.log('✅ Authentication successful with Google Calendar credentials');
    
    // Test calendar access
    const calendar = google.calendar({ version: 'v3', auth });
    await testCalendarAccess(calendar, calendarId || serviceAccountEmail);
    
    return;
  } catch (error) {
    console.error(`❌ Authentication failed with Google Calendar credentials: ${error.message}`);
    
    // Try with Firebase service account credentials
    console.log('\nApproach 2: Trying with Firebase service account key');
    
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY is not defined in .env.local');
      process.exit(1);
    }
    
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      const firebaseEmail = serviceAccount.client_email;
      const firebaseKey = serviceAccount.private_key;
      
      if (!firebaseEmail || !firebaseKey) {
        console.error('❌ Firebase service account key is missing required properties');
        process.exit(1);
      }
      
      console.log('Firebase Service Account Email:', firebaseEmail);
      
      const auth = new google.auth.JWT({
        email: firebaseEmail,
        key: firebaseKey,
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      
      // Test the authentication
      console.log('Attempting to authenticate with Firebase credentials...');
      await auth.authorize();
      console.log('✅ Authentication successful with Firebase credentials');
      
      // Test calendar access
      const calendar = google.calendar({ version: 'v3', auth });
      await testCalendarAccess(calendar, calendarId || firebaseEmail);
      
      return;
    } catch (firebaseError) {
      console.error(`❌ Authentication failed with Firebase credentials: ${firebaseError.message}`);
      
      console.error('\n❌ All authentication attempts failed.');
      console.log('This could be due to:');
      console.log('1. The service account has been disabled or deleted');
      console.log('2. The service account doesn\'t have proper permissions');
      console.log('3. The private key has been revoked or expired');
      console.log('\nSuggested actions:');
      console.log('1. Create a new service account with proper permissions');
      console.log('2. Generate a new private key for the service account');
      console.log('3. Update your .env.local file with the new credentials');
      
      process.exit(1);
    }
  }
}

async function testCalendarAccess(calendar, targetCalendarId) {
  // List available calendars
  console.log('Listing available calendars...');
  const calendarList = await calendar.calendarList.list();
  
  if (calendarList.data.items && calendarList.data.items.length > 0) {
    console.log(`✅ Successfully listed ${calendarList.data.items.length} calendars:`);
    calendarList.data.items.forEach(cal => {
      console.log(`- ${cal.summary} (${cal.id})`);
    });
  } else {
    console.log('✅ Authentication successful, but no calendars found');
  }
  
  // Verify access to the intended calendar
  console.log(`Testing access to calendar: ${targetCalendarId}`);
  
  try {
    const calendarInfo = await calendar.calendars.get({
      calendarId: targetCalendarId
    });
    console.log(`✅ Successfully accessed calendar: ${calendarInfo.data.summary}`);
  } catch (calendarError) {
    console.error(`❌ Error accessing calendar: ${calendarError.message}`);
    console.log('This could mean:');
    console.log('1. The calendar ID is incorrect');
    console.log('2. The service account does not have access to this calendar');
    console.log('3. The calendar does not exist');
  }
}

verifyCalendarAuth(); 