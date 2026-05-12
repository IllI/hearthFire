/**
 * Initialize Firebase Storage with sample content for testing
 * 
 * This script sets up the folder structure and uploads sample images
 * Run with: node scripts/initialize-storage.js
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Initialize Firebase Admin
let serviceAccount;
try {
  // Try to load service account from environment variable first
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('Loaded service account from environment variable');
  } 
  // Fallback to file if it exists
  else if (fs.existsSync('./serviceAccountKey.json')) {
    serviceAccount = require('../serviceAccountKey.json');
    console.log('Loaded service account from serviceAccountKey.json');
  } else {
    console.error('No service account found. Please set FIREBASE_SERVICE_ACCOUNT_KEY or create serviceAccountKey.json');
    process.exit(1);
  }
} catch (error) {
  console.error('Failed to load service account:', error);
  process.exit(1);
}

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
if (!bucket) {
  console.error('Failed to get storage bucket. Check your bucket name in .env.local');
  process.exit(1);
}

console.log(`Using storage bucket: ${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`);

// Sample images to upload
const sampleImages = [
  {
    url: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg',
    name: 'farm-field.jpg',
    folder: 'general'
  },
  {
    url: 'https://images.pexels.com/photos/2255935/pexels-photo-2255935.jpeg',
    name: 'vegetables.jpg',
    folder: 'general'
  },
  {
    url: 'https://images.pexels.com/photos/2286776/pexels-photo-2286776.jpeg',
    name: 'farm-produce.jpg',
    folder: 'products'
  },
  {
    url: 'https://images.pexels.com/photos/3629537/pexels-photo-3629537.jpeg',
    name: 'tractor.jpg',
    folder: 'banners'
  },
  {
    url: 'https://images.pexels.com/photos/1153369/pexels-photo-1153369.jpeg',
    name: 'harvest.jpg',
    folder: 'content'
  }
];

// Folders to create
const foldersToCreate = ['general', 'products', 'banners', 'content', 'uploads'];

// Function to download an image
async function downloadImage(url, outputPath) {
  console.log(`Downloading image from ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  
  const buffer = await response.buffer();
  fs.writeFileSync(outputPath, buffer);
  
  return {
    path: outputPath,
    size: buffer.length
  };
}

// Function to create folder structure
async function createFolderStructure() {
  console.log('Creating folder structure...');
  
  for (const folder of foldersToCreate) {
    try {
      const placeholderPath = `${folder}/.placeholder`;
      
      // Check if folder already exists
      const [exists] = await bucket.file(placeholderPath).exists();
      if (exists) {
        console.log(`Folder ${folder} already exists, skipping`);
        continue;
      }
      
      // Create placeholder file to ensure folder exists
      const file = bucket.file(placeholderPath);
      await file.save('This is a placeholder file to create folder structure.', {
        contentType: 'text/plain'
      });
      
      console.log(`Created folder: ${folder}`);
    } catch (error) {
      console.error(`Error creating folder ${folder}:`, error);
    }
  }
}

// Function to upload sample images
async function uploadSampleImages() {
  console.log('Uploading sample images...');
  
  // Create temporary directory for downloads
  const tempDir = path.join(os.tmpdir(), 'hearthfire-storage-init');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  for (const image of sampleImages) {
    try {
      const destinationPath = `${image.folder}/${image.name}`;
      console.log(`Processing ${destinationPath}`);
      
      // Check if image already exists
      const [exists] = await bucket.file(destinationPath).exists();
      if (exists) {
        console.log(`File ${destinationPath} already exists, skipping`);
        continue;
      }
      
      // Download image to temp directory
      const localPath = path.join(tempDir, image.name);
      const downloadResult = await downloadImage(image.url, localPath);
      console.log(`Downloaded ${image.name}: ${downloadResult.size} bytes`);
      
      // Upload to Firebase Storage
      await bucket.upload(localPath, {
        destination: destinationPath,
        metadata: {
          contentType: `image/${path.extname(image.name).substring(1)}`
        }
      });
      
      console.log(`Uploaded ${image.name} to ${destinationPath}`);
      
      // Clean up temp file
      fs.unlinkSync(localPath);
    } catch (error) {
      console.error(`Error uploading ${image.name}:`, error);
    }
  }
}

// Main function
async function main() {
  try {
    console.log('Initializing Firebase Storage...');
    
    await createFolderStructure();
    await uploadSampleImages();
    
    console.log('Firebase Storage initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('Storage initialization failed:', error);
    process.exit(1);
  }
}

// Run the script
main(); 