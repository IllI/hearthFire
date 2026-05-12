import admin, { getAuth, getFirestore } from '../lib/firebase-admin';

/**
 * Verifies a Firebase ID token
 * @param {string} token - The Firebase ID token to verify
 * @returns {Promise<Object>} The decoded token
 */
export async function verifyIdToken(token) {
  if (!token) {
    throw new Error('No token provided');
  }
  
  try {
    // In development mode, accept a special admin override token
    if (process.env.NODE_ENV === 'development' && token === 'admin-override-token') {
      return { 
        uid: 'admin-override',
        email: 'admin@example.com',
        admin: true
      };
    }
    
    // Get Auth instance
    const auth = await getAuth();
    
    // Verify the token with Firebase Admin
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying auth token:', error);
    throw error;
  }
}

/**
 * Checks if a user has admin privileges
 * @param {string} uid - The user ID to check
 * @returns {Promise<boolean>} Whether the user is an admin
 */
export async function isUserAdmin(uid) {
  if (!uid) return false;
  
  // In development mode, we might want special handling
  if (process.env.NODE_ENV === 'development' && uid === 'admin-override') {
    return true;
  }
  
  try {
    // Get Firestore instance
    const firestore = await getFirestore();
    
    const userDoc = await firestore.collection('users').doc(uid).get();
    
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    return userData.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
} 