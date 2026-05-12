// Test with Firebase Admin SDK
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// First, let's check the Firebase configuration we're using
console.log('Firebase Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

// Check if we have credentials
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.log('No service account key found in environment variables.');
  console.log('We will try to use application default credentials.');
  
  // Initialize without explicit credentials (uses ADC - Application Default Credentials)
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
} else {
  // Parse the service account key JSON
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Initialized with service account credentials');
  } catch (error) {
    console.error('Error parsing service account key:', error);
    process.exit(1);
  }
}

// Get Firestore instance
const db = admin.firestore();

// Simple test function
async function testFirestoreAdmin() {
  try {
    console.log('Attempting to add a test document using Admin SDK...');
    
    // Simple document with basic fields
    const testDoc = {
      name: "Admin Test Document",
      description: "This is a test using the admin SDK",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Log the document
    console.log('Document to add:', JSON.stringify({
      name: testDoc.name,
      description: testDoc.description,
      timestamp: "server timestamp"
    }, null, 2));
    
    // Add to a test collection
    const docRef = await db.collection('test').add(testDoc);
    console.log(`Success! Document added with ID: ${docRef.id}`);
  } catch (error) {
    console.error('Error adding document:', error);
  }
}

// Run the test
testFirestoreAdmin()
  .then(() => console.log('Test completed'))
  .catch(error => console.error('Unhandled error:', error)); 