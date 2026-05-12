import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Try to import Firebase Admin
let admin;
let bucket;
try {
  admin = require('../../lib/firebase-admin').admin;
  bucket = admin.storage().bucket();
} catch (error) {
  console.warn('[Storage Upload] Error initializing Firebase Admin:', error.message);
}

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[Storage Upload] Processing upload request');
    
    // Parse multipart form data
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('[Storage Upload] Form parsing error:', err);
          reject(err);
          return;
        }
        resolve([fields, files]);
      });
    });

    console.log('[Storage Upload] Form parsed successfully');

    // Get the uploaded file
    const file = files.file;
    if (!file) {
      console.error('[Storage Upload] No file found in request');
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate file (optional: you can add more validation here)
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    console.log(`[Storage Proxy] Processing file: ${file.originalFilename} (${file.size} bytes, ${file.mimetype})`);

    // Generate a unique filename
    const timestamp = Date.now();
    const uniqueId = uuidv4().slice(0, 8);
    const safeFilename = file.originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${uniqueId}_${safeFilename}`;
    
    // Destination folder in Firebase Storage
    const folder = fields.folder || 'products';
    const destination = `${folder}/${filename}`;

    // Read file from temp location
    const fileBuffer = fs.readFileSync(file.filepath);

    // Check if Firebase Admin is properly initialized
    if (!admin || !bucket) {
      console.error('[Storage Proxy] Firebase Storage bucket not available, using local fallback');
      
      // Fallback to saving in local uploads directory
      const publicDir = path.join(process.cwd(), 'public', 'uploads', folder);
      
      // Ensure directory exists
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      const localFilePath = path.join(publicDir, filename);
      fs.writeFileSync(localFilePath, fileBuffer);
      
      const localUrl = `/uploads/${folder}/${filename}`;
      console.log(`[Storage Proxy] Fallback: Saved to local path: ${localUrl}`);
      
      return res.status(200).json({
        url: localUrl,
        filename: filename,
        originalName: file.originalFilename,
        fileSize: file.size,
        mimeType: file.mimetype,
        storage: 'local'
      });
    }

    // Upload to Firebase Storage
    const fileUpload = bucket.file(destination);
    
    // Upload with appropriate metadata
    await fileUpload.save(fileBuffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    // Make the file publicly accessible
    await fileUpload.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;

    console.log(`[Storage Proxy] Successfully uploaded: ${publicUrl}`);

    // Return success response with the image URL
    return res.status(200).json({
      url: publicUrl,
      filename: filename,
      originalName: file.originalFilename,
      fileSize: file.size,
      mimeType: file.mimetype,
      storage: 'firebase'
    });
  } catch (error) {
    console.error('[Storage Proxy] Error uploading file:', error);
    return res.status(500).json({ error: `Error uploading file: ${error.message}` });
  }
} 