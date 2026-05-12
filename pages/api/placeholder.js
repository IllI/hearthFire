// Dynamic placeholder image generator
import { createCanvas } from 'canvas';

export default function handler(req, res) {
  try {
    // Set width and height (default 400x300 or use query params)
    const width = parseInt(req.query.width || 400, 10);
    const height = parseInt(req.query.height || 300, 10);
    
    // Get plant name from query params or use a default
    const name = req.query.name || 'Plant Image';
    
    // Create canvas with the specified dimensions
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    
    // Draw background
    context.fillStyle = '#f0f0f0';
    context.fillRect(0, 0, width, height);
    
    // Draw border
    context.strokeStyle = '#cccccc';
    context.lineWidth = 2;
    context.strokeRect(0, 0, width, height);
    
    // Draw text
    context.fillStyle = '#666666';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name, width / 2, height / 2);
    
    // Set response headers for PNG image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Stream canvas as PNG
    const buffer = canvas.toBuffer('image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating placeholder image:', error);
    
    // If there's an error, serve a simple colored rectangle
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
      <rect width="400" height="300" fill="#cccccc" />
      <text x="200" y="150" font-family="Arial" font-size="24" text-anchor="middle" fill="#666666">Plant Image</text>
    </svg>`);
  }
} 