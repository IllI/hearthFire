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

async function cleanupProducts() {
  try {
    console.log('Fetching all products from Firestore...');
    const productsSnapshot = await db.collection('products').get();
    
    console.log(`\nTotal products in Firestore: ${productsSnapshot.size}`);
    
    // Track products by name for duplicate detection
    const productsByName = new Map();
    const duplicates = [];
    const testProducts = [];
    
    // First pass: identify duplicates and test products
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      const name = data.name?.toLowerCase().trim();
      
      if (!name) {
        testProducts.push({ id: doc.id, data });
        return;
      }
      
      if (productsByName.has(name)) {
        // Compare timestamps to keep the newer version
        const existing = productsByName.get(name);
        const existingTimestamp = existing.data.createdAt?.toDate() || new Date(0);
        const newTimestamp = data.createdAt?.toDate() || new Date(0);
        
        if (newTimestamp > existingTimestamp) {
          duplicates.push(existing);
          productsByName.set(name, { id: doc.id, data });
        } else {
          duplicates.push({ id: doc.id, data });
        }
      } else {
        productsByName.set(name, { id: doc.id, data });
      }
    });
    
    // Print analysis
    console.log('\nAnalysis Results:');
    console.log('-----------------');
    console.log(`Unique Products: ${productsByName.size}`);
    console.log(`Duplicate Products: ${duplicates.length}`);
    console.log(`Test/Invalid Products: ${testProducts.length}`);
    
    if (duplicates.length > 0) {
      console.log('\nDuplicate Products:');
      duplicates.forEach(dup => {
        console.log(`\nID: ${dup.id}`);
        console.log(`Name: ${dup.data.name}`);
        console.log(`Category: ${dup.data.category}`);
        console.log(`Created: ${dup.data.createdAt?.toDate() || 'Unknown'}`);
      });
    }
    
    if (testProducts.length > 0) {
      console.log('\nTest/Invalid Products:');
      testProducts.forEach(test => {
        console.log(`\nID: ${test.id}`);
        console.log(`Data: ${JSON.stringify(test.data, null, 2)}`);
      });
    }
    
    // Ask for confirmation before proceeding
    console.log('\nWould you like to proceed with cleanup?');
    console.log('This will:');
    console.log(`1. Remove ${duplicates.length} duplicate products`);
    console.log(`2. Remove ${testProducts.length} test/invalid products`);
    console.log(`3. Keep ${productsByName.size} unique products`);
    
    // Wait for user input
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('\nType "yes" to proceed with cleanup: ', async (answer) => {
      readline.close();
      
      if (answer.toLowerCase() === 'yes') {
        console.log('\nProceeding with cleanup...');
        
        // Delete duplicates
        for (const dup of duplicates) {
          try {
            await db.collection('products').doc(dup.id).delete();
            console.log(`✅ Deleted duplicate: ${dup.data.name}`);
          } catch (error) {
            console.error(`❌ Error deleting duplicate ${dup.id}:`, error);
          }
        }
        
        // Delete test products
        for (const test of testProducts) {
          try {
            await db.collection('products').doc(test.id).delete();
            console.log(`✅ Deleted test product: ${test.id}`);
          } catch (error) {
            console.error(`❌ Error deleting test product ${test.id}:`, error);
          }
        }
        
        console.log('\nCleanup completed!');
        
        // Verify final state
        const finalSnapshot = await db.collection('products').get();
        console.log(`\nFinal product count: ${finalSnapshot.size}`);
        
        // Show category distribution
        const categories = new Set();
        finalSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.category) categories.add(data.category);
        });
        
        console.log('\nFinal Category Distribution:');
        Array.from(categories).sort().forEach(category => {
          const count = finalSnapshot.docs.filter(doc => doc.data().category === category).length;
          console.log(`${category}: ${count} products`);
        });
      } else {
        console.log('\nCleanup cancelled.');
      }
      
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupProducts(); 