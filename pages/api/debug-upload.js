// Simple API endpoint to debug upload issues
export default function handler(req, res) {
  // Log request info
  console.log('DEBUG UPLOAD ENDPOINT CALLED');
  console.log('Request method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // Respond with success
  res.status(200).json({
    success: true,
    message: 'Debug endpoint called successfully',
    timestamp: new Date().toISOString(),
    display_url: '/api/uploads/debug-placeholder-image',
    url: '/api/uploads/debug-placeholder-image'
  });
} 