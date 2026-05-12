import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Safe localStorage access helper
const getLocalStorageItem = (key) => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

// Safe localStorage set helper
const setLocalStorageItem = (key, value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

export default function AdminRoute({ children }) {
  const { isAdmin, loading, userData, currentUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isDevAdmin, setIsDevAdmin] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [adminAccessGranted, setAdminAccessGranted] = useState(false);
  const [authError, setAuthError] = useState(null);
  
  // Development mode helpers
  const enableDevAdminOverride = () => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      localStorage.setItem('dev-admin-override', 'true');
      localStorage.setItem('user-role', 'admin');
      setIsDevAdmin(true);
      setAdminAccessGranted(true);
      console.log('Dev admin override enabled');
    }
  };
  
  // Development mode check
  useEffect(() => {
    const checkAdminAccess = async () => {
      setIsCheckingStatus(true);
      
      // Check if in development mode
      const isDevelopmentMode = process.env.NODE_ENV === 'development';
      
      // Log initial state for debugging
      console.log('AdminRoute - Initial Auth State:', { 
        isAuthenticated, 
        isAdmin, 
        loading,
        userRole: userData?.role,
        currentUser: !!currentUser,
        pathname: router.pathname
      });
      
      if (isDevelopmentMode) {
        // Check for any stored admin override in localStorage
        const devAdmin = getLocalStorageItem('dev-admin-override');
        if (devAdmin === 'true') {
          console.log('Using development admin override');
          setIsDevAdmin(true);
          setAdminAccessGranted(true);
          setIsCheckingStatus(false);
          return;
        }
      }
      
      // Use standard auth logic after loading is done
      if (!loading) {
        // First check if user is actually logged in
        if (!isAuthenticated) {
          console.log('User is not logged in, redirecting to login');
          setAuthError('You must be logged in to access admin features');
          
          if (!isDevelopmentMode) {
            setTimeout(() => {
              router.push(`/login?redirect=${encodeURIComponent(router.pathname)}`);
            }, 1500);
          }
          setIsCheckingStatus(false);
          return;
        }
        
        // In development mode, we can enable admin override easily
        if (isDevelopmentMode && currentUser) {
          const storedRole = getLocalStorageItem('user-role');
          if (storedRole === 'admin') {
            console.log('Using stored admin role from localStorage');
            setAdminAccessGranted(true);
            setIsCheckingStatus(false);
            return;
          }
        }
        
        // Direct admin access if the user is an admin
        if (isAdmin) {
          console.log('User is verified as admin');
          setAdminAccessGranted(true);
        } else {
          console.log('Access denied: User is not an admin');
          setAuthError('You do not have admin privileges to access this page');
          
          // Only redirect if not in development mode - in dev mode we might want to debug
          if (!isDevelopmentMode) {
            setTimeout(() => {
              router.push('/');
            }, 1500);
          }
        }
        setIsCheckingStatus(false);
      }
    };
    
    checkAdminAccess();
  }, [currentUser, isAdmin, loading, userData, router, isAuthenticated]);
  
  // Show loading state
  if (loading || isCheckingStatus) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4">Verifying admin access...</p>
        </div>
      </div>
    );
  }
  
  // If there's an auth error, show it
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">{authError}</p>
          <div className="flex space-x-4">
            <Link 
              href="/login"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded inline-block"
            >
              Go to Login
            </Link>
            <Link 
              href="/"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded inline-block"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // In development mode with override or if admin access granted, show content
  if (isDevAdmin || adminAccessGranted) {
    return children;
  }
  
  // Not authorized - display a message in development mode or redirect in production
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Admin Access Required</h1>
          <p className="text-gray-600 mb-4">
            You need admin privileges to view this page. Since this is development mode,
            you can enable admin access using the button below.
          </p>
          <div className="flex flex-col space-y-4">
            <button
              onClick={enableDevAdminOverride}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Enable Admin Access (Dev Mode)
            </button>
            <button
              onClick={() => router.push('/login')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Go to Login
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // In production, you won't see this as the router.push above would redirect
  return null;
} 