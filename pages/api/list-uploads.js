import { promises as fsPromises } from 'fs';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  console.log('List uploads request received');

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
    // Continue with listing uploads
  } else if (token !== 'dev-token' && !token.includes('admin')) {
    console.log('Token validation failed');
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Get the path parameter, defaulting to 'general'
    const reqPath = req.query.path || 'general';
    console.log(`Listing files in path: ${reqPath}`);
    
    // Prevent directory traversal attacks
    if (reqPath.includes('..') || reqPath.includes('//')) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    // Create the full path for the uploads directory
    const baseUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const uploadsDir = path.join(baseUploadsDir, reqPath);
    
    // Check if directory exists, create it if not
    if (!fs.existsSync(uploadsDir)) {
      console.log(`Creating directory: ${uploadsDir}`);
      fs.mkdirSync(uploadsDir, { recursive: true });
      // Return empty lists since the directory is new
      return res.status(200).json({ files: [], directories: [] });
    }
    
    // Read the contents of the directory
    const directoryContents = await fsPromises.readdir(uploadsDir, { withFileTypes: true });
    
    // Filter out thumbnails and hidden files
    // Only return files and directories, not symlinks or other types
    const files = [];
    const directories = [];
    
    for (const item of directoryContents) {
      // Skip the thumbnails directory itself
      if (item.name === 'thumbnails' && item.isDirectory()) {
        continue;
      }
      
      // Skip dot files (hidden files)
      if (item.name.startsWith('.')) {
        continue;
      }
      
      if (item.isDirectory()) {
        directories.push(item.name);
      } else if (item.isFile()) {
        try {
          const stats = await fsPromises.stat(path.join(uploadsDir, item.name));
          const thumbPath = path.join(uploadsDir, 'thumbnails', item.name);
          let hasThumbnail = false;
          
          try {
            await fsPromises.access(thumbPath);
            hasThumbnail = true;
          } catch (e) {
            // Thumbnail doesn't exist, that's ok
          }
          
          files.push({
            filename: item.name,
            originalName: item.name,
            size: stats.size,
            type: getFileType(item.name),
            path: `/uploads/${reqPath}/${item.name}`,
            thumbnail: hasThumbnail ? `/uploads/${reqPath}/thumbnails/${item.name}` : null,
            uploadedAt: stats.mtime.toISOString()
          });
        } catch (err) {
          console.error(`Error processing file ${item.name}:`, err);
          // Skip this file if there's an error
        }
      }
    }
    
    console.log(`Found ${files.length} files and ${directories.length} directories`);
    return res.status(200).json({ files, directories });
  } catch (error) {
    console.error('Error listing files:', error);
    return res.status(500).json({ error: 'Failed to list files' });
  }
}

// Helper function to determine file type based on extension
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  // Common image types
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
    return `image/${ext.substring(1)}`;
  }
  
  // Common document types
  if (ext === '.pdf') return 'application/pdf';
  if (['.doc', '.docx'].includes(ext)) return 'application/msword';
  if (['.xls', '.xlsx'].includes(ext)) return 'application/vnd.ms-excel';
  
  // Default
  return 'application/octet-stream';
} 