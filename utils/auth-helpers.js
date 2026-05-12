import { auth } from '../lib/firebase-admin';

/**
 * Verifies Firebase Auth token from request headers
 * @param {Object} req - Next.js request object
 * @returns {Promise<Object|null>} User object if valid, null if invalid
 */
export async function verifyAuthToken(req) {
  try {
    // Check if Authorization header exists
    if (!req.headers.authorization) {
      console.log('[Auth] No authorization header found');
      return null;
    }

    // Extract the token from the Authorization header
    // Format: "Bearer {token}"
    const token = req.headers.authorization.split('Bearer ')[1];
    if (!token) {
      console.log('[Auth] Token format invalid');
      return null;
    }

    // Verify the token with Firebase Admin
    const decodedToken = await auth.verifyIdToken(token);
    
    if (!decodedToken || !decodedToken.uid) {
      console.log('[Auth] Invalid token');
      return null;
    }

    console.log(`[Auth] Successfully verified token for user: ${decodedToken.uid}`);
    return decodedToken;
  } catch (error) {
    console.error('[Auth] Error verifying token:', error);
    return null;
  }
}

/**
 * Checks if the user has admin permissions
 * @param {Object} user - Firebase user object
 * @returns {Promise<boolean>} True if admin, false otherwise
 */
export async function isAdmin(user) {
  if (!user || !user.uid) return false;
  
  try {
    // Get user claims
    const userRecord = await auth.getUser(user.uid);
    const customClaims = userRecord.customClaims || {};
    
    return customClaims.admin === true;
  } catch (error) {
    console.error('[Auth] Error checking admin status:', error);
    return false;
  }
} 