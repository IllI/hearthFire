import { getFirestore, getAuth } from '../../../lib/firebase-admin';
import { isAdminUser } from '../../../lib/auth-helpers';

/**
 * API endpoint for updating Home page content
 * POST /api/content/update-home - Updates the Home page content in Firestore
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
    const auth = await getAuth();

    // Verify authentication via Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;

    // Verify the user is authenticated
    try {
      decodedToken = await auth.verifyIdToken(token);
      const uid = decodedToken.uid;

      // Check if the user is an admin
      // Try custom claims first, then fallback to Firestore check
      let isAdmin = decodedToken.admin === true;

      if (!isAdmin) {
        const userDoc = await firestore.collection('users').doc(uid).get();
        const userData = userDoc.data();
        isAdmin = userData && userData.role === 'admin';
      }

      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required' });
      }
    } catch (authError) {
      console.error('Authentication error:', authError);
      return res.status(401).json({ success: false, error: 'Invalid authentication' });
    }

    const uid = decodedToken.uid;
    // Get the updated content from the request body
    const { title, subtitle, mainImage, ctaButton, sections } = req.body;

    // Validate required fields
    if (!title || !subtitle) {
      return res.status(400).json({
        success: false,
        error: 'Title and subtitle are required'
      });
    }

    // Create or update the home page content in Firestore
    await firestore.collection('content').doc('home').set({
      title,
      subtitle,
      mainImage: mainImage || null,
      ctaButton: ctaButton || {
        text: 'Browse Produce',
        link: '/products'
      },
      sections: sections || [],
      lastUpdated: new Date().toISOString(),
      updatedBy: uid
    }, { merge: true });

    console.log('Home page content updated successfully');

    return res.status(200).json({
      success: true,
      message: 'Home page content updated successfully'
    });
  } catch (error) {
    console.error('Error updating home page content:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to update home page content'
    });
  }
} 