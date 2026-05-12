// Script to check dates in delivery schedules
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

async function checkSchedules() {
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
    
    // Check the schedules
    const schedulesSnapshot = await db.collection('deliverySchedules').get();
    
    console.log(`Found ${schedulesSnapshot.size} schedules in Firestore`);
    
    if (schedulesSnapshot.empty) {
      console.log('No schedules found in Firestore');
      return;
    }
    
    schedulesSnapshot.forEach(doc => {
      const data = doc.data();
      const dateSeconds = data.date && data.date._seconds;
      
      if (dateSeconds) {
        const jsDate = new Date(dateSeconds * 1000);
        console.log(`Schedule ID: ${doc.id}, Date: ${jsDate.toDateString()}`);
      } else {
        console.log(`Schedule ID: ${doc.id}, Invalid date format`);
      }
    });
  } catch (error) {
    console.error('Error checking schedules:', error);
  }
}

checkSchedules().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 