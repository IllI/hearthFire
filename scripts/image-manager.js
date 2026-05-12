/**
 * Image Manager
 * 
 * A utility script to manage plant images in the database.
 * Usage:
 *   node image-manager.js update <plantId> <imageUrl> - Update image for a specific plant
 *   node image-manager.js list - List all plants with missing or placeholder images
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, collection, getDocs, query } = require('firebase/firestore');
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

// Define paths
const PUBLIC_IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'plants');

// Function to normalize plant names
function normalizePlantName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .trim();                   // Trim whitespace
}

// Function to download an image
async function downloadImage(url, plantId) {
  try {
    console.log(`Downloading image from ${url} for ${plantId}...`);
    
    // Create directory for the plant if it doesn't exist
    const plantDir = path.join(PUBLIC_IMAGES_DIR, plantId);
    
    if (!fs.existsSync(plantDir)) {
      fs.mkdirSync(plantDir, { recursive: true });
      console.log(`Created directory: ${plantDir}`);
    }
    
    // Generate a filename
    const filename = `${plantId}-${Date.now()}.jpg`;
    const filePath = path.join(plantDir, filename);
    const webPath = `/images/plants/${plantId}/${filename}`;
    
    // Download the image
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    
    // Save the image to file
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Downloaded image saved to ${filePath}`);
        resolve(webPath);
      });
      writer.on('error', err => {
        console.error(`Error writing image:`, err);
        reject(err);
      });
    });
  } catch (err) {
    console.error(`❌ Error downloading image:`, err.message);
    throw err;
  }
}

// Function to update an image for a plant
async function updatePlantImage(plantId, imageUrl) {
  try {
    console.log(`Updating image for plant: ${plantId}`);
    
    // Download the image
    const imagePath = await downloadImage(imageUrl, plantId);
    
    // Update the document in Firestore
    const plantRef = doc(db, 'products', plantId);
    await updateDoc(plantRef, { image: imagePath });
    
    console.log(`✅ Successfully updated image for ${plantId}!`);
    return imagePath;
  } catch (error) {
    console.error(`❌ Error updating plant image:`, error);
    throw error;
  }
}

// Function to list plants with missing or placeholder images
async function listPlantsWithPlaceholderImages() {
  try {
    console.log('Checking for plants with missing or placeholder images...');
    
    const q = query(collection(db, 'products'));
    const querySnapshot = await getDocs(q);
    
    const plantsWithPlaceholders = [];
    
    querySnapshot.forEach((doc) => {
      const plant = doc.data();
      // Check if image is missing or is a placeholder
      if (!plant.image || plant.image.includes('placehold.co')) {
        plantsWithPlaceholders.push({
          id: doc.id,
          name: plant.name,
          latinName: plant.latinName || 'Unknown',
          currentImage: plant.image || 'None'
        });
      }
    });
    
    if (plantsWithPlaceholders.length === 0) {
      console.log('✅ All plants have proper images!');
    } else {
      console.log(`Found ${plantsWithPlaceholders.length} plants with missing or placeholder images:\n`);
      
      plantsWithPlaceholders.forEach((plant, index) => {
        console.log(`${index + 1}. ${plant.name} (${plant.latinName})`);
        console.log(`   ID: ${plant.id}`);
        console.log(`   Current image: ${plant.currentImage}`);
        console.log(`   To update: node image-manager.js update ${plant.id} <new-image-url>\n`);
      });
    }
    
    return plantsWithPlaceholders.length;
  } catch (error) {
    console.error('❌ Error listing plants with placeholder images:', error);
    throw error;
  }
}

// Main function to handle commands
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log(`
Usage:
  node image-manager.js update <plantId> <imageUrl> - Update image for a specific plant
  node image-manager.js list - List all plants with missing or placeholder images
    `);
    return;
  }
  
  try {
    switch (command) {
      case 'update':
        const plantId = args[1];
        const imageUrl = args[2];
        
        if (!plantId || !imageUrl) {
          console.error('❌ Error: Both plantId and imageUrl are required.');
          console.log('Usage: node image-manager.js update <plantId> <imageUrl>');
          return;
        }
        
        await updatePlantImage(plantId, imageUrl);
        break;
        
      case 'list':
        await listPlantsWithPlaceholderImages();
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log(`
Usage:
  node image-manager.js update <plantId> <imageUrl> - Update image for a specific plant
  node image-manager.js list - List all plants with missing or placeholder images
        `);
    }
  } catch (error) {
    console.error('❌ An error occurred:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().then(() => {
    console.log('Done!');
    process.exit(0);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
} else {
  module.exports = {
    updatePlantImage,
    listPlantsWithPlaceholderImages
  };
} 