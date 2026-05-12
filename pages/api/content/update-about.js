import { getFirestore, getAuth } from '../../../lib/firebase-admin';
import { isAdminUser } from '../../../lib/auth-helpers';

/**
 * API endpoint for updating About page content
 * POST /api/content/update-about - Updates the About page content in Firestore
 * Only admin users can update content
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // Initialize Firebase Admin asynchronously
    const firestore = await getFirestore();
    const auth = await getAuth(); // Ensure getAuth is called and awaited here

    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Skip auth check in development mode if using dev token
    let userId;
    if (process.env.NODE_ENV === 'development') {
      // In development mode, accept any token
      console.log('Development mode: Skipping strict auth check for content update');
      userId = token.includes('firebase:') ? token.split(':')[1] : 'dev-admin-user';
    } else {
      try {
        const decodedToken = await auth.verifyIdToken(token);
        userId = decodedToken.uid;
      } catch (tokenError) {
        console.error('Invalid token:', tokenError);
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication token'
        });
      }
    }

    // Check if user is an admin
    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin privileges required'
      });
    }

    // Get the updated content from the request body
    const { title, content, heroImage } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    // Create or update the about page content in Firestore
    await firestore.collection('content').doc('about').set({
      title,
      content,
      heroImage: heroImage || '/images/farm-hero.jpg',
      lastUpdated: new Date().toISOString(),
      updatedBy: userId
    }, { merge: true });

    console.log('About page content updated successfully');

    return res.status(200).json({
      success: true,
      message: 'About page content updated successfully'
    });
  } catch (error) {
    console.error('Error updating about page content:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to update about page content'
    });
  }
} 