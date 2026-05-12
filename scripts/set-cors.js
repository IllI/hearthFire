const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with your service account
try {
  // Try to use environment variable for service account
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'hearthfire-farms.appspot.com'
    });
  } else {
    // Fallback to service account file
    const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'hearthfire-farms.appspot.com'
      });
    } else {
      console.error('❌ Service account file not found at:', serviceAccountPath);
      console.error('Please make sure you have a service-account.json file in your project root');
      process.exit(1);
    }
  }
  
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
  process.exit(1);
}

// Define CORS configuration
const corsConfig = [
  {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001', 
      'https://hearthfire-farm.web.app',
      'https://hearthfire-farms.firebaseapp.com'
    ],
    method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    maxAgeSeconds: 3600,
    responseHeader: [
      'Content-Type',
      'Content-Length',
      'Accept',
      'Accept-Encoding',
      'Authorization',
      'X-Requested-With',
      'Origin'
    ]
  }
];

// Set CORS configuration for the bucket
async function setCors() {
  try {
    const bucket = admin.storage().bucket();
    
    console.log('Setting CORS configuration for bucket:', bucket.name);
    await bucket.setCorsConfiguration(corsConfig);
    
    console.log('✅ CORS configuration set successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting CORS configuration:', error);
    process.exit(1);
  }
}

// Execute the function
setCors(); 