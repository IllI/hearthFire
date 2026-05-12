import { getFirestore } from '../../../lib/firebase-admin';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    // Extract the promo code from request body
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'Promo code is required' });
    }
    
    // Convert code to uppercase for consistency
    const upperCode = code.toUpperCase();
    
    console.log(`Validating promo code: ${upperCode}`);
    
    // Get Firestore instance
    const db = await getFirestore();
    
    // Query Firestore for the promo code
    const promoSnapshot = await db.collection('promotions')
      .where('code', '==', upperCode)
      .get();
    
    if (promoSnapshot.empty) {
      console.log(`Promo code not found: ${upperCode}`);
      return res.status(404).json({ success: false, error: 'Invalid promo code' });
    }
    
    // Get the first matching promo code
    const promoDoc = promoSnapshot.docs[0];
    const promoData = promoDoc.data();
    console.log(`Found promo code: ${upperCode}`, promoData);
    
    // Check if the promotion is active
    if (!promoData.active) {
      console.log(`Promo code inactive: ${upperCode}`);
      return res.status(400).json({ success: false, error: 'This promotion code is no longer active' });
    }
    
    // Check if the promotion has expired
    if (promoData.expiryDate) {
      const expiryDate = promoData.expiryDate.toDate ? 
        promoData.expiryDate.toDate() : 
        new Date(promoData.expiryDate);
      
      if (expiryDate < new Date()) {
        console.log(`Promo code expired: ${upperCode}`);
        return res.status(400).json({ success: false, error: 'This promotion has expired' });
      }
    }
    
    // Return the validated promo code information
    console.log(`Promo code valid: ${upperCode}`);
    return res.status(200).json({
      success: true,
      promo: {
        id: promoDoc.id,
        code: promoData.code,
        type: promoData.type,
        value: promoData.value,
        description: promoData.description
      }
    });
    
  } catch (error) {
    console.error('Error validating promo code:', error);
    return res.status(500).json({ success: false, error: 'Failed to validate promo code' });
  }
} 