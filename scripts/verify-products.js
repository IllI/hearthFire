require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

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

async function verifyProducts() {
  try {
    console.log('Fetching all products from Firestore...');
    const productsSnapshot = await db.collection('products').get();
    
    console.log(`\nTotal products in Firestore: ${productsSnapshot.size}`);
    
    // Check for missing required fields
    const issues = [];
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      const missingFields = [];
      
      // Check required fields
      if (!data.name) missingFields.push('name');
      if (!data.description) missingFields.push('description');
      if (!data.price) missingFields.push('price');
      if (!data.category) missingFields.push('category');
      
      if (missingFields.length > 0) {
        issues.push({
          id: doc.id,
          name: data.name || 'Unnamed Product',
          missingFields
        });
      }
    });
    
    // Print summary
    console.log('\nVerification Results:');
    console.log('--------------------');
    console.log(`Total Products: ${productsSnapshot.size}`);
    console.log(`Products with Issues: ${issues.length}`);
    
    if (issues.length > 0) {
      console.log('\nProducts with Missing Fields:');
      issues.forEach(issue => {
        console.log(`\nID: ${issue.id}`);
        console.log(`Name: ${issue.name}`);
        console.log(`Missing Fields: ${issue.missingFields.join(', ')}`);
      });
    }
    
    // Check categories
    const categories = new Set();
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.category) categories.add(data.category);
    });
    
    console.log('\nCategories Found:');
    console.log('----------------');
    Array.from(categories).sort().forEach(category => {
      const count = productsSnapshot.docs.filter(doc => doc.data().category === category).length;
      console.log(`${category}: ${count} products`);
    });
    
  } catch (error) {
    console.error('Error verifying products:', error);
  } finally {
    process.exit(0);
  }
}

verifyProducts(); 