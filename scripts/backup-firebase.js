const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`
        });
        console.log('Firebase Admin initialized with service account credentials');
      } catch (parseError) {
        console.error('Error parsing service account key:', parseError);
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms',
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'hearthfire-farms.appspot.com'
        });
      }
    } else {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'hearthfire-farms.appspot.com'
      });
      console.log('Firebase Admin initialized with application default credentials');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Known collections to backup (add more if needed)
const COLLECTIONS_TO_BACKUP = [
  'products',
  'orders',
  'users',
  'customers',
  'content',
  'deliverySchedules',
  'promotions',
  'categories'
];

// Helper to download a file via HTTP/HTTPS
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Handle redirects
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status code ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', `backup_${timestamp}`);
  const dbDir = path.join(backupDir, 'db');
  const storageDir = path.join(backupDir, 'storage');
  const externalAssetsDir = path.join(backupDir, 'external_assets');

  // Create directories
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(storageDir, { recursive: true });
  fs.mkdirSync(externalAssetsDir, { recursive: true });

  console.log(`\nStarting backup to: ${backupDir}\n`);

  // --- 1. BACKUP DATABASE (FIRESTORE) ---
  console.log('--- Backing up Firestore Database ---');
  const allProducts = [];

  for (const collectionName of COLLECTIONS_TO_BACKUP) {
    console.log(`Backing up collection: ${collectionName}...`);
    try {
      const snapshot = await db.collection(collectionName).get();
      const data = {};
      
      snapshot.forEach(doc => {
        data[doc.id] = doc.data();
        
        // Save products for external asset processing later
        if (collectionName === 'products') {
          allProducts.push({ id: doc.id, ...doc.data() });
        }
      });

      const filePath = path.join(dbDir, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✅ Saved ${snapshot.size} documents to ${collectionName}.json`);
    } catch (error) {
      console.error(`❌ Error backing up collection ${collectionName}:`, error.message);
    }
  }

  // --- 2. BACKUP FIREBASE STORAGE ---
  console.log('\n--- Backing up Firebase Storage ---');
  try {
    const [files] = await bucket.getFiles();
    console.log(`Found ${files.length} files in Firebase Storage.`);

    for (const file of files) {
      const filePath = file.name;
      const destPath = path.join(storageDir, filePath);
      
      // Ensure directory exists for nested files
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      
      try {
        await file.download({ destination: destPath });
        console.log(`✅ Downloaded: ${filePath}`);
      } catch (err) {
        console.error(`❌ Failed to download ${filePath}:`, err.message);
      }
    }
  } catch (error) {
    console.error('❌ Error accessing Firebase Storage:', error.message);
  }

  // --- 3. BACKUP EXTERNAL ASSETS (ImgBB etc. from Products) ---
  console.log('\n--- Backing up External Product Images ---');
  let downloadedCount = 0;
  for (const product of allProducts) {
    const imageUrls = [];
    if (product.image) imageUrls.push(product.image);
    if (Array.isArray(product.images)) {
      product.images.forEach(img => {
        if (!imageUrls.includes(img)) imageUrls.push(img);
      });
    }

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      // Skip relative/local paths or firebase storage urls (we already backed up storage)
      if (url.startsWith('http') && !url.includes('firebasestorage.googleapis.com')) {
        const safeProductName = product.name ? product.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'unknown';
        const fileExt = url.split('.').pop().split('?')[0] || 'jpg';
        // handle urls without proper extensions like unspash
        const extension = fileExt.length > 4 ? 'jpg' : fileExt; 
        const fileName = `${product.id}_${safeProductName}_${i}.${extension}`;
        const destPath = path.join(externalAssetsDir, fileName);

        try {
          await downloadFile(url, destPath);
          console.log(`✅ Downloaded external image for ${product.name}: ${url}`);
          downloadedCount++;
        } catch (err) {
          console.error(`❌ Failed to download external image ${url}:`, err.message);
        }
      }
    }
  }
  console.log(`✅ Downloaded ${downloadedCount} external images.`);

  console.log(`\n🎉 Backup complete! Files saved to: ${backupDir}`);
  process.exit(0);
}

backup().catch(error => {
  console.error('Backup failed:', error);
  process.exit(1);
});
