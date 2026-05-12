import { initAdminAsync } from '../../../lib/firebase-admin';

/**
 * API endpoint for fetching metadata for all content pages
 * GET /api/content - Returns metadata for all content pages from Firestore
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
    console.log('Content API: Ensuring Firebase Admin is initialized...');
    const admin = await initAdminAsync();
    const firestore = admin.firestore();
    
    console.log('Content API: Firebase Admin initialized, fetching content...');
    // Get a list of all documents in the content collection
    const contentSnapshot = await firestore.collection('content').get();
    
    // If there are no content pages, return an empty array
    if (contentSnapshot.empty) {
      console.log('No content pages found in Firestore');
      
      return res.status(200).json({
        success: true,
        pages: []
      });
    }
    
    // Map the documents to page metadata objects
    const contentPages = contentSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        lastUpdated: data.lastUpdated,
        updatedBy: data.updatedBy || null
      };
    });
    
    console.log(`Retrieved ${contentPages.length} content pages from Firestore`);
    
    return res.status(200).json({
      success: true,
      pages: contentPages
    });
  } catch (error) {
    console.error('Error fetching content pages:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch content pages'
    });
  }
} 