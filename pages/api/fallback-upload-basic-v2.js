import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  
  console.log('Basic upload V2 handler called');
  console.log('Current working directory:', process.cwd());
  console.log('Node environment:', process.env.NODE_ENV);
  
  try {
    // For Firebase Functions environment, we need to use the /tmp directory
    // which is the only directory with write permissions
    let baseUploadsDir;
    const isCloudFunction = process.env.NODE_ENV === 'production' && process.cwd() === '/workspace';
    
    if (isCloudFunction) {
      baseUploadsDir = path.join('/tmp', 'uploads');
      console.log('Running in Firebase Functions environment, using:', baseUploadsDir);
    } else {
      baseUploadsDir = path.join(process.cwd(), 'public', 'uploads');
      console.log('Running in standard environment, using:', baseUploadsDir);
    }
    
    try {
      await fs.mkdir(baseUploadsDir, { recursive: true });
      console.log('Upload base directory created/verified:', baseUploadsDir);
      
      // Write a test file to verify permissions
      const testFilePath = path.join(baseUploadsDir, 'permission-test.txt');
      await fs.writeFile(testFilePath, 'Test file for upload permissions');
      console.log('Successfully wrote test file:', testFilePath);
      
      // Cleanup test file
      await fs.unlink(testFilePath);
      console.log('Successfully removed test file - write permissions confirmed');
    } catch (dirError) {
      console.error('Error with upload directory:', dirError);
      return res.status(500).json({ error: `Directory error: ${dirError.message}` });
    }
    
    // Parse form with formidable
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      uploadDir: isCloudFunction ? '/tmp' : undefined, // Explicitly use /tmp in functions
      multiples: false, // Explicitly state we only expect one file
      maxFieldsSize: 20 * 1024 * 1024, // Increase max field size just in case (default 2MB)
      fileWriteStreamHandler: (file) => {
        const tempFilePath = path.join(isCloudFunction ? '/tmp' : os.tmpdir(), `upload_${uuidv4()}`);
        console.log(`[Formidable] Using temp file path: ${tempFilePath}`);
        return fs.createWriteStream(tempFilePath);
      } 
    });
    
    console.log('Formidable instance created with options:', {
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024,
      uploadDir: isCloudFunction ? '/tmp' : 'default',
      multiples: false,
      maxFieldsSize: 20 * 1024 * 1024
    });
        
    // Parse the form
    console.log('Preparing to parse form...');
    const [fields, files] = await new Promise((resolve, reject) => {
      console.log('Inside Promise executor, before form.parse'); // Log inside promise
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('>>> Form parsing ERROR inside callback:', err);
          console.error('Error Code:', err.code);
          console.error('Error Message:', err.message);
          reject(err);
        } else {
          console.log('Form parsing successful within callback.'); // Log success
          resolve([fields, files]);
        }
      });
    });
    
    console.log("Form parsed successfully (after await):"); // Log after await
    console.log({ 
      fields: Object.keys(fields), 
      files: Object.keys(files)
    });
    
    // Get storage path from fields or use default
    const storagePath = fields.path ? fields.path[0] : 'products';
    
    // Extract file
    let file;
    if (files.file) {
      // Since multiples is false, it should not be an array
      file = files.file;
    } 
    // Add fallback just in case multiples:false doesn't work as expected
    else if (Array.isArray(files.file) && files.file.length > 0) {
       console.warn('Formidable returned an array despite multiples:false, using first file.')
       file = files.file[0];
    }
    
    if (!file) {
      console.error('No file found in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get file info
    const originalFilename = file.originalFilename || file.originalname || file.name || 'unknown.jpg';
    const filepath = file.filepath || file.path; // filepath is the temp path from formidable
    console.log('File details:', {
      originalFilename,
      filepath,
      size: file.size
    });
    
    if (!filepath) {
       console.error('File path (filepath) is missing after parsing.');
       return res.status(500).json({ error: 'File path missing after processing.' });
    }
    
    // Generate a unique filename
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${uniqueId}-${cleanFilename}`;
    
    // Ensure target directory exists within the base uploads dir
    const uploadsDir = path.join(baseUploadsDir, storagePath);
    
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      console.log('Created upload directory:', uploadsDir);
    } catch (mkdirError) {
      console.error('Error creating upload directory:', mkdirError);
      return res.status(500).json({ error: 'Failed to create upload directory' });
    }
    
    // Set final destination path
    const destPath = path.join(uploadsDir, filename);
    
    try {
      // Copy/Move the file from the temp location (filepath) to the final destination (destPath)
      // Use rename as an atomic move operation
      await fs.rename(filepath, destPath);
      console.log('File moved successfully to:', destPath);
      
      // IMPORTANT CHANGE: In production, return a URL that points to our API proxy
      // instead of a direct file URL which won't work in Firebase Functions
      let url;
      if (isCloudFunction) {
        // Use API proxy URL that will serve the image from /tmp
        url = `/api/image-proxy/${storagePath}/${filename}`;
      } else {
        // In development, use the standard public path
        url = `/uploads/${storagePath}/${filename}`;
      }
      
      console.log('Returning URL:', url);
      return res.status(200).json({ 
        url,
        size: file.size // Use file.size reported by formidable
      });
    } catch (moveError) {
      console.error('Error moving file from temp location:', moveError);
      // Attempt to clean up temp file if move fails
      try { await fs.unlink(filepath); } catch (cleanupError) { console.error('Failed to cleanup temp file:', cleanupError); }
      return res.status(500).json({ error: 'Failed to save file: ' + moveError.message });
    }
  } catch (error) {
    console.error('Uncaught error handling file upload:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
} 