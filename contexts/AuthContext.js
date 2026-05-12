import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserData, registerUser, loginUser, logoutUser, resetPassword } from '../services/authService';
const AuthContext = createContext();

const isBrowser = typeof window !== 'undefined';

const getLocalStorageItem = (key) => {
  if (isBrowser) {
    return localStorage.getItem(key);
  }
  return null;
};

const setLocalStorageItem = (key, value) => {
  if (isBrowser) {
    localStorage.setItem(key, value);
  }
};

const removeLocalStorageItem = (key) => {
  if (isBrowser) {
    localStorage.removeItem(key);
  }
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminVerified, setAdminVerified] = useState(false);
  const [isAdminOverrideActive, setIsAdminOverrideActive] = useState(false);

  useEffect(() => {
    // Check for dev override
    if (process.env.NODE_ENV === 'development') {
      const override = getLocalStorageItem('dev-admin-override') === 'true';
      setIsAdminOverrideActive(override);

      const storedRole = getLocalStorageItem('user-role');
      if (storedRole === 'admin') {
        setAdminVerified(true);
      }
    }

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? user.email : 'No user');

      if (user) {
        setCurrentUser(user);

        // Fetch additional user data from Firestore
        try {
          const { success, data } = await getUserData(user.uid);
          if (success && data) {
            setUserData(data);
            if (data.role === 'admin') {
              setLocalStorageItem('user-role', 'admin');
              setAdminVerified(true);
            }
          }
        } catch (error) {
          console.error('Error fetching user data on auth change:', error);
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
        if (process.env.NODE_ENV !== 'development') {
          setAdminVerified(false);
          removeLocalStorageItem('user-role');
        }
      }

      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const signup = async (email, password, userData) => {
    const { name, phone, role, adminCode } = userData;

    if (role === 'admin' && adminCode !== process.env.NEXT_PUBLIC_ADMIN_CODE) {
      return { success: false, error: 'Invalid admin code' };
    }

    const result = await registerUser(email, password, name, phone, role);

    if (result.success) {
      setCurrentUser(result.user);
      if (role === 'admin') {
        setLocalStorageItem('user-role', 'admin');
        setAdminVerified(true);
      }
    }

    return result;
  };

  const login = async (email, password) => {
    const result = await loginUser(email, password);

    if (result.success) {
      setCurrentUser(result.user);
      const { success, data } = await getUserData(result.user.uid);
      if (success) {
        setUserData(data);
        if (data.role === 'admin') {
          setLocalStorageItem('user-role', 'admin');
          setAdminVerified(true);
        } else {
          removeLocalStorageItem('user-role');
          setAdminVerified(false);
        }
      }
    }

    return result;
  };

  const logout = async () => {
    if (process.env.NODE_ENV !== 'development') {
      removeLocalStorageItem('user-role');
      setAdminVerified(false);
    }
    const result = await logoutUser();
    if (result.success) {
      setCurrentUser(null);
      setUserData(null);
    }
    return result;
  };

  const resetUserPassword = async (email) => {
    return resetPassword(email);
  };

  const isAdmin = userData?.role === 'admin' || adminVerified || isAdminOverrideActive;

  const value = {
    currentUser,
    userData,
    isAdmin,
    isAuthenticated: !!currentUser,
    loading,
    signup,
    login,
    logout,
    resetPassword: resetUserPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}