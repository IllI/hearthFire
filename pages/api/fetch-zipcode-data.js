import { downloadAtlantaZipcodeData } from '../../lib/fetch-zipcode-data';

export default async function handler(req, res) {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only handle POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('Fetching zipcode data from GitHub...');
    
    // Download the zipcode data
    const result = await downloadAtlantaZipcodeData();
    
    if (!result.success) {
      console.error('Error downloading zipcode data:', result.error);
      return res.status(500).json({ 
        error: 'Failed to download zipcode data', 
        message: result.error 
      });
    }
    
    console.log('Downloaded zipcode data successfully:', result.message);
    
    // Return success
    res.status(200).json({ 
      success: true, 
      message: 'Zipcode data downloaded successfully',
      featureCount: result.featureCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in fetch zipcode data API:', error);
    res.status(500).json({ 
      error: 'Failed to fetch zipcode data',
      message: error.message 
    });
  }
} 