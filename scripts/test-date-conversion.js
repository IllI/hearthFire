// Script to test date conversion issues
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

async function testDateConversion() {
  try {
    console.log('Initializing Firebase Admin...');
    
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin initialized successfully');
    }
    
    const db = admin.firestore();
    
    // Get a schedule from Firestore
    const schedulesSnapshot = await db.collection('deliverySchedules').limit(1).get();
    
    if (schedulesSnapshot.empty) {
      console.log('No schedules found in Firestore');
      return;
    }
    
    const scheduleDoc = schedulesSnapshot.docs[0];
    const originalData = scheduleDoc.data();
    
    console.log('Original Firestore data:');
    console.log(JSON.stringify(originalData, null, 2));
    
    // Test 1: Directly checking Firestore Timestamp
    const firestoreDate = originalData.date;
    console.log('\nFirestore date object:');
    console.log(firestoreDate);
    
    // Test 2: Converting to JavaScript Date
    if (firestoreDate && firestoreDate._seconds) {
      const jsDate = new Date(firestoreDate._seconds * 1000);
      console.log('\nConverted to JavaScript Date:');
      console.log(jsDate);
      console.log(`Date string: ${jsDate.toDateString()}`);
      console.log(`ISO string: ${jsDate.toISOString()}`);
      
      // Test 3: Simulating how our API sends it to the client
      const clientDate = jsDate.toISOString();
      console.log('\nSent to client as ISO string:');
      console.log(clientDate);
      
      // Test 4: Simulating client-side parsing
      const parsedClientDate = new Date(clientDate);
      console.log('\nClient parsing the ISO string:');
      console.log(parsedClientDate);
      console.log(`Client date string: ${parsedClientDate.toDateString()}`);
      
      // Compare dates
      const now = new Date();
      console.log('\nDate comparison:');
      console.log(`Original date: ${jsDate.toDateString()}`);
      console.log(`Current date: ${now.toDateString()}`);
      console.log(`Is date in the past? ${jsDate <= now}`);
    } else {
      console.log('Invalid date format in schedule');
    }
  } catch (error) {
    console.error('Error testing date conversion:', error);
  }
}

testDateConversion().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 