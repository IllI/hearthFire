// Example Firebase Storage Image Upload Script
const { initializeApp } = require('firebase/app');
const { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} = require('firebase/storage');
const fs = require('fs');
const path = require('path');
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

// Log config for debugging before initializing Firebase
console.log('Firebase Config:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Set' : '✗ Missing',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Missing',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✓ Set' : '✗ Missing',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✓ Set' : '✗ Missing',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✓ Set' : '✗ Missing',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ? '✓ Set' : '✗ Missing'
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

/**
 * Uploads an image to Firebase Storage
 * @param {string} imagePath - Local path to the image file
 * @param {string} storagePath - Path in Firebase Storage (e.g., 'plants/echinacea.jpg')
 * @returns {Promise<string>} - The download URL for the uploaded image
 */
async function uploadImageToStorage(imagePath, storagePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.error(`File not found: ${imagePath}`);
      return null;
    }
    
    // Read file
    const fileBuffer = fs.readFileSync(imagePath);
    
    // Create storage reference
    const storageRef = ref(storage, storagePath);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, fileBuffer);
    console.log(`Uploaded ${imagePath} to ${storagePath}`);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}

/**
 * Scans a directory for images and uploads them to Firebase Storage
 * @param {string} sourceDir - Directory to scan for images
 * @param {string} targetStorageDir - Target directory in Firebase Storage
 */
async function uploadImagesFromDirectory(sourceDir, targetStorageDir) {
  try {
    if (!fs.existsSync(sourceDir)) {
      console.error(`Source directory not found: ${sourceDir}`);
      return;
    }
    
    const files = fs.readdirSync(sourceDir);
    
    for (const file of files) {
      const filePath = path.join(sourceDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        // Recursively process subdirectories
        const subDirName = path.basename(filePath);
        await uploadImagesFromDirectory(
          filePath, 
          path.join(targetStorageDir, subDirName)
        );
      } else if (stats.isFile() && isImageFile(file)) {
        // Upload image files
        const storagePath = path.join(targetStorageDir, file);
        const downloadURL = await uploadImageToStorage(filePath, storagePath);
        
        if (downloadURL) {
          console.log(`File uploaded. Download URL: ${downloadURL}`);
        }
      }
    }
  } catch (error) {
    console.error('Error processing directory:', error);
  }
}

/**
 * Checks if a file is an image based on its extension
 * @param {string} filename - Filename to check
 * @returns {boolean} - True if the file is an image
 */
function isImageFile(filename) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(filename).toLowerCase();
  return imageExtensions.includes(ext);
}

// Example usage:
async function main() {
  const plantsDir = path.join(__dirname, 'plant pages');
  const imagesDir = path.join(plantsDir, 'images');
  
  console.log('Starting image upload process...');
  
  // Upload from the images directory if it exists
  if (fs.existsSync(imagesDir)) {
    await uploadImagesFromDirectory(imagesDir, 'plants/images');
  }
  
  // Process each plant directory
  const entries = fs.readdirSync(plantsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'images') {
      const plantDirPath = path.join(plantsDir, entry.name);
      const plantImagesDir = path.join(plantDirPath, 'images');
      
      if (fs.existsSync(plantImagesDir)) {
        console.log(`Processing images for ${entry.name}...`);
        await uploadImagesFromDirectory(plantImagesDir, `plants/${entry.name}/images`);
      }
    }
  }
  
  console.log('Image upload process completed.');
}

// Run the main function
main();

/*
 * TO USE THIS SCRIPT:
 * 
 * 1. Make sure your Firebase Storage is set up
 * 2. Update the .env.local file with your Firebase credentials
 * 3. Run this script: node image-upload-example.js
 * 4. Modify seed-plants.js to get image URLs from Firebase Storage
 */ 