export default function handler(req, res) {
  const { filename } = req.query;
  
  console.log('Dummy image server requested:', filename);
  
  // Set headers for image
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  
  // Return a simple SVG placeholder image
  const svg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="300" fill="#dddddd" />
    <text x="50%" y="50%" font-family="Arial" font-size="24" text-anchor="middle" fill="#666666">
      Placeholder Image
    </text>
    <text x="50%" y="65%" font-family="Arial" font-size="12" text-anchor="middle" fill="#666666">
      (File would be uploaded to Firebase)
    </text>
  </svg>`;
  
  res.status(200).send(svg);
} 