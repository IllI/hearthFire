import { initAdminAsync } from '../../../lib/firebase-admin';

/**
 * API endpoint for setting up the homepage content
 * POST /api/setup/home - Creates default homepage content if it doesn't exist
 */
export default async function handler(req, res) {
  // Only allow POST requests for initial setup
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      success: false, 
      error: `Method ${req.method} Not Allowed` 
    });
  }

  try {
    console.log('Setup Home API: Ensuring Firebase Admin is initialized...');
    const admin = await initAdminAsync();
    const firestore = admin.firestore();
    
    // Check if homepage content already exists
    const contentDocRef = firestore.collection('content').doc('home');
    const contentDoc = await contentDocRef.get();
    
    if (contentDoc.exists) {
      console.log('Setup Home API: Homepage content already exists');
      return res.status(200).json({
        success: true,
        message: 'Homepage content already exists',
        existing: true,
        content: contentDoc.data()
      });
    }
    
    // Create default homepage content
    console.log('Setup Home API: Creating default homepage content');
    const defaultContent = getDefaultHomeContent();
    
    await contentDocRef.set(defaultContent);
    
    return res.status(201).json({
      success: true,
      message: 'Default homepage content created successfully',
      existing: false,
      content: defaultContent
    });
  } catch (error) {
    console.error('Setup Home API: Error during setup process', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error setting up homepage content',
      details: error.message
    });
  }
}

// Helper function to get default home content
function getDefaultHomeContent() {
  return {
    title: 'Fresh from Hearthfire Farm to Your Door',
    subtitle: 'Order fresh, organic produce from our hearth to your home.',
    mainImage: '/images/farm-bg.jpg',
    ctaButton: {
      text: 'Browse Produce',
      link: '/products'
    },
    sections: [
      {
        title: 'Our Farm to Your Table',
        content: `<p>Hearthfire Farm is committed to growing the highest quality organic produce using sustainable farming practices. We believe in connecting our community directly to the source of their food.</p>
                   <p>Every vegetable and fruit we deliver is harvested at peak freshness, ensuring maximum flavor and nutritional value.</p>`,
        image: '/images/farm-produce.jpg',
        button: {
          text: 'View Our Products',
          link: '/products'
        }
      },
      {
        title: 'Weekly Delivery & Pickup',
        content: `<p>We offer convenient delivery options to select zip codes in our area, bringing farm-fresh produce directly to your doorstep.</p>
                   <p>For those outside our delivery area, we have multiple pickup locations where you can collect your order at a time that works for you.</p>`,
        image: '/images/delivery.jpg',
        button: {
          text: 'Check Availability',
          link: '/cart'
        }
      }
    ],
    lastUpdated: new Date().toISOString()
  };
} 