const admin = require('firebase-admin');

async function clearDeliverySchedules() {
  try {
    console.log('Attempting to initialize Firebase Admin...');
    // Initialize Firebase Admin similar to other scripts
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

    // Delete all documents in the delivery_schedules collection
    const schedulesRef = db.collection('deliverySchedules');
    const batch = db.batch();
    
    const schedules = await schedulesRef.get();
    console.log(`Found ${schedules.size} delivery schedules in Firestore`);
    
    if (schedules.empty) {
      console.log('No schedules to delete');
      return;
    }
    
    // Add each document to batch for deletion
    schedules.forEach(doc => {
      console.log(`Queuing deletion of schedule: ${doc.id}`);
      batch.delete(doc.ref);
    });
    
    // Commit the batch
    await batch.commit();
    console.log('✅ Successfully deleted all delivery schedules from Firestore');
    console.log('The system will now check Google Calendar for new delivery schedules');
    
  } catch (error) {
    console.error('❌ Error clearing delivery schedules:', error);
  }
}

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

clearDeliverySchedules(); 