const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: 'hearthfire-farms.appspot.com'
        });
        console.log('Firebase Admin initialized with service account credentials');
      } catch (parseError) {
        console.error('Error parsing service account key:', parseError);
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms',
          storageBucket: 'hearthfire-farms.appspot.com'
        });
        console.log('Firebase Admin initialized with application default credentials');
      }
    } else {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms',
        storageBucket: 'hearthfire-farms.appspot.com'
      });
      console.log('Firebase Admin initialized with application default credentials');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const bucket = admin.storage().bucket();

// Default fallback images for each category
const fallbackImages = [
  {
    category: 'native-plants',
    sourceUrl: 'https://images.unsplash.com/photo-1636911376272-84f5187edb07?q=80&w=800',
    filename: 'fallbacks/native-plants.jpg'
  },
  {
    category: 'medicinal-herbs',
    sourceUrl: 'https://images.unsplash.com/photo-1512990414784-277c4fc761c7?q=80&w=800',
    filename: 'fallbacks/medicinal-herbs.jpg'
  },
  {
    category: 'pollinator-friendly',
    sourceUrl: 'https://images.unsplash.com/photo-1583651191307-419e163a902c?q=80&w=800',
    filename: 'fallbacks/pollinator-friendly.jpg'
  },
  {
    category: 'culinary-herbs',
    sourceUrl: 'https://images.unsplash.com/photo-1599934498110-e9b23f422688?q=80&w=800',
    filename: 'fallbacks/culinary-herbs.jpg'
  }
];

// Create a temp folder if it doesn't exist
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Function to download an image and upload it to Firebase Storage
async function downloadAndUploadImage(imageInfo) {
  try {
    console.log(`Processing ${imageInfo.category} fallback image...`);
    
    // Download the image
    const localPath = path.join(tempDir, path.basename(imageInfo.filename));
    const response = await axios({
      method: 'get',
      url: imageInfo.sourceUrl,
      responseType: 'stream'
    });
    
    // Save to local temp file
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    
    // Wait for download to complete
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    console.log(`Downloaded image to ${localPath}`);
    
    // Upload to Firebase Storage
    await bucket.upload(localPath, {
      destination: imageInfo.filename,
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000'
      }
    });
    
    // Make file publicly accessible
    await bucket.file(imageInfo.filename).makePublic();
    
    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${imageInfo.filename}`;
    console.log(`✅ Uploaded ${imageInfo.category} fallback image to ${publicUrl}`);
    
    // Clean up temp file
    fs.unlinkSync(localPath);
    
    return publicUrl;
  } catch (error) {
    console.error(`Error processing ${imageInfo.category} fallback:`, error.message);
    return null;
  }
}

// Upload all fallback images
async function uploadAllFallbacks() {
  console.log('Starting fallback image upload...');
  
  const results = [];
  for (const imageInfo of fallbackImages) {
    const url = await downloadAndUploadImage(imageInfo);
    if (url) {
      results.push({
        category: imageInfo.category,
        url,
        filename: imageInfo.filename
      });
    }
  }
  
  console.log('\nUpload Summary:');
  results.forEach(result => {
    console.log(`- ${result.category}: ${result.url}`);
  });
  
  console.log('\nAdd these URLs to your script:');
  console.log('const categoryFallbackImages = {');
  results.forEach(result => {
    console.log(`  '${result.category}': 'https://firebasestorage.googleapis.com/v0/b/hearthfire-farms.appspot.com/o/${encodeURIComponent(result.filename)}?alt=media',`);
  });
  console.log('};');
}

// Run the upload
uploadAllFallbacks()
  .then(() => {
    console.log('✅ All fallback images uploaded successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error uploading fallback images:', error);
    process.exit(1);
  }); 