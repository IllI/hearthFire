/**
 * Update to Latin Names
 * 
 * This script updates all plant product names in the database to use their Latin names
 * instead of common names for improved botanical accuracy.
 * 
 * Usage:
 *   node update-to-latin-names.js
 */

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to normalize plant names for file/directory naming
function normalizePlantName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .trim();                   // Trim whitespace
}

// Function to update product names to Latin names
async function updateToLatinNames() {
  try {
    console.log('Starting update of product names to Latin names...');
    
    // Get all products from Firestore
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${products.length} products in the database.`);
    
    // Track statistics
    let updatedCount = 0;
    let skippedCount = 0;
    const updated = [];
    const skipped = [];
    
    // Process each product
    for (const product of products) {
      // Skip products that don't have a latinName field
      if (!product.latinName) {
        console.log(`⚠️ Skipping product "${product.name}" - no Latin name available.`);
        skippedCount++;
        skipped.push(product.name);
        continue;
      }
      
      const originalName = product.name;
      const latinName = product.latinName;
      
      console.log(`Updating "${originalName}" to "${latinName}"...`);
      
      try {
        // Update data to send to Firestore
        const updateData = { 
          name: latinName,
          originalName: originalName // Save the original name in a new field
        };
        
        // Handle image path updates - we'll keep the same image path
        // No need to change image paths as they use normalized names
        // But we'll log what's happening for clarity
        if (product.image) {
          const originalNormalized = normalizePlantName(originalName);
          const latinNormalized = normalizePlantName(latinName);
          
          console.log(`Image path info for ${originalName}:`);
          console.log(`- Current image path: ${product.image}`);
          console.log(`- Original normalized: ${originalNormalized}`);
          console.log(`- Latin normalized: ${latinNormalized}`);
          
          // If you want to update image paths in the future, uncomment this code:
          /*
          // Only update if the path contains the original normalized name
          if (product.image.includes(originalNormalized)) {
            const newImagePath = product.image.replace(originalNormalized, latinNormalized);
            updateData.image = newImagePath;
            console.log(`- Updated image path: ${newImagePath}`);
          }
          */
        }
        
        // Update the product name in Firestore
        const productRef = doc(db, 'products', product.id);
        await updateDoc(productRef, updateData);
        
        console.log(`✅ Successfully updated "${originalName}" to "${latinName}"`);
        updatedCount++;
        updated.push({ original: originalName, latin: latinName });
      } catch (error) {
        console.error(`❌ Error updating ${originalName}: ${error.message}`);
        skippedCount++;
        skipped.push(originalName);
      }
    }
    
    // Generate summary
    console.log('\n===== UPDATE SUMMARY =====');
    console.log(`Total products: ${products.length}`);
    console.log(`Updated to Latin names: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    
    console.log('\nSuccessfully updated products:');
    updated.forEach((item, index) => {
      console.log(`${index + 1}. "${item.original}" → "${item.latin}"`);
    });
    
    if (skipped.length > 0) {
      console.log('\nSkipped products (no Latin name available):');
      skipped.forEach((name, index) => {
        console.log(`${index + 1}. ${name}`);
      });
    }
    
    console.log('\n✅ Update process complete!');
    
    return { updated, skipped };
  } catch (error) {
    console.error('❌ Error updating product names:', error);
    throw error;
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  updateToLatinNames()
    .then(() => {
      console.log('Product names have been updated to Latin names!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
} else {
  module.exports = { updateToLatinNames };
} 