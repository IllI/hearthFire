import { useState, useEffect } from 'react';
import AdminRoute from '../../components/AdminRoute';
import Head from 'next/head';
import Link from 'next/link';

export default function FirebaseStatus() {
  return (
    <AdminRoute>
      <FirebaseStatusContent />
    </AdminRoute>
  );
}

function FirebaseStatusContent() {
  const [status, setStatus] = useState({
    loading: true,
    error: null,
    config: {},
    environment: {},
    testResults: {}
  });

  useEffect(() => {
    checkFirebaseConfig();
  }, []);

  const checkFirebaseConfig = async () => {
    setStatus(prev => ({ ...prev, loading: true }));
    
    try {
      // Collect environment information
      const environment = {
        nodeEnv: process.env.NODE_ENV,
        storageUrl: `https://storage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'unknown'}/o`,
        timestamp: new Date().toISOString()
      };
      
      // Collect Firebase config
      const config = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unknown',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'unknown',
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Set (masked)' : '✗ Missing',
        serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? '✓ Set (masked)' : '✗ Missing'
      };
      
      // Ping API endpoints
      const testResults = {
        proxy: null,
        directStorage: null,
        firestore: null
      };
      
      // Test storage proxy
      try {
        const proxyRes = await fetch('/api/storage-proxy?path=&action=list');
        const proxyData = await proxyRes.json();
        testResults.proxy = {
          status: proxyRes.status,
          ok: proxyRes.ok,
          data: proxyData
        };
      } catch (proxyError) {
        testResults.proxy = {
          status: 'error',
          error: proxyError.message
        };
      }
      
      // Test initialize storage
      try {
        const initRes = await fetch('/api/initialize-storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authKey: 'admin123' })
        });
        const initData = await initRes.json();
        testResults.initStorage = {
          status: initRes.status,
          ok: initRes.ok,
          data: initData
        };
      } catch (initError) {
        testResults.initStorage = {
          status: 'error',
          error: initError.message
        };
      }
      
      setStatus({
        loading: false,
        error: null,
        config,
        environment,
        testResults
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.message,
        config: {},
        environment: {},
        testResults: {}
      });
    }
  };

  const createFirebaseStorage = async () => {
    setStatus(prev => ({ ...prev, creatingStorage: true }));
    
    try {
      const res = await fetch('/api/initialize-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authKey: 'admin123' })
      });
      
      const data = await res.json();
      
      setStatus(prev => ({
        ...prev,
        creatingStorage: false,
        storageCreationResult: {
          success: res.ok,
          status: res.status,
          data
        }
      }));
      
      // Refresh status after creation attempt
      checkFirebaseConfig();
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        creatingStorage: false,
        storageCreationResult: {
          success: false,
          error: error.message
        }
      }));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Firebase Status - Admin</title>
      </Head>
      
      <div className="mb-6">
        <Link href="/admin" className="text-blue-600 hover:text-blue-800">
          &larr; Back to Admin Dashboard
        </Link>
      </div>
      
      <h1 className="text-3xl font-bold mb-8">Firebase Status</h1>
      
      {status.loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : status.error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p><strong>Error:</strong> {status.error}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Firebase Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold">Project Settings</h3>
                <ul className="mt-2 space-y-1">
                  <li>Project ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{status.config.projectId}</code></li>
                  <li>Storage Bucket: <code className="bg-gray-100 px-1 py-0.5 rounded">{status.config.storageBucket}</code></li>
                  <li>API Key: <span className={status.config.apiKey.includes('✓') ? 'text-green-600' : 'text-red-600'}>{status.config.apiKey}</span></li>
                  <li>Service Account: <span className={status.config.serviceAccount.includes('✓') ? 'text-green-600' : 'text-red-600'}>{status.config.serviceAccount}</span></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Environment Info</h3>
                <ul className="mt-2 space-y-1">
                  <li>Node Environment: <code className="bg-gray-100 px-1 py-0.5 rounded">{status.environment.nodeEnv}</code></li>
                  <li>Storage URL: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{status.environment.storageUrl}</code></li>
                </ul>
              </div>
            </div>
          </section>
          
          <section className="bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Storage Proxy Test</h2>
              <button 
                onClick={checkFirebaseConfig}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                Run Tests Again
              </button>
            </div>
            
            <div className="mb-4">
              <h3 className="font-semibold">Storage Proxy Status</h3>
              <p className="mt-1">
                {status.testResults.proxy?.ok ? (
                  <span className="text-green-600">✓ Storage proxy is working</span>
                ) : (
                  <span className="text-red-600">✗ Storage proxy has errors</span>
                )}
              </p>
              
              <div className="mt-4 bg-gray-50 p-4 rounded overflow-x-auto">
                <h4 className="text-sm font-semibold mb-2">Response Details:</h4>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(status.testResults.proxy, null, 2)}
                </pre>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="font-semibold">Storage Initialization</h3>
              {status.testResults.initStorage?.ok ? (
                <div className="mt-1 text-green-600">
                  <p>✓ Storage initialization is available</p>
                </div>
              ) : (
                <div className="mt-1 text-yellow-600">
                  <p>⚠ Storage initialization has issues</p>
                </div>
              )}
              
              <div className="flex gap-4 mt-4">
                <button
                  onClick={createFirebaseStorage}
                  disabled={status.creatingStorage}
                  className={`px-4 py-2 rounded text-white ${status.creatingStorage ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {status.creatingStorage ? 'Creating...' : 'Initialize Sample Storage'}
                </button>
                
                <Link href="/admin/storage-test" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Go to Storage Test Page
                </Link>
              </div>
              
              {status.storageCreationResult && (
                <div className={`mt-4 p-4 rounded ${status.storageCreationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <h4 className="font-semibold mb-2">
                    {status.storageCreationResult.success ? 'Storage Creation Result:' : 'Storage Creation Error:'}
                  </h4>
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(status.storageCreationResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </section>
          
          <section className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Troubleshooting Steps</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">1. Create Firebase Storage Bucket</h3>
                <p className="mt-1 text-gray-700">
                  If your storage bucket doesn't exist yet, you need to create it in the Firebase Console:
                </p>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-gray-700">
                  <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Firebase Console</a></li>
                  <li>Select your project: <code className="bg-gray-100 px-1 py-0.5 rounded">{status.config.projectId}</code></li>
                  <li>Click on "Storage" in the left menu</li>
                  <li>Follow the "Get Started" wizard to set up Cloud Storage</li>
                </ol>
              </div>
              
              <div>
                <h3 className="font-semibold">2. Check Storage Rules</h3>
                <p className="mt-1 text-gray-700">
                  Make sure your storage rules allow read access. In the Firebase Console, go to Storage → Rules and add:
                </p>
                <pre className="bg-gray-100 p-3 rounded mt-2 text-sm">
{`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`}
                </pre>
              </div>
              
              <div>
                <h3 className="font-semibold">3. Set Up CORS Configuration</h3>
                <p className="mt-1 text-gray-700">
                  If you need direct access to Firebase Storage (not through the proxy), set up CORS:
                </p>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-gray-700">
                  <li>Create a file named <code className="bg-gray-100 px-1 py-0.5 rounded">cors.json</code> with:
                    <pre className="bg-gray-100 p-3 rounded mt-2 text-sm ml-6">
{`[
  {
    "origin": ["http://localhost:3000", "http://localhost:3001", "https://your-domain.com"],
    "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "x-goog-meta-*"]
  }
]`}
                    </pre>
                  </li>
                  <li>Run the gsutil command: <code className="bg-gray-100 px-1 py-0.5 rounded">gsutil cors set cors.json gs://{status.config.storageBucket}</code></li>
                </ol>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
} 