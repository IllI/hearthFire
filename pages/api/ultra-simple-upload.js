import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { randomBytes } from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Ultra-simple file upload endpoint using native Node.js streams
 * This version returns a data URL to avoid file storage issues with Firebase Hosting
 */
export default async function handler(req, res) {
  console.log('[ULTRA-SIMPLE] Upload endpoint called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Very basic multipart form parser using native Node.js
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }
    
    // Generate a unique filename
    const timestamp = Date.now();
    const uniqueId = randomBytes(4).toString('hex');
    const filename = `${timestamp}-${uniqueId}.jpg`; // Default to jpg
    
    // Create a temporary file to store the uploaded data
    const tempDir = path.join(process.cwd(), 'temp');
    const tempPath = path.join(tempDir, filename);
    
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(`[ULTRA-SIMPLE] Created temporary directory: ${tempDir}`);
      }
    } catch (dirError) {
      console.error('[ULTRA-SIMPLE] Error creating temporary directory:', dirError);
    }
    
    // Create output file stream for temporary storage
    const outputStream = fs.createWriteStream(tempPath);
    
    // Write the request body to the temporary file
    try {
      console.log(`[ULTRA-SIMPLE] Saving file temporarily to: ${tempPath}`);
      await pipeline(req, outputStream);
      console.log(`[ULTRA-SIMPLE] File saved temporarily`);
      
      // Read the file as base64
      const fileBuffer = fs.readFileSync(tempPath);
      const base64Data = fileBuffer.toString('base64');
      
      // Determine MIME type (default to jpeg)
      const mimeType = 'image/jpeg';
      
      // Create data URL
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(tempPath);
        console.log(`[ULTRA-SIMPLE] Temporary file cleaned up`);
      } catch (cleanupError) {
        console.error('[ULTRA-SIMPLE] Error cleaning up temporary file:', cleanupError);
      }
      
      // Return the data URL
      return res.status(200).json({
        success: true,
        url: dataUrl,
        filename: filename,
        isDataUrl: true
      });
    } catch (streamError) {
      console.error('[ULTRA-SIMPLE] Stream error:', streamError);
      return res.status(500).json({ error: 'Failed to process file' });
    }
  } catch (error) {
    console.error('[ULTRA-SIMPLE] Unhandled error:', error);
    return res.status(500).json({ error: error.message });
  }
} 