import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

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
  
  console.log('Simple upload handler called');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Current directory:', process.cwd());
  
  try {
    // Define base upload directory in public folder
    let baseUploadsDir;
    
    // Handle Firebase Functions environment
    if (process.env.NODE_ENV === 'production' && process.cwd() === '/workspace') {
      // In Firebase Functions, use /tmp directory which is writable
      baseUploadsDir = path.join('/tmp', 'uploads');
      console.log('Using Firebase tmp directory:', baseUploadsDir);
    } else {
      // In development or other environments, use public directory
      baseUploadsDir = path.join(process.cwd(), 'public', 'uploads');
      console.log('Using local public directory:', baseUploadsDir);
    }
    
    // Parse the incoming form data
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      multiples: false
    });
    
    // Parse the form
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
    
    console.log("Form parsed successfully");
    
    // Get the file from the form
    let file;
    if (files.file) {
      file = files.file;
    } else if (Array.isArray(files.file) && files.file.length > 0) {
      file = files.file[0];
    }
    
    if (!file) {
      console.error('No file found in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get file info
    const filepath = file.filepath || file.path;
    const originalFilename = file.originalFilename || file.originalname || file.name || 'unknown.jpg';
    const filesize = file.size || 0;
    const filetype = file.mimetype || file.type || 'application/octet-stream';
    
    console.log('File details:', {
      originalFilename,
      filesize,
      filetype,
      tempPath: filepath ? 'Valid' : 'Missing'
    });
    
    if (!filepath) {
      console.error('File path is missing after parsing');
      return res.status(500).json({ error: 'File path missing after processing' });
    }
    
    // Create unique subdirectory for uploads (products by default)
    const subfolder = fields.path ? fields.path[0] : 'products';
    const uploadsDir = path.join(baseUploadsDir, subfolder);
    
    try {
      // Ensure the upload directory exists
      await fs.mkdir(uploadsDir, { recursive: true });
      console.log('Upload directory created/verified:', uploadsDir);
    } catch (dirError) {
      console.error('Error creating directory:', dirError);
      return res.status(500).json({ error: 'Failed to create upload directory' });
    }
    
    // Generate a unique filename to avoid collisions
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    const safeName = basename.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeName}-${timestamp}-${randomString}${ext}`;
    
    // Set destination path
    const destPath = path.join(uploadsDir, filename);
    console.log('Destination path:', destPath);
    
    try {
      // Read the file and write to destination
      const fileContent = await fs.readFile(filepath);
      await fs.writeFile(destPath, fileContent);
      console.log('File saved successfully, size:', fileContent.length);
      
      // Generate URL for the uploaded file
      let publicUrl;
      if (process.env.NODE_ENV === 'production' && process.cwd() === '/workspace') {
        // In Firebase, return a path that will be handled by a proxy
        publicUrl = `/api/file-proxy/${subfolder}/${filename}`;
      } else {
        // In development, use the public URL
        publicUrl = `/uploads/${subfolder}/${filename}`;
      }
      
      console.log('File URL:', publicUrl);
      
      // Return success with URL that matches the ImgBB response structure
      return res.status(200).json({
        url: publicUrl,
        display_url: publicUrl,
        thumb_url: publicUrl,
        delete_url: '',
        size: filesize
      });
    } catch (fileError) {
      console.error('Error saving file:', fileError);
      return res.status(500).json({ error: 'Failed to save uploaded file' });
    }
  } catch (error) {
    console.error('Unhandled error in upload handler:', error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message
    });
  }
} 