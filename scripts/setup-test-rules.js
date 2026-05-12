const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

console.log(`
=== FIRESTORE TEST MODE SETUP ===

1. Go to: https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore

2. Click on "Rules" in the left sidebar

3. Replace the current rules with these test mode rules:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}

4. Click "Publish"

IMPORTANT: These rules allow anyone to read and write to your database.
Only use these rules for development and NEVER in production.

After testing is complete, you should update to the production rules in firestore.rules.

=================================
`);

// Initialize Firebase just to verify the config
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Firebase configuration loaded successfully.');
console.log('Project ID:', firebaseConfig.projectId); 