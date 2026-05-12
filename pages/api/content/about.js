import { initAdminAsync } from '../../../lib/firebase-admin';

/**
 * API endpoint for fetching About page content
 * GET /api/content/about - Returns the current About page content from Firestore
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      success: false, 
      error: `Method ${req.method} Not Allowed` 
    });
  }

  try {
    // Initialize Firebase Admin asynchronously
    console.log('About API: Ensuring Firebase Admin is initialized...');
    const admin = await initAdminAsync();
    const firestore = admin.firestore();
    
    console.log('About API: Firebase Admin initialized, fetching content...');
    // Now that Firebase is definitely initialized, fetch content
    const contentDoc = await firestore.collection('content').doc('about').get();
    
    // If no document exists, return default content
    if (!contentDoc.exists) {
      console.log('About page content document not found, returning default content');
      
      return res.status(200).json({
        success: true,
        content: {
          title: 'About Hearthfire Farm',
          content: `
            <p>Welcome to Hearthfire Farm, where we deliver fresh, organic produce directly from our farm to your doorstep.</p>
            <p>Our mission is to provide the highest quality, locally grown organic produce to our community while practicing sustainable farming methods that nurture the land for future generations.</p>
            <h2>Our Story</h2>
            <p>Hearthfire Farm began in 2018 with a simple idea: create a direct connection between local farmers and the community they serve. What started as a small family farm has grown into a thriving operation that serves hundreds of families across the region.</p>
            <h2>Our Values</h2>
            <ul>
              <li><strong>Sustainability</strong> - We use regenerative farming practices that build soil health and sequester carbon.</li>
              <li><strong>Community</strong> - We believe in building strong local food systems that connect people to the source of their food.</li>
              <li><strong>Quality</strong> - We grow exceptional produce using organic methods that prioritize flavor and nutrition.</li>
            </ul>
            <p>Thank you for supporting local agriculture and being part of our journey!</p>
          `,
          heroImage: '/images/farm-hero.jpg',
          lastUpdated: new Date().toISOString()
        }
      });
    }
    
    // Return the content from Firestore
    const content = contentDoc.data();
    console.log('About page content retrieved successfully');
    
    return res.status(200).json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Error fetching about page content:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch about page content'
    });
  }
} 