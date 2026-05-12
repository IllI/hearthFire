import { getFirestore } from '../../../lib/firebase-admin';

/**
 * API endpoint for fetching Home page content
 * GET /api/content/home - Returns the current Home page content from Firestore
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
    // Use the async initialization function to ensure Firebase is ready
    const firestore = await getFirestore();

    console.log('Home API: Firebase Admin initialized, fetching content...');
    // Now that Firebase is definitely initialized, fetch content
    const contentDoc = await firestore.collection('content').doc('home').get();

    if (!contentDoc.exists) {
      console.log('Home page content document not found, returning default content');

      return res.status(200).json({
        success: true,
        content: getDefaultHomeContent()
      });
    }

    // Return the content from Firestore
    const content = contentDoc.data();
    console.log('Home page content retrieved successfully');

    return res.status(200).json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Error in home page content handler:', error);
    console.error('Stack trace:', error.stack);

    // Always return default content on error
    return res.status(200).json({
      success: true,
      content: getDefaultHomeContent()
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