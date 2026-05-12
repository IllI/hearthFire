import { promises as fsPromises } from 'fs';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  console.log('Delete request received');

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
    // Continue with the delete process
  } else if (token !== 'dev-token' && !token.includes('admin')) {
    console.log('Token validation failed');
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Get filename from query parameter
    const { filename, path: reqPath = 'general' } = req.query;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    // Prevent directory traversal attacks
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    if (reqPath.includes('..') || reqPath.includes('//')) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    console.log(`Deleting file: ${filename} from path: ${reqPath}`);
    
    // Path to the file
    const baseUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(baseUploadsDir, reqPath, filename);
    
    // Also check for thumbnail to delete
    const thumbPath = path.join(baseUploadsDir, reqPath, 'thumbnails', filename);
    
    // Check if main file exists
    try {
      await fsPromises.access(filePath);
    } catch (error) {
      console.log(`File not found: ${filePath}`);
      return res.status(404).json({ error: 'File not found' });
    }
    
    try {
      // Delete the main file
      await fsPromises.unlink(filePath);
      console.log(`Deleted file: ${filePath}`);
      
      // Try to delete thumbnail if it exists
      try {
        await fsPromises.access(thumbPath);
        await fsPromises.unlink(thumbPath);
        console.log(`Deleted thumbnail: ${thumbPath}`);
      } catch (thumbError) {
        // Thumbnail doesn't exist, that's ok
        console.log(`No thumbnail found at ${thumbPath}`);
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'File deleted successfully',
        deletedPaths: [
          `/uploads/${reqPath}/${filename}`,
          `/uploads/${reqPath}/thumbnails/${filename}`
        ]
      });
    } catch (deleteError) {
      console.error('Error deleting file:', deleteError);
      return res.status(500).json({ error: 'Failed to delete file' });
    }
  } catch (error) {
    console.error('Error processing delete request:', error);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
} 