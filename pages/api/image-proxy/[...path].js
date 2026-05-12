import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream } from 'fs';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Get the file path from the URL
  const imagePath = req.query.path || [];
  if (!imagePath || imagePath.length === 0) {
    return res.status(400).json({ error: 'No image path specified' });
  }

  // Join the path parts and construct the full path to the file
  const relativeFilePath = path.join(...imagePath);
  
  // Determine if we're in the Firebase Functions environment
  const isCloudFunction = process.env.NODE_ENV === 'production' && process.cwd() === '/workspace';
  
  // Construct the full path to the file
  let fullFilePath;
  if (isCloudFunction) {
    // In production/Firebase Functions, serve from /tmp
    fullFilePath = path.join('/tmp', 'uploads', relativeFilePath);
  } else {
    // In development, serve from public directory
    fullFilePath = path.join(process.cwd(), 'public', 'uploads', relativeFilePath);
  }
  
  console.log(`Image proxy request for: ${relativeFilePath}`);
  console.log(`Looking for file at: ${fullFilePath}`);

  try {
    // Check if the file exists
    await fs.access(fullFilePath);
    
    // Determine content type from extension
    const ext = path.extname(fullFilePath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    
    // Set cache control headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', contentType);
    
    // Create a read stream from the file and pipe it to the response
    const fileStream = createReadStream(fullFilePath);
    fileStream.pipe(res);
    
    // Handle errors in the stream
    fileStream.on('error', (error) => {
      console.error(`Error streaming file: ${error.message}`);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
    
  } catch (error) {
    console.error(`Error accessing file: ${error.message}`);
    return res.status(404).json({ error: 'Image not found' });
  }
} 