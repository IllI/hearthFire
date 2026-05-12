/**
 * Server-side proxy for Firebase Storage
 * This allows bypassing CORS restrictions during local development
 */
import https from 'https';
import admin from 'firebase-admin';
import { getApp } from 'firebase-admin/app';
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
      console.log('Firebase Admin initialized for storage proxy');
    } else {
      console.warn('No service account credentials available for Firebase Admin in storage proxy');
    }
  } catch (initError) {
    console.error('Failed to initialize Firebase Admin in storage proxy:', initError);
  }
}

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { path = '', action = 'list' } = req.query;
    console.log(`Storage proxy: ${action} request for path "${path}"`);
    
    // Fallback for local development - use mock data if we can't access Firebase
    if (!firebaseApp) {
      return handleMockData(req, res, path, action);
    }
    
    // Get a reference to the storage bucket
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'hearthfire-farms.appspot.com';
    
    try {
      // If we're not using Firebase Admin directly, attempt to create a bucket
      const bucket = admin.storage().bucket(bucketName);
      console.log(`Using storage bucket: ${bucketName}`);
      
      if (action === 'list') {
        // For listing files and folders
        try {
          // Get all files that match the prefix
          const [files] = await bucket.getFiles({ 
            prefix: path,
            delimiter: '/' // Use delimiter to simulate directory structure
          });
          
          // Extract folder names from prefixes
          const [filesWithPrefix] = await bucket.getFiles({ 
            prefix: path,
            delimiter: '/',
            autoPaginate: false
          });
          
          // Store the unique folder prefixes
          const prefixes = new Set();
          
          if (filesWithPrefix && filesWithPrefix[0] && filesWithPrefix[0].metadata) {
            // Extract prefixes from the API response
            const apiResponse = filesWithPrefix[0].metadata.apiResponse;
            if (apiResponse && apiResponse.prefixes) {
              apiResponse.prefixes.forEach(prefix => prefixes.add(prefix));
            }
          }
          
          // Create response in the same format expected by the client
          const response = {
            items: files.filter(file => {
              // Filter out "directory placeholder" files and files in subdirectories
              const name = file.name;
              // Only include files directly in this "directory"
              return !name.endsWith('/') && path ? 
                (name.startsWith(path) && name.split('/').length === path.split('/').length + 1) : 
                !name.includes('/');
            }).map(file => ({
              name: file.name,
              fullPath: file.name,
              contentType: file.metadata.contentType,
              size: parseInt(file.metadata.size),
              updated: file.metadata.updated
            })),
            prefixes: Array.from(prefixes)
          };
          
          console.log(`Found ${response.items.length} files and ${response.prefixes.length} folders`);
          return res.status(200).json(response);
          
        } catch (listError) {
          console.error('Error listing files with Firebase Admin:', listError);
          
          // Fall back to mock data for development
          return handleMockData(req, res, path, action);
        }
        
      } else if (action === 'download') {
        // For downloading a file
        if (!path) {
          return res.status(400).json({ error: 'Path parameter is required for download action' });
        }
        
        try {
          const file = bucket.file(path);
          const [exists] = await file.exists();
          
          if (!exists) {
            return res.status(404).json({ error: 'File not found' });
          }
          
          const [metadata] = await file.getMetadata();
          
          // Set appropriate content type
          if (metadata.contentType) {
            res.setHeader('Content-Type', metadata.contentType);
          } else {
            // Try to guess from the file extension
            if (path.match(/\.(jpg|jpeg)$/i)) {
              res.setHeader('Content-Type', 'image/jpeg');
            } else if (path.match(/\.png$/i)) {
              res.setHeader('Content-Type', 'image/png');
            } else if (path.match(/\.gif$/i)) {
              res.setHeader('Content-Type', 'image/gif');
            } else if (path.match(/\.webp$/i)) {
              res.setHeader('Content-Type', 'image/webp');
            } else if (path.match(/\.svg$/i)) {
              res.setHeader('Content-Type', 'image/svg+xml');
            } else {
              res.setHeader('Content-Type', 'application/octet-stream');
            }
          }
          
          // Set cache headers
          res.setHeader('Cache-Control', 'public, max-age=3600');
          
          // Create a read stream and pipe it to the response
          const readStream = file.createReadStream();
          readStream.on('error', (err) => {
            console.error('Error streaming file:', err);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Error streaming file', message: err.message });
            }
          });
          
          // Pipe the file to the response
          readStream.pipe(res);
          
          return; // Important: do not return a response as we're piping the stream
          
        } catch (downloadError) {
          console.error('Error downloading file with Firebase Admin:', downloadError);
          
          // Fall back to mock data for development
          return handleMockData(req, res, path, action);
        }
      } else {
        return res.status(400).json({ error: 'Invalid action parameter' });
      }
      
    } catch (bucketError) {
      console.error('Error accessing Firebase Storage bucket:', bucketError);
      
      // Fall back to mock data for development
      return handleMockData(req, res, path, action);
    }
    
  } catch (error) {
    console.error('Storage proxy error:', error);
    return res.status(500).json({ 
      error: 'Storage proxy error', 
      message: error.message
    });
  }
}

// Helper function to handle mock data for local development
function handleMockData(req, res, filePath, action) {
  console.log(`Using mock data for ${action} action with path: ${filePath}`);
  
  // Define mock folder structure
  const mockFolders = ['general', 'products', 'banners', 'content', 'uploads'];
  
  // Define mock files for each folder
  const mockFiles = {
    'general': [
      { name: 'general/farm-field.jpg', contentType: 'image/jpeg', size: 123456 },
      { name: 'general/vegetables.jpg', contentType: 'image/jpeg', size: 234567 }
    ],
    'products': [
      { name: 'products/farm-produce.jpg', contentType: 'image/jpeg', size: 345678 }
    ],
    'banners': [
      { name: 'banners/tractor.jpg', contentType: 'image/jpeg', size: 456789 }
    ],
    'content': [
      { name: 'content/harvest.jpg', contentType: 'image/jpeg', size: 567890 }
    ],
    'uploads': []
  };
  
  if (action === 'list') {
    // Handle mock directory listing
    let response = { items: [], prefixes: [] };
    
    if (!filePath || filePath === '') {
      // Root level - return all top-level folders
      response.prefixes = mockFolders.map(folder => `${folder}/`);
    } else {
      // Inside a folder - check if it exists in our mock structure
      const folderName = filePath.replace(/\/$/, ''); // Remove trailing slash if any
      
      if (mockFiles[folderName]) {
        response.items = mockFiles[folderName];
      }
      
      // If inside a folder, don't add subfolder prefixes in this simple mock
    }
    
    return res.status(200).json(response);
    
  } else if (action === 'download') {
    // For 'download' action, serve a placeholder image 
    // Use a built-in placeholder or serve a local file as fallback
    
    // Set default content type to image/jpeg
    res.setHeader('Content-Type', 'image/jpeg');
    
    // Path to sample images in the public directory
    const publicImagePath = path.join(process.cwd(), 'public', 'images', 'placeholder.jpg');
    
    // Check if we have a placeholder image in the public folder
    if (fs.existsSync(publicImagePath)) {
      const fileStream = fs.createReadStream(publicImagePath);
      return fileStream.pipe(res);
    }
    
    // If no placeholder is available, create a tiny placeholder image
    // Just a 1x1 pixel transparent GIF
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    return res.send(transparentGif);
  }
  
  // Default error for unsupported actions
  return res.status(400).json({ error: 'Unsupported action in mock mode' });
} 