import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  console.log('[Manual Upload] Request received');
  
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    console.log('[Manual Upload] Parsing form data');
    
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('[Manual Upload] Parse error:', err);
          reject(err);
          return;
        }
        resolve([fields, files]);
      });
    });

    console.log('[Manual Upload] Form data parsed, looking for files');
    
    // Get the uploaded file
    const file = files.file;
    if (!file) {
      console.error('[Manual Upload] No file found in request');
      return res.status(400).json({ error: 'No file provided' });
    }

    // Extract folder from fields or use default
    const folder = fields.folder || 'products';
    
    console.log(`[Manual Upload] Found file: ${file.originalFilename}, size: ${file.size}, type: ${file.mimetype}, saving to folder: ${folder}`);
    
    // Generate unique filename
    const timestamp = Date.now();
    const uniqueId = uuidv4().slice(0, 8);
    const safeFilename = file.originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${uniqueId}_${safeFilename}`;
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', folder);
    if (!fs.existsSync(uploadsDir)) {
      console.log(`[Manual Upload] Creating directory: ${uploadsDir}`);
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create destination path
    const destPath = path.join(uploadsDir, filename);
    
    // Read and write the file
    console.log(`[Manual Upload] Reading file from: ${file.filepath}`);
    const data = fs.readFileSync(file.filepath);
    fs.writeFileSync(destPath, data);
    console.log(`[Manual Upload] File written to: ${destPath}`);
    
    // Generate the URL
    const publicUrl = `/uploads/${folder}/${filename}`;
    
    // Return the URL
    console.log(`[Manual Upload] File successfully uploaded: ${publicUrl}`);
    
    return res.status(200).json({
      success: true,
      url: publicUrl,
      filename,
      originalName: file.originalFilename,
      size: file.size,
      type: file.mimetype
    });
  } catch (error) {
    console.error('[Manual Upload] Error:', error);
    return res.status(500).json({ 
      error: 'Upload failed',
      message: error.message
    });
  }
} 