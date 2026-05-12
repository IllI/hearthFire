import googleCalendar from '../../lib/google-calendar';

export default async function handler(req, res) {
  try {
    console.log('Testing Google Calendar authentication via API endpoint');
    
    // Call the test authentication function
    const authResult = await googleCalendar.testAuth();
    
    return res.status(200).json({
      ...authResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test-auth API:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error testing Google Calendar authentication',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 