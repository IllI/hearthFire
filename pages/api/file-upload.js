import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
  
  console.log('File upload handler called');
  
  try {
    // Define base upload directory in public folder
    const baseUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
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
    const originalFilename = file.originalFilename || file.originalname || file.name || 'unknown.jpg';
    const filepath = file.filepath || file.path;
    
    if (!filepath) {
      console.error('File path is missing after parsing');
      return res.status(500).json({ error: 'File path missing after processing' });
    }
    
    // Get upload folder from request or use default
    const subfolder = fields.path ? fields.path[0] : 'general';
    
    // Ensure the upload directory exists
    const uploadsDir = path.join(baseUploadsDir, subfolder);
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Generate a unique filename
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${cleanFilename}`;
    
    // Set destination path
    const destPath = path.join(uploadsDir, filename);
    
    // Copy file to destination
    try {
      const fileContent = await fs.readFile(filepath);
      await fs.writeFile(destPath, fileContent);
      console.log('File saved to:', destPath);
    } catch (copyError) {
      console.error('Error copying file:', copyError);
      return res.status(500).json({ error: 'Failed to save file' });
    }
    
    // Create URL path
    const urlPath = `/uploads/${subfolder}/${filename}`;
    console.log('File URL path:', urlPath);
    
    // Return success response
    return res.status(200).json({
      url: urlPath,
      size: file.size
    });
    
  } catch (error) {
    console.error('Error handling file upload:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
} 