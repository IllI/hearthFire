import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { getAuth } from "firebase-admin/auth";
import sharp from 'sharp'; // For image optimization
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
  
  try {
    // Initialize Firebase Admin if not already initialized
    try {
      await initAdmin();
      console.log('Firebase Admin SDK initialized successfully for fallback-upload endpoint');
    } catch (adminInitError) {
      console.error('Error initializing Firebase Admin SDK:', adminInitError);
      // Continue - we only need admin for auth verification
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
      maxFileSize: 25 * 1024 * 1024, // 25MB limit (increased from 10MB)
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
    const thumbsDir = path.join(baseUploadsDir, `${storagePath}/thumbnails`);
    
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.mkdir(thumbsDir, { recursive: true });
      console.log('Created upload directories:', {
        uploadsDir,
        thumbsDir
      });
    } catch (mkdirError) {
      console.error('Error creating directories:', mkdirError);
      return res.status(500).json({ error: 'Failed to create upload directories' });
    }
    
    // Set destination paths
    const destPath = path.join(uploadsDir, filename);
    const thumbPath = path.join(thumbsDir, filename);
    
    // Read file from the temporary location
    let fileContent;
    try {
      fileContent = await fs.readFile(filepath);
      console.log(`Read file successfully, size: ${fileContent.length} bytes`);
    } catch (readError) {
      console.error('Error reading uploaded file:', readError);
      return res.status(500).json({ error: 'Failed to read uploaded file' });
    }
    
    try {
      // Process and optimize image
      let imageInfo;
      try {
        imageInfo = await sharp(fileContent).metadata();
        console.log('Image metadata:', {
          width: imageInfo.width,
          height: imageInfo.height,
          format: imageInfo.format
        });
      } catch (metadataError) {
        console.error('Error getting image metadata:', metadataError);
        // Fall back to basic file upload without optimization
        await fs.writeFile(destPath, fileContent);
        const url = `/uploads/${storagePath}/${filename}`;
        return res.status(200).json({ url });
      }
      
      // Define max dimensions and quality based on file type
      const MAX_WIDTH = 1600;
      const MAX_HEIGHT = 1600;
      const THUMB_SIZE = 300;
      const quality = fileType === 'image/jpeg' ? 85 : 90;
      
      // Resize only if image is larger than our max dimensions
      let optimizedImage;
      if (imageInfo.width > MAX_WIDTH || imageInfo.height > MAX_HEIGHT) {
        optimizedImage = sharp(fileContent)
          .resize(MAX_WIDTH, MAX_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true
          });
      } else {
        optimizedImage = sharp(fileContent);
      }
      
      // Apply appropriate compression based on image type
      let outputBuffer;
      if (fileType === 'image/jpeg') {
        outputBuffer = await optimizedImage.jpeg({ quality }).toBuffer();
      } else if (fileType === 'image/png') {
        outputBuffer = await optimizedImage.png({ quality }).toBuffer();
      } else if (fileType === 'image/webp') {
        outputBuffer = await optimizedImage.webp({ quality }).toBuffer();
      } else {
        // For other formats like GIF, just use the original
        outputBuffer = fileContent;
      }
      
      // Generate thumbnail
      try {
        await sharp(fileContent)
          .resize(THUMB_SIZE, THUMB_SIZE, {
            fit: 'cover',
            position: 'attention'
          })
          .toFile(thumbPath);
        console.log('Thumbnail created successfully');
      } catch (thumbError) {
        console.error('Error creating thumbnail:', thumbError);
        // Continue without thumbnail
      }
      
      // Write optimized file
      try {
        await fs.writeFile(destPath, outputBuffer);
        console.log('Optimized image written successfully');
      } catch (writeError) {
        console.error('Error writing optimized image:', writeError);
        return res.status(500).json({ error: 'Failed to save optimized image' });
      }
      
      // Return the public URLs
      const url = `/uploads/${storagePath}/${filename}`;
      const thumbUrl = `/uploads/${storagePath}/thumbnails/${filename}`;
      
      console.log('File uploaded successfully:', {
        url,
        thumbUrl,
        originalSize: fileContent.length,
        optimizedSize: outputBuffer.length,
        reduction: ((1 - (outputBuffer.length / fileContent.length)) * 100).toFixed(2) + '%'
      });
      
      return res.status(200).json({ 
        url,
        thumbUrl,
        size: outputBuffer.length,
        width: imageInfo.width,
        height: imageInfo.height,
        format: imageInfo.format
      });
    } catch (optimizationError) {
      console.error('Error optimizing image:', optimizationError);
      
      // Fall back to using the original file if optimization fails
      try {
        await fs.writeFile(destPath, fileContent);
        console.log('Fallback: Original file written successfully without optimization');
        
        const url = `/uploads/${storagePath}/${filename}`;
        return res.status(200).json({ url });
      } catch (fallbackError) {
        console.error('Fallback error writing original file:', fallbackError);
        return res.status(500).json({ error: 'Failed to upload image (optimization and fallback failed)' });
      }
    }
  } catch (error) {
    console.error('Uncaught error handling file upload:', error);
    return res.status(500).json({ error: 'Failed to upload file - server error' });
  }
} 