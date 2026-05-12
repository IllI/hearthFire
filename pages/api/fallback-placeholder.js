// Ultra-minimal placeholder image generator
export default function handler(req, res) {
  // Set width and height (default 400x300 or use query params)
  const width = parseInt(req.query.width || 400, 10);
  const height = parseInt(req.query.height || 300, 10);
  
  // Get product name from query params or use a default
  const name = req.query.name || 'Product';
  
  // Format the name - if it's too long, truncate it
  const formattedName = name.length > 30 ? name.substring(0, 27) + '...' : name;
  
  // Create a very simple SVG with just text on a plain background
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <!-- Plain white background -->
    <rect width="${width}" height="${height}" fill="#ffffff" />
    
    <!-- Simple border -->
    <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#e0e0e0" stroke-width="1" />
    
    <!-- Product name centered -->
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="18" font-weight="bold" 
          text-anchor="middle" dominant-baseline="middle" fill="#333333">
      ${formattedName}
    </text>
    
    <!-- Small "No image" text -->
    <text x="50%" y="${height - 20}" font-family="Arial, sans-serif" font-size="12" 
          text-anchor="middle" fill="#999999">
      No image available
    </text>
  </svg>`;
  
  // Set response headers for SVG and prevent caching to ensure changes are seen
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Send the SVG
  res.status(200).send(svg);
} 