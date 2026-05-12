import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  console.log('Create folder request received');

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
    // Continue with folder creation
  } else if (token !== 'dev-token' && !token.includes('admin')) {
    console.log('Token validation failed');
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { path: requestPath, folderName } = req.body;
    console.log(`Creating folder '${folderName}' in path '${requestPath || 'general'}'`);

    if (!folderName || !folderName.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // Validate folder name (only allow alphanumeric, dashes, and underscores)
    if (!/^[a-zA-Z0-9-_]+$/.test(folderName)) {
      return res.status(400).json({ 
        error: 'Folder name can only contain letters, numbers, dashes, and underscores' 
      });
    }

    // Sanitize the request path to prevent directory traversal
    let basePath = requestPath || 'general';
    if (basePath.includes('..') || basePath.includes('//')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    // Create the full path for the new folder
    const baseUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const newFolderPath = path.join(baseUploadsDir, basePath, folderName);
    console.log(`Full folder path: ${newFolderPath}`);

    // Check if folder already exists
    if (fs.existsSync(newFolderPath)) {
      console.log(`Folder already exists: ${newFolderPath}`);
      return res.status(400).json({ error: 'Folder already exists' });
    }

    // Create the folder
    fs.mkdirSync(newFolderPath, { recursive: true });
    console.log(`Created folder: ${newFolderPath}`);

    // Create thumbnails directory inside the new folder
    const thumbnailsPath = path.join(newFolderPath, 'thumbnails');
    fs.mkdirSync(thumbnailsPath, { recursive: true });
    console.log(`Created thumbnails folder: ${thumbnailsPath}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Folder created successfully',
      folderPath: `${basePath}/${folderName}` 
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return res.status(500).json({ error: 'Failed to create folder' });
  }
} 