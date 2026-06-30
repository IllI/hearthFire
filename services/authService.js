import { supabase } from '../lib/supabase';

const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const toCompatUser = (user, session = null) => {
  if (!user) return null;

  const metadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};
  const displayName = metadata.display_name || metadata.name || user.email || '';

  return {
    ...user,
    uid: user.id,
    displayName,
    getIdToken: async () => {
      const currentSession = await getSession();
      return currentSession?.access_token || session?.access_token || '';
    },
    getIdTokenResult: async () => {
      const currentSession = await getSession();
      const token = currentSession?.access_token || session?.access_token || '';

      return {
        token,
        claims: {
          ...metadata,
          ...appMetadata,
          sub: user.id,
          email: user.email
        },
        expirationTime: currentSession?.expires_at
          ? new Date(currentSession.expires_at * 1000).toISOString()
          : null
      };
    }
  };
};

export const getCurrentAuthUser = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return toCompatUser(data.session?.user, data.session);
};

export const onAuthStateChanged = (callback) => {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(toCompatUser(session?.user, session));
  });

  return () => data.subscription.unsubscribe();
};

// User registration
export const registerUser = async (email, password, name, phone, role = 'customer', adminCode = '') => {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, phoneNumber: phone, role, adminCode })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || data.message || 'Registration failed' };
    }

    return {
      success: true,
      user: data.user ? toCompatUser({
        id: data.user.uid,
        email: data.user.email,
        user_metadata: { display_name: data.user.displayName },
        app_metadata: { role: data.user.role }
      }) : null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// User login
export const loginUser = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { success: true, user: toCompatUser(data.user, data.session) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// User logout
export const logoutUser = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Password reset
export const resetPassword = async (email) => {
  try {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Get current user profile from Supabase
export const getUserData = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('User not found');

    return {
      success: true,
      data: {
        ...data,
        name: data.display_name || data.email
      }
    };
  } catch (error) {
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data?.user || data.user.id !== userId) {
        throw userError || error;
      }

      const metadata = data.user.user_metadata || {};
      const appMetadata = data.user.app_metadata || {};
      const displayName = metadata.display_name || metadata.name || data.user.email;

      return {
        success: true,
        data: {
          id: data.user.id,
          email: data.user.email,
          display_name: displayName,
          name: displayName,
          role: appMetadata.role || metadata.role || 'customer',
          phone: metadata.phone || null
        }
      };
    } catch (_fallbackError) {
      return { success: false, error: error.message };
    }
  }
};

export const checkIfNoUsers = async () => {
  try {
    const response = await fetch('/api/auth/register');
    const data = await response.json();

    if (!response.ok) {
      return false;
    }

    return data.noUsers === true;
  } catch (_error) {
    return false;
  }
};
