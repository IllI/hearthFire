import { supabaseAdmin } from './supabase-admin';

const isDevelopment = process.env.NODE_ENV === 'development';

// Admin authentication middleware
export async function verifyAdminAccess(req, res) {
  // Skip authentication in development mode if env variable is set
  if (isDevelopment && process.env.SKIP_ADMIN_AUTH === 'true') {
    console.log('🔓 [DEV MODE] Skipping admin authentication');
    return {
      isAuthenticated: true,
      isAdmin: true,
      user: {
        uid: 'dev-admin-override',
        email: 'dev-admin@example.com',
        role: 'admin'
      }
    };
  }

  // Check for Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Allow bypass in development mode with special query parameter
    if (isDevelopment && req.query.admin_dev_bypass === 'true') {
      console.log('🔓 [DEV MODE] Using admin bypass via query parameter');
      return {
        isAuthenticated: true,
        isAdmin: true,
        user: {
          uid: 'dev-admin-override',
          email: 'dev-admin@example.com',
          role: 'admin'
        }
      };
    }

    return {
      isAuthenticated: false,
      isAdmin: false,
      error: 'Missing or invalid authentication token'
    };
  }

  // Extract and verify the token
  try {
    const token = authHeader.substring(7);

    // Handle special development tokens
    if (isDevelopment && token === 'admin-override-token') {
      console.log('🔓 [DEV MODE] Using admin override token');
      return {
        isAuthenticated: true,
        isAdmin: true,
        user: {
          uid: 'dev-admin-override',
          email: 'dev-admin@example.com',
          role: 'admin'
        }
      };
    }

    // Verify the token with Supabase Auth
    const decodedToken = await verifyIdToken(token);
    console.log(`✅ Authenticated user: ${decodedToken.uid}`);

    // Check admin status
    let isAdmin = false;

    // In development, always grant admin access to authenticated users
    if (isDevelopment) {
      isAdmin = true;
      console.log('🔓 [DEV MODE] Granting admin access to authenticated user');
    } else {
      // In production, check against Supabase profiles or a small fallback email list.
      const adminEmails = ['admin@example.com', 'test@test.com'];
      isAdmin = adminEmails.includes(decodedToken.email);

      try {
        const { data: profile, error } = await supabaseAdmin
          .from('user_profiles')
          .select('role')
          .eq('id', decodedToken.uid)
          .single();

        if (!error && profile?.role === 'admin') {
          isAdmin = true;
        }
      } catch (error) {
        console.warn('Error checking Supabase profile for admin role:', error.message);
      }
    }

    console.log(`👤 User ${decodedToken.email || decodedToken.uid} admin status: ${isAdmin}`);

    return {
      isAuthenticated: true,
      isAdmin,
      user: {
        ...decodedToken,
        role: isAdmin ? 'admin' : 'user'
      }
    };
  } catch (error) {
    console.error('🔒 Authentication error:', error.message);
    return {
      isAuthenticated: false,
      isAdmin: false,
      error: `Authentication failed: ${error.message}`
    };
  }
}

// Wrapper for API routes that require admin access
export function withAdminAuth(handler) {
  return async (req, res) => {
    const auth = await verifyAdminAccess(req, res);

    if (!auth.isAuthenticated) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: auth.error || 'Authentication required'
      });
    }

    if (!auth.isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }

    // Add the user to the request object
    req.user = auth.user;

    // Call the original handler
    return handler(req, res);
  };
}

// Simple middleware for checking authentication without admin requirement
export function withAuth(handler) {
  return async (req, res) => {
    const auth = await verifyAdminAccess(req, res);

    if (!auth.isAuthenticated) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: auth.error || 'Authentication required'
      });
    }

    // Add the user to the request object
    req.user = auth.user;

    // Call the original handler
    return handler(req, res);
  };
}

/**
 * Verifies a Firebase ID token for API routes
 * @param {string} token - The Firebase ID token to verify
 * @param {Object} options - Optional verification options
 * @returns {Promise<Object>} - The decoded token claims
 */
export async function verifyIdToken(token, options = {}) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw error || new Error('Invalid authentication token');
  }

  return {
    uid: data.user.id,
    email: data.user.email,
    role: data.user.app_metadata?.role || data.user.user_metadata?.role,
    app_metadata: data.user.app_metadata,
    user_metadata: data.user.user_metadata
  };
}

/**
 * Gets a user record by ID
 * @param {string} uid - The user ID
 * @returns {Promise<Object>} - The user record
 */
export async function getUser(uid) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(uid);
  if (error) throw error;
  return data.user;
}

export default {
  verifyAdminAccess,
  withAdminAuth,
  withAuth
}; 
