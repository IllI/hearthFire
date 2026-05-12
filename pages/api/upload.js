import formidable from 'formidable';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

// Disable the default body parser to support file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

const parseForm = (req) => {
  return new Promise((resolve, reject) => {
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB limit (increased from 10MB)
      maxTotalFileSize: 50 * 1024 * 1024, // 50MB total limit for all files
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};

const createThumbnail = async (filePath, thumbnailPath, width = 300) => {
  try {
    // Create the thumbnails directory if it doesn't exist
    const thumbnailDir = path.dirname(thumbnailPath);
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }
    
    // Generate thumbnail
    await sharp(filePath)
      .resize(width)
      .toFile(thumbnailPath);
    
    console.log(`Thumbnail created at ${thumbnailPath}`);
    return true;
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    return false;
  }
};

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  console.log('Upload request received');

  // Check authorization (simplified for demo/development)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Missing or invalid authorization header format');
    return res.status(401).json({ error: 'Unauthorized - Missing or invalid auth header' });
  }

  // In production, you would verify the token properly
  // For development, we're just checking for a dev token
  const token = authHeader.split('Bearer ')[1];
  console.log('Received token:', token ? `${token.substr(0, 10)}...` : 'none');
  
  // For development: accept any token for now
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: bypassing strict token validation');
    // Continue with the upload process
  } else if (token !== 'dev-token' && !token.includes('admin')) {
    console.log('Token validation failed');
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { fields, files } = await parseForm(req);
    
    // Add detailed debugging for the files object
    console.log('Files object structure:', JSON.stringify(files, null, 2));
    console.log('Files object keys:', Object.keys(files));
    console.log('Form fields:', JSON.stringify(fields, null, 2));
    
    // Handle file access - formidable may return an array of files
    let uploadedFile = null;
    
    if (files.file) {
      if (Array.isArray(files.file)) {
        console.log('File is in an array format, accessing first element');
        uploadedFile = files.file[0];
      } else {
        console.log('File is in direct object format');
        uploadedFile = files.file;
      }
    }
    
    if (!uploadedFile) {
      console.log('No file found in request with key "file"');
      
      // Check if file might be under a different key
      const fileKeys = Object.keys(files);
      if (fileKeys.length > 0) {
        console.log('Found alternative file keys:', fileKeys);
        const alternativeKey = fileKeys[0];
        const alternativeFile = Array.isArray(files[alternativeKey]) 
          ? files[alternativeKey][0] 
          : files[alternativeKey];
        
        console.log('Using alternative file:', alternativeFile);
        uploadedFile = alternativeFile;
      } else {
        return res.status(400).json({ error: 'No file uploaded' });
      }
    }
    
    // Debug file properties
    console.log('File details:', {
      originalFilename: uploadedFile.originalFilename,
      newFilename: uploadedFile.newFilename,
      filepath: uploadedFile.filepath,
      mimetype: uploadedFile.mimetype,
      size: uploadedFile.size
    });
    
    // Get folder path from fields, default to 'general' if not provided
    // Handle array values from formidable
    let folderPath = 'general';
    if (fields.path) {
      folderPath = Array.isArray(fields.path) ? fields.path[0] : fields.path;
      console.log('Path type:', typeof fields.path, Array.isArray(fields.path));
    }
    
    // Validate folder path to prevent directory traversal
    if (folderPath.includes('..') || folderPath.includes('//')) {
      return res.status(400).json({ error: 'Invalid folder path' });
    }
    
    // Create unique filename with original extension
    // Add robust fallbacks for missing filename
    let fileExt = '.jpg'; // Default extension
    
    if (uploadedFile.originalFilename) {
      fileExt = path.extname(uploadedFile.originalFilename);
    } else if (uploadedFile.newFilename) {
      fileExt = path.extname(uploadedFile.newFilename);
    } else if (uploadedFile.mimetype) {
      // Derive extension from mimetype if filename is not available
      const mimetypeMap = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg'
      };
      fileExt = mimetypeMap[uploadedFile.mimetype] || '.jpg';
    }
    
    const uniqueFilename = `${uuidv4()}${fileExt}`;
    console.log(`Generated unique filename: ${uniqueFilename} with extension: ${fileExt}`);
    
    // Ensure uploads directory exists
    const baseUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const targetDir = path.join(baseUploadsDir, folderPath);
    
    if (!fs.existsSync(targetDir)) {
      console.log(`Creating directory: ${targetDir}`);
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Define target paths
    const targetPath = path.join(targetDir, uniqueFilename);
    const publicPath = `/uploads/${folderPath}/${uniqueFilename}`;
    
    // Create directory for thumbnails
    const thumbnailDir = path.join(targetDir, 'thumbnails');
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }
    
    // Copy the file to the target path
    fs.copyFileSync(uploadedFile.filepath, targetPath);
    console.log(`File saved to: ${targetPath}`);
    
    // Generate metadata
    const metadata = {
      filename: uniqueFilename,
      originalName: uploadedFile.originalFilename || 'unnamed-file',
      size: uploadedFile.size,
      type: uploadedFile.mimetype,
      path: publicPath,
      uploadedAt: new Date().toISOString(),
    };
    
    // Create thumbnail if it's an image
    if (uploadedFile.mimetype.startsWith('image/')) {
      const thumbnailPath = path.join(thumbnailDir, uniqueFilename);
      const thumbnailPublicPath = `/uploads/${folderPath}/thumbnails/${uniqueFilename}`;
      
      const thumbnailCreated = await createThumbnail(targetPath, thumbnailPath);
      
      if (thumbnailCreated) {
        metadata.thumbnail = thumbnailPublicPath;
      }
    }
    
    // Respond with success and file details
    console.log('Upload completed successfully');
    return res.status(200).json({ 
      success: true, 
      file: metadata 
    });
  } catch (error) {
    console.error('Error processing upload:', error);
    return res.status(500).json({ error: 'Failed to process upload' });
  }
} 