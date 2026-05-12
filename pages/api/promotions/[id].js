import { getFirestore } from '../../../lib/firebase-admin';

// Helper function to verify admin auth in development mode
async function verifyAdminAuthDev(req) {
  // In development mode, always return isAdmin: true
  console.log("🔓 [DEV MODE] Skipping admin authentication");
  return { isAdmin: true, user: { email: "dev-admin@example.com" } };
}

export default async function handler(req, res) {
  try {
    // Extract promotion ID from the URL
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ success: false, error: 'Promotion ID is required' });
    }
    
    // Verify the user is an admin
    const { isAdmin, error } = await verifyAdminAuthDev(req);
    
    if (!isAdmin) {
      return res.status(401).json({ success: false, error: error || 'Unauthorized' });
    }
    
    // Route based on HTTP method
    switch (req.method) {
      case 'GET':
        return getPromotion(req, res, id);
      case 'PUT':
        return updatePromotion(req, res, id);
      case 'DELETE':
        return deletePromotion(req, res, id);
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error handling promotion request:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Get a single promotion by ID
async function getPromotion(req, res, id) {
  try {
    // Get Firestore instance
    const db = await getFirestore();
    
    const promotionDoc = await db.collection('promotions').doc(id).get();
    
    if (!promotionDoc.exists) {
      return res.status(404).json({ success: false, error: 'Promotion not found' });
    }
    
    return res.status(200).json({
      success: true,
      promotion: {
        id: promotionDoc.id,
        ...promotionDoc.data()
      }
    });
  } catch (error) {
    console.error('Error getting promotion:', error);
    return res.status(500).json({ success: false, error: 'Failed to get promotion' });
  }
}

// Update an existing promotion
async function updatePromotion(req, res, id) {
  try {
    const { type, value, description, active, expiryDate } = req.body;
    
    // Basic validation
    if (!type || (type !== 'shipping' && !value) || !description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Required fields missing' 
      });
    }
    
    // Validate type
    if (!['fixed', 'percentage', 'shipping'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid promotion type' 
      });
    }
    
    // Get Firestore instance
    const db = await getFirestore();
    
    // Check if promotion exists
    const promotionDoc = await db.collection('promotions').doc(id).get();
    
    if (!promotionDoc.exists) {
      return res.status(404).json({ success: false, error: 'Promotion not found' });
    }
    
    // Prepare promotion data
    const promotionData = {
      type,
      value: type === 'shipping' ? 0 : parseFloat(value),
      description,
      active: active !== false,
      updatedAt: new Date()
    };
    
    // Add expiry date if provided
    if (expiryDate === '') {
      // If empty string, remove the expiry date
      promotionData.expiryDate = null;
    } else if (expiryDate) {
      promotionData.expiryDate = new Date(expiryDate);
    }
    
    // Update in Firestore
    await db.collection('promotions').doc(id).update(promotionData);
    
    // In development mode, also update the mock data
    if (process.env.NODE_ENV === 'development' && global.mockPromotions) {
      console.log(`Updating promotion ${id} in mock data`);
      const existingPromoIndex = global.mockPromotions.findIndex(promo => promo.id === id);
      
      if (existingPromoIndex !== -1) {
        // Update existing promotion
        global.mockPromotions[existingPromoIndex] = {
          ...global.mockPromotions[existingPromoIndex],
          ...promotionData
        };
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Promotion updated' 
    });
  } catch (error) {
    console.error('Error updating promotion:', error);
    return res.status(500).json({ success: false, error: 'Failed to update promotion' });
  }
}

// Delete a promotion
async function deletePromotion(req, res, id) {
  try {
    // Get Firestore instance
    const db = await getFirestore();
    
    // Check if promotion exists
    const promotionDoc = await db.collection('promotions').doc(id).get();
    
    if (!promotionDoc.exists) {
      return res.status(404).json({ success: false, error: 'Promotion not found' });
    }
    
    // Get promotion data for updating mock data
    const promotionData = promotionDoc.data();
    
    // Delete from Firestore
    await db.collection('promotions').doc(id).delete();
    
    // In development mode, also update the mock data
    if (process.env.NODE_ENV === 'development' && global.mockPromotions) {
      console.log(`Removing promotion ${id} from mock data`);
      global.mockPromotions = global.mockPromotions.filter(promo => promo.id !== id);
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Promotion deleted' 
    });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete promotion' });
  }
} 