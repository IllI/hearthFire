import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function DevTools() {
  const [isDevMode, setIsDevMode] = useState(false);
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [firestoreStatus, setFirestoreStatus] = useState('unknown');
  const [apiTestResult, setApiTestResult] = useState(null);
  const router = useRouter();
  
  useEffect(() => {
    // Only enable in development mode
    setIsDevMode(process.env.NODE_ENV === 'development');
    
    // Check if admin mode is already enabled
    if (typeof window !== 'undefined') {
      const devAdmin = localStorage.getItem('dev-admin-override');
      setAdminEnabled(devAdmin === 'true');
      
      // Check firestore mock status with a simple API call
      checkFirestoreStatus();
    }
  }, []);
  
  // Check Firestore status by making a simple API call
  const checkFirestoreStatus = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          Authorization: 'Bearer dev-token'
        }
      });
      
      if (response.ok) {
        setFirestoreStatus('mock');
      } else {
        setFirestoreStatus('error');
      }
    } catch (error) {
      console.error('Error checking Firestore status:', error);
      setFirestoreStatus('error');
    }
  };

  const testAdminApi = async () => {
    setApiTestResult({ status: 'loading' });
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          Authorization: 'Bearer admin-override-token'
        }
      });
      
      const data = await response.json();
      
      setApiTestResult({
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        data: data
      });
    } catch (error) {
      console.error('API test error:', error);
      setApiTestResult({
        status: 'error',
        message: error.message
      });
    }
  };

  const enableAdminMode = () => {
    localStorage.setItem('dev-admin-override', 'true');
    localStorage.setItem('user-role', 'admin');
    setAdminEnabled(true);
  };

  const disableAdminMode = () => {
    localStorage.removeItem('dev-admin-override');
    localStorage.removeItem('user-role');
    setAdminEnabled(false);
  };

  const redirectToAdmin = () => {
    router.push('/admin');
  };
  
  const redirectToLogin = () => {
    router.push('/login');
  };

  // Prevent rendering in production
  if (!isDevMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Development Tools Unavailable</h1>
          <p className="text-gray-600 mb-4">
            These tools are only available in development mode.
          </p>
          <Link href="/" className="inline-block bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="border-b pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Development Tools</h1>
          <p className="text-gray-600">
            These tools are intended for development purposes only.
          </p>
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-yellow-700 font-medium">Development Mode Active</p>
              <p className="text-yellow-700 text-sm">
                These options should only be used during development. They
                will not work in production.
              </p>
            </div>
          </div>
        </div>
        
        {/* API Tester */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">API Access Tester</h2>
          <div className="bg-gray-50 p-4 rounded">
            <p className="mb-4 text-gray-700">
              Test direct access to the admin API endpoints to troubleshoot authentication issues
            </p>
            <button 
              onClick={testAdminApi}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-4"
            >
              Test Admin API Access
            </button>
            
            {apiTestResult && (
              <div className={`mt-4 p-3 rounded ${
                apiTestResult.status === 'loading' ? 'bg-blue-100' :
                apiTestResult.status === 'success' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <h3 className="font-medium mb-2">
                  {apiTestResult.status === 'loading' ? 'Testing API...' :
                   apiTestResult.status === 'success' ? 'API Test Successful' : 'API Test Failed'}
                </h3>
                {apiTestResult.statusCode && (
                  <p className="text-sm mb-1">Status code: {apiTestResult.statusCode}</p>
                )}
                {apiTestResult.message && (
                  <p className="text-sm mb-1">Error: {apiTestResult.message}</p>
                )}
                {apiTestResult.data && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Response data:</p>
                    <pre className="bg-gray-200 p-2 rounded text-xs mt-1 overflow-x-auto">
                      {JSON.stringify(apiTestResult.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Firebase Status */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Firebase Status</h2>
          <div className="bg-gray-50 p-4 rounded">
            <p className="mb-2 font-medium">
              Firebase Mode: {' '}
              <span className={firestoreStatus === 'mock' ? 'text-green-600' : 'text-red-600'}>
                {firestoreStatus === 'mock' ? 'Using Mock Implementation' : 
                 firestoreStatus === 'error' ? 'Error Connecting' : 'Checking...'}
              </span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              In development mode, Firebase APIs use a mock implementation to allow testing without real Firebase credentials.
            </p>
            <button
              onClick={checkFirestoreStatus}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Status
            </button>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Admin Access</h2>
          <div className="bg-gray-50 p-4 rounded">
            <p className="mb-4">
              {adminEnabled
                ? "✅ Admin mode is currently ENABLED."
                : "❌ Admin mode is currently DISABLED."}
            </p>
            <div className="flex space-x-4 mb-4">
              <button
                onClick={enableAdminMode}
                disabled={adminEnabled}
                className={`px-4 py-2 rounded ${
                  adminEnabled
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                Enable Admin Mode
              </button>
              <button
                onClick={disableAdminMode}
                disabled={!adminEnabled}
                className={`px-4 py-2 rounded ${
                  !adminEnabled
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                Disable Admin Mode
              </button>
            </div>
            <div className="text-sm text-gray-600 border-t pt-4">
              <p className="font-medium mb-2">How Admin Mode Works:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>When enabled, this sets a special flag in localStorage.</li>
                <li>The AdminRoute component checks for this flag in development mode.</li>
                <li>API endpoints accept special tokens in development mode for testing admin features.</li>
              </ol>
            </div>
          </div>
        </div>

        {adminEnabled && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
            <div className="flex space-x-4">
              <button
                onClick={redirectToAdmin}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Go to Admin Dashboard
              </button>
              <button
                onClick={redirectToLogin}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Go to Login Page
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
} 