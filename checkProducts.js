const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Use the service account key from environment variable
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin initialized with service account credentials');
      } catch (parseError) {
        console.error('Error parsing service account key:', parseError);
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms'
        });
        console.log('Firebase Admin initialized with application default credentials');
      }
    } else {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms'
      });
      console.log('Firebase Admin initialized with application default credentials');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const productsRef = db.collection('products');

async function checkProducts() {
  try {
    const snapshot = await productsRef.get();
    
    if (snapshot.empty) {
      console.log('No products found in the database');
      return;
    }
    
    console.log(`Found ${snapshot.size} products in the database`);
    
    // Show a sample of 5 products
    let count = 0;
    snapshot.forEach(doc => {
      if (count < 5) {
        const data = doc.data();
        console.log(`\nProduct ${count + 1}:`);
        console.log(`ID: ${doc.id}`);
        console.log(`Name: ${data.name}`);
        console.log(`Latin Name: ${data.latinName || 'N/A'}`);
        console.log(`Image: ${data.image ? 'Yes' : 'No'}`);
        console.log(`Category: ${data.category}`);
        count++;
      }
    });
  } catch (error) {
    console.error('Error checking products:', error);
  }
}

// Run the check
checkProducts()
  .then(() => {
    console.log('\nProduct check completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  }); 