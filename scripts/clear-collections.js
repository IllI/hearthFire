// Script to clear Firestore collections before reseeding
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');
require('dotenv').config();

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Clear a specific collection
async function clearCollection(collectionName) {
  console.log(`Clearing collection: ${collectionName}...`);
  
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);
  
  console.log(`Found ${snapshot.docs.length} documents in ${collectionName}`);
  
  const deletePromises = snapshot.docs.map(document => {
    return deleteDoc(doc(db, collectionName, document.id));
  });
  
  await Promise.all(deletePromises);
  console.log(`Deleted ${snapshot.docs.length} documents from ${collectionName}`);
}

// Clear multiple collections
async function clearCollections() {
  try {
    await clearCollection('products');
    await clearCollection('categories');
    
    console.log('✅ All collections cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing collections:', error);
    process.exit(1);
  }
}

// Run the clearing process
clearCollections(); 