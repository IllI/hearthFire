import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  
  try {
    // Get the file path from the URL
    const { path: filePath } = req.query;
    
    if (!filePath || !Array.isArray(filePath) || filePath.length === 0) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Reconstruct the file path (joining array elements with /)
    const relativePath = filePath.join('/');
    console.log('Requested file:', relativePath);
    
    // Determine the base directory
    let baseDir;
    if (process.env.NODE_ENV === 'production' && process.cwd() === '/workspace') {
      // Firebase Functions environment - use /tmp directory
      baseDir = '/tmp/uploads';
      console.log('Using tmp directory for file serving');
    } else {
      // Local development - use public directory
      baseDir = path.join(process.cwd(), 'public', 'uploads');
      console.log('Using public directory for file serving');
    }
    
    // Construct the absolute file path
    const absolutePath = path.join(baseDir, relativePath);
    console.log('Absolute path:', absolutePath);
    
    // Security check - make sure the path is within the allowed directory
    const normalizedPath = path.normalize(absolutePath);
    if (!normalizedPath.startsWith(baseDir)) {
      console.error('Security violation - attempted path traversal:', normalizedPath);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if the file exists
    try {
      const stats = await fs.stat(normalizedPath);
      if (!stats.isFile()) {
        console.error('Requested path is not a file:', normalizedPath);
        return res.status(404).json({ error: 'Not a file' });
      }
    } catch (err) {
      console.error('File not found:', normalizedPath, err);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Read the file
    const fileData = await fs.readFile(normalizedPath);
    
    // Determine content type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
      // Add more types as needed
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileData.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Send the file
    return res.status(200).send(fileData);
  } catch (error) {
    console.error('Error serving file:', error);
    return res.status(500).json({ error: 'Server error serving file' });
  }
} 