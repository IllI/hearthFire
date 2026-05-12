import { getFirestore, getAuth } from '../../../lib/firebase-admin';
import { serverTimestamp } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize admin services
    const firestore = await getFirestore();
    const auth = await getAuth();

    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (authError) {
      console.error('Error verifying token:', authError);
      return res.status(401).json({ error: 'Invalid authentication token', details: authError.message });
    }

    // Check if user is an admin
    let isAdmin = false;

    try {
      const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();
      isAdmin = userData && userData.role === 'admin';
    } catch (userError) {
      console.error('Error fetching user data:', userError);
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Extract data from request body
    const { id, images = [], ...productData } = req.body;

    // Verify product exists
    const productDoc = await firestore.collection('products').doc(id).get();
    if (!productDoc.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Prepare update data
    const updateData = {
      ...productData,
      updatedAt: serverTimestamp()
    };

    // Ensure price is a number
    if (updateData.price !== undefined) {
      updateData.price = Number(updateData.price);
    }

    // Ensure stock and quantity are synchronized
    if (updateData.stock !== undefined) {
      updateData.stock = Number(updateData.stock);
      updateData.quantity = updateData.stock; // Keep both fields in sync
    } else if (updateData.quantity !== undefined) {
      updateData.quantity = Number(updateData.quantity);
      updateData.stock = updateData.quantity; // Keep both fields in sync
    }

    // Set images array
    // Make sure URLs are properly formatted
    if (images && images.length > 0) {
      updateData.images = images.map(img => {
        // If it's already a full URL, use it as is
        if (img.startsWith('http://') || img.startsWith('https://')) {
          return img;
        }
        // If it's a relative path, ensure it starts with a slash
        if (!img.startsWith('/')) {
          return `/${img}`;
        }
        return img;
      });
    }

    // Update the product
    await firestore.collection('products').doc(id).update(updateData);

    // Return updated product
    return res.status(200).json({
      id,
      ...updateData,
      images: updateData.images || []
    });

  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({
      error: 'Failed to update product',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
} 