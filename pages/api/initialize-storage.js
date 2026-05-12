/**
 * API endpoint to initialize Firebase Storage with sample content
 * This is only for development/testing purposes
 */
import admin from 'firebase-admin';
import { getApp } from 'firebase-admin/app';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Initialize Firebase Admin if not already initialized
let firebaseApp;
try {
  firebaseApp = getApp();
} catch (error) {
  // Try to load service account
  try {
    // Get service account credentials from environment variables
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : null;
    
    if (serviceAccount) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized for storage initialization');
    } else {
      console.warn('No service account credentials available for Firebase Admin in storage init');
    }
  } catch (initError) {
    console.error('Failed to initialize Firebase Admin in storage init:', initError);
  }
}

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
  }
];

// Function to download an image
async function downloadImage(url, outputPath) {
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

export default async function handler(req, res) {
  // Only allow POST requests with an authorization key
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  
  // Simple authorization - this prevents accidental initialization
  const { authKey } = req.body;
  if (authKey !== process.env.NEXT_PUBLIC_ADMIN_CODE && authKey !== 'admin123') {
    return res.status(401).json({ error: 'Unauthorized - Invalid auth key' });
  }
  
  try {
    // Make sure we have Firebase Admin initialized
    if (!firebaseApp) {
      return res.status(500).json({ 
        error: 'Firebase Admin not initialized',
        message: 'Unable to initialize Firebase Admin SDK. Check your service account credentials.'
      });
    }
    
    // Get a reference to the storage bucket
    const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    if (!bucket) {
      return res.status(500).json({ 
        error: 'Storage bucket not available',
        message: 'Unable to access Firebase Storage bucket. Check your bucket name.'
      });
    }
    
    console.log('Initializing Firebase Storage with sample content...');
    
    // Create a temporary directory for downloads
    const tempDir = path.join(os.tmpdir(), 'hearthfire-storage-init');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Track the uploads for the response
    const uploadResults = [];
    
    // Process each sample image
    for (const image of sampleImages) {
      try {
        console.log(`Processing image: ${image.name} in folder: ${image.folder}`);
        
        // Create the destination path
        const destinationPath = `${image.folder}/${image.name}`;
        
        // Check if the file already exists
        try {
          const [exists] = await bucket.file(destinationPath).exists();
          if (exists) {
            console.log(`File ${destinationPath} already exists, skipping`);
            uploadResults.push({
              name: image.name,
              folder: image.folder,
              result: 'skipped',
              message: 'File already exists'
            });
            continue;
          }
        } catch (existsError) {
          console.warn(`Error checking if file exists: ${existsError.message}`);
          // Continue with upload attempt
        }
        
        // Download the image to temp directory
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
        
        // Clean up the temp file
        fs.unlinkSync(localPath);
        
        // Add to results
        uploadResults.push({
          name: image.name,
          folder: image.folder,
          result: 'success',
          path: destinationPath
        });
        
      } catch (imageError) {
        console.error(`Error processing image ${image.name}:`, imageError);
        uploadResults.push({
          name: image.name,
          folder: image.folder,
          result: 'error',
          message: imageError.message
        });
      }
    }
    
    // Create empty placeholder files for folder structure if needed
    const folders = ['content', 'uploads', 'banners'].filter(
      folder => !sampleImages.some(img => img.folder === folder)
    );
    
    for (const folder of folders) {
      try {
        // Create a placeholder file to ensure the folder exists
        const placeholderPath = `${folder}/.placeholder`;
        
        // Check if the placeholder already exists
        try {
          const [exists] = await bucket.file(placeholderPath).exists();
          if (exists) {
            console.log(`Folder ${folder} already exists`);
            continue;
          }
        } catch (existsError) {
          console.warn(`Error checking if folder exists: ${existsError.message}`);
          // Continue with creation attempt
        }
        
        // Create an empty file
        const placeholderFile = bucket.file(placeholderPath);
        await placeholderFile.save('This is a placeholder file to create folder structure.', {
          contentType: 'text/plain'
        });
        
        console.log(`Created folder structure for: ${folder}`);
        
        uploadResults.push({
          folder,
          result: 'success',
          message: 'Created folder structure'
        });
        
      } catch (folderError) {
        console.error(`Error creating folder ${folder}:`, folderError);
        uploadResults.push({
          folder,
          result: 'error',
          message: folderError.message
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Firebase Storage initialized with sample content',
      results: uploadResults
    });
    
  } catch (error) {
    console.error('Error initializing Firebase Storage:', error);
    return res.status(500).json({
      error: 'Initialization failed',
      message: error.message
    });
  }
} 