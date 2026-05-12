import { IncomingForm } from 'formidable';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  console.log('Ultra-basic upload endpoint called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Current directory:', process.cwd());
    
    // Parse the form with minimal options
    const form = new IncomingForm({
      multiples: false
    });
    
    // Use simple callback approach
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Form parsing error:', err);
        return res.status(500).json({ error: 'Form parsing failed' });
      }
      
      console.log('Form parsed successfully');
      console.log('Files:', Object.keys(files));
      
      // Get the file
      const file = files.file;
      if (!file) {
        console.error('No file found in request');
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      console.log('File received:', {
        name: file.originalFilename || 'unknown',
        size: file.size || 0,
        type: file.mimetype || 'unknown'
      });
      
      // Generate a random file name
      const random = randomBytes(8).toString('hex');
      const timestamp = Date.now();
      const fileUrl = `/api/uploads/${timestamp}-${random}`;
      
      // Return success directly without writing to disk
      console.log('Returning success with URL:', fileUrl);
      return res.status(200).json({ 
        success: true,
        display_url: fileUrl,
        url: fileUrl
      });
    });
  } catch (error) {
    console.error('Unhandled error in upload handler:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
} 