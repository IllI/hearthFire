import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { getAuth } from "firebase-admin/auth";
import admin, { initAdmin } from '../../lib/firebase-admin';

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  
  console.log('Basic fallback upload handler called - no Sharp dependency');
  
  try {
    // Initialize Firebase Admin if not already initialized
    try {
      await initAdmin();
      console.log('Firebase Admin SDK initialized successfully for fallback-upload-basic endpoint');
    } catch (adminInitError) {
      console.error('Error initializing Firebase Admin SDK:', adminInitError);
      // Continue - we may not need admin for basic uploads
    }
    
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No valid authorization header' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    // Log token type (don't log the actual token)
    console.log('Token type:', typeof token, 'length:', token.length);
    
    try {
      // In development mode, accept dev-token for testing
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment && (token === 'dev-token' || token.includes('admin'))) {
        console.log('Using development admin token override');
      } else {
        try {
          // Get auth instance
          const auth = getAuth();
          const decodedToken = await auth.verifyIdToken(token);
          console.log('Token verified successfully, user:', decodedToken.uid);
        } catch (authError) {
          console.error('Failed to verify token:', authError);
          return res.status(401).json({ error: 'Unauthorized - Invalid token' });
        }
      }
    } catch (authError) {
      console.error('Auth verification error:', authError);
      return res.status(401).json({ error: 'Unauthorized - Auth verification failed' });
    }
    
    // Ensure 'public/uploads' directory exists
    try {
      const baseUploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(baseUploadsDir, { recursive: true });
      console.log('Upload directory verified:', baseUploadsDir);
    } catch (dirError) {
      console.error('Error ensuring uploads directory exists:', dirError);
      // Continue - we'll check specific dirs later too
    }
    
    // Parse form with formidable
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
      maxTotalFileSize: 50 * 1024 * 1024, // 50MB total limit for all files
    });
    
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Form parsing error:', err);
          reject(err);
        } else {
          resolve([fields, files]);
        }
      });
    });
    
    console.log("Form data parsed successfully:", { 
      fields: Object.keys(fields), 
      files: Object.keys(files),
      fileEntries: files.file ? Array.isArray(files.file) ? files.file.length : 'not an array' : 'no file key'
    });
    
    // Get storage path from fields or use default
    const storagePath = fields.path ? fields.path[0] : 'general';
    
    // In formidable v3+, the files structure has changed
    // Check if we have a file entry and handle both formats
    let file;
    if (files.file) {
      // New format (formidable v3+)
      if (Array.isArray(files.file)) {
        file = files.file[0];
      } else {
        // Legacy format
        file = files.file;
      }
    }
    
    if (!file) {
      console.error('No file found in request:', JSON.stringify(Object.keys(files)));
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Log file info for debugging
    console.log('File upload attempt:', {
      originalFilename: file.originalFilename || file.originalname || file.name,
      mimetype: file.mimetype || file.mime || file.type,
      size: file.size,
      filepath: file.filepath || file.path,
      storagePath
    });
    
    // Extract file properties safely
    const originalFilename = file.originalFilename || file.originalname || file.name || 'unknown.jpg';
    const mimetype = file.mimetype || file.mime || file.type;
    const filepath = file.filepath || file.path;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    let fileType = mimetype;
    
    if (!allowedTypes.includes(mimetype)) {
      console.log('File type validation failed:', {
        providedType: mimetype, 
        allowedTypes,
        filename: originalFilename
      });
      
      // Check file extension as fallback
      const fileExt = originalFilename.split('.').pop().toLowerCase();
      const extMap = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif'
      };
      
      if (extMap[fileExt] && allowedTypes.includes(extMap[fileExt])) {
        console.log('Using file extension instead of MIME type');
        // Continue with the upload, overriding the MIME type
        fileType = extMap[fileExt];
      } else {
        return res.status(400).json({ 
          error: 'Invalid file type. Only JPG, PNG, WEBP, and GIF images are allowed.' 
        });
      }
    }
    
    // Generate a unique filename
    const timestamp = Date.now();
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${cleanFilename}`;
    
    // Ensure directories exist
    const baseUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const uploadsDir = path.join(baseUploadsDir, storagePath);
    
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      console.log('Created upload directory:', uploadsDir);
    } catch (mkdirError) {
      console.error('Error creating directories:', mkdirError);
      return res.status(500).json({ error: 'Failed to create upload directories' });
    }
    
    // Set destination path
    const destPath = path.join(uploadsDir, filename);
    
    // Read file from the temporary location
    let fileContent;
    try {
      fileContent = await fs.readFile(filepath);
      console.log(`Read file successfully, size: ${fileContent.length} bytes`);
    } catch (readError) {
      console.error('Error reading uploaded file:', readError);
      return res.status(500).json({ error: 'Failed to read uploaded file' });
    }
    
    // Write the file directly without processing
    try {
      await fs.writeFile(destPath, fileContent);
      console.log('File written successfully');
      
      const url = `/uploads/${storagePath}/${filename}`;
      
      console.log('File uploaded successfully:', {
        url,
        size: fileContent.length
      });
      
      // Return the public URL
      return res.status(200).json({ 
        url,
        size: fileContent.length
      });
    } catch (writeError) {
      console.error('Error writing file:', writeError);
      return res.status(500).json({ error: 'Failed to save uploaded file' });
    }
  } catch (error) {
    console.error('Uncaught error handling file upload:', error);
    return res.status(500).json({ error: 'Failed to upload file - server error' });
  }
} 