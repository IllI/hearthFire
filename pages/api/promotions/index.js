import { getFirestore } from '../../../lib/firebase-admin';
import { nanoid } from 'nanoid';

// Helper function to verify admin auth in development mode
async function verifyAdminAuthDev(req) {
  // In development mode, always return isAdmin: true
  console.log("🔓 [DEV MODE] Skipping admin authentication");
  return { isAdmin: true, user: { email: "dev-admin@example.com" } };
}

export default async function handler(req, res) {
  try {
    // Verify the user is an admin
    const { isAdmin, error } = await verifyAdminAuthDev(req);
    
    if (!isAdmin) {
      return res.status(401).json({ success: false, error: error || 'Unauthorized' });
    }
    
    if (req.method === 'GET') {
      return getPromotions(req, res);
    } else if (req.method === 'POST') {
      return createPromotion(req, res);
    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error handling promotion request:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Get all promotions
async function getPromotions(req, res) {
  try {
    // Initialize default mock promotions if needed
    if (process.env.NODE_ENV === 'development' && (!global.mockPromotions || global.mockPromotions.length === 0)) {
      console.log('Creating default mock promotions');
      global.mockPromotions = [
        { 
          id: 'promo-1', 
          code: 'TEST25',
          type: 'percentage',
          value: 25,
          description: 'Test promotion: 25% off your order',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          id: 'promo-2', 
          code: 'FREEDEL',
          type: 'shipping',
          value: 0,
          description: 'Free delivery on your order',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          id: 'promo-3', 
          code: 'WELCOME10',
          type: 'fixed',
          value: 10,
          description: '$10 off your first order',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    }

    // Get Firestore instance
    const db = await getFirestore();

    // Get promotions from Firestore
    const promotionsSnapshot = await db.collection('promotions').get();
    console.log(`Retrieved ${promotionsSnapshot.size} promotions from Firestore`);
    
    // Convert to array
    const firestorePromotions = [];
    promotionsSnapshot.forEach(doc => {
      firestorePromotions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Found ${firestorePromotions.length} promotions in Firestore`);
    
    // Use Firestore data, not mock data
    return res.status(200).json({ success: true, promotions: firestorePromotions });
  } catch (error) {
    console.error('Error getting promotions:', error);
    return res.status(500).json({ success: false, error: 'Failed to get promotions' });
  }
}

// Create a new promotion
async function createPromotion(req, res) {
  try {
    const { code, type, value, description, active, expiryDate } = req.body;
    
    // Basic validation
    if (!code || !type || (type !== 'shipping' && !value) || !description) {
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
    
    // Convert code to uppercase
    const upperCode = code.toUpperCase();
    
    // Get Firestore instance
    const db = await getFirestore();
    
    // Check if promo code already exists
    const existingPromo = await db.collection('promotions')
      .where('code', '==', upperCode)
      .get();
    
    if (!existingPromo.empty) {
      return res.status(400).json({ 
        success: false, 
        error: 'Promotion code already exists' 
      });
    }
    
    // Prepare promotion data
    const promotionData = {
      code: upperCode,
      type,
      value: type === 'shipping' ? 0 : parseFloat(value),
      description,
      active: active !== false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add expiry date if provided
    if (expiryDate) {
      promotionData.expiryDate = new Date(expiryDate);
    }
    
    // Generate a unique ID for the new promotion
    const id = nanoid(10);
    
    // Save to Firestore
    await db.collection('promotions').doc(id).set(promotionData);
    
    // In development mode, also update the mock data
    if (process.env.NODE_ENV === 'development' && global.mockPromotions) {
      console.log(`Adding new promotion ${upperCode} to mock data`);
      global.mockPromotions.push({
        id,
        ...promotionData
      });
    }
    
    return res.status(201).json({ 
      success: true, 
      message: 'Promotion created',
      id
    });
  } catch (error) {
    console.error('Error creating promotion:', error);
    return res.status(500).json({ success: false, error: 'Failed to create promotion' });
  }
} 