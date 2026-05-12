const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

const db = admin.firestore();

async function deleteAllProducts() {
  console.log('Starting cleanup of products collection...');
  
  try {
    // Get all products
    const snapshot = await db.collection('products').get();
    
    // Delete each product
    const deletePromises = snapshot.docs.map(doc => {
      console.log(`Deleting product: ${doc.data().name} (${doc.id})`);
      return doc.ref.delete();
    });
    
    await Promise.all(deletePromises);
    
    console.log(`Successfully deleted ${snapshot.size} products`);
  } catch (error) {
    console.error('Error deleting products:', error);
  }
}

// Run the cleanup
deleteAllProducts(); 