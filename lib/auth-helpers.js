/**
 * Authentication helper functions
 */

import { getFirestore } from './firebase-admin';

/**
 * Check if a user has admin privileges
 * @param {string} userId User ID to check
 * @returns {Promise<boolean>} True if the user is an admin
 */
export async function isAdminUser(userId) {
  if (!userId) return false;
  
  try {
    // For development mode, provide a fast path to admin privileges
    if (process.env.NODE_ENV === 'development') {
      // For specific development user IDs, always grant admin
      if (userId === 'dev-user-id' || userId === 'dev-admin-user') {
        console.log(`[Auth] Development mode: Admin access granted to ${userId}`);
        return true;
      }
      
      // For development, grant admin to all authenticated users
      console.log(`[Auth] Development mode: Admin access granted to ${userId} (all users are admins in dev mode)`);
      return true;
    }
    
    // Initialize Firestore
    const firestore = await getFirestore();
    
    // Query Firestore to check user role
    const userDoc = await firestore.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`[Auth] User ${userId} not found in database`);
      return false;
    }
    
    const userData = userDoc.data();
    const isAdmin = userData?.role === 'admin';
    
    if (isAdmin) {
      console.log(`[Auth] User ${userId} authenticated as admin`);
    }
    
    return isAdmin;
  } catch (error) {
    console.error(`[Auth] Error checking admin status for user ${userId}:`, error);
    return false;
  }
}

/**
 * Check if a user has permission to access an order
 * @param {string} userId User ID
 * @param {object} order Order object
 * @returns {Promise<boolean>} True if the user can access the order
 */
export async function canAccessOrder(userId, order) {
  if (!userId || !order) return false;
  
  try {
    // Admin users can access any order
    if (await isAdminUser(userId)) {
      return true;
    }
    
    // Users can access their own orders
    if (order.userId === userId) {
      return true;
    }
    
    // For development, always allow access to certain user IDs
    if (process.env.NODE_ENV === 'development' && 
        (userId === 'dev-user-id' || userId === 'test-user-id')) {
      return true;
    }
    
    // Deny access for all other cases
    return false;
  } catch (error) {
    console.error(`[Auth] Error checking order access for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get the user's role from Firebase
 * @param {string} userId User ID
 * @returns {Promise<string>} User role or 'customer' by default
 */
export async function getUserRole(userId) {
  if (!userId) return 'guest';
  
  try {
    // For development mode, provide a fast path
    if (process.env.NODE_ENV === 'development') {
      if (userId === 'dev-admin-user') return 'admin';
      if (userId === 'dev-user-id') return 'customer';
    }
    
    // Initialize Firestore
    const firestore = await getFirestore();
    
    // Get user data from Firestore
    const userDoc = await firestore.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return 'customer'; // Default role
    }
    
    const userData = userDoc.data();
    return userData?.role || 'customer';
  } catch (error) {
    console.error(`[Auth] Error getting role for user ${userId}:`, error);
    return 'customer';
  }
} 