// API route for serving local plant images
import { createReadStream } from 'fs';
import { join } from 'path';
import { stat } from 'fs/promises';

export default async function handler(req, res) {
  // Get the path array from the request
  const { path } = req.query;
  
  if (!path || !Array.isArray(path) || path.length === 0) {
    return res.status(400).json({ error: 'Invalid image path' });
  }
  
  try {
    // Join the path components and create the full path to the image
    // Make sure path doesn't try to access files outside the plant pages directory
    const safePath = path.join('/').replace(/\.\./g, '');
    const imagePath = join(process.cwd(), 'plant pages', safePath);
    
    // Check if file exists and get its stats
    const stats = await stat(imagePath);
    
    if (!stats.isFile()) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Determine content type based on file extension
    const extension = imagePath.split('.').pop().toLowerCase();
    const contentTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    
    const contentType = contentTypes[extension] || 'application/octet-stream';
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    
    // Stream the file to the response
    const fileStream = createReadStream(imagePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving plant image:', error);
    res.status(500).json({ error: 'Error serving image' });
  }
} 