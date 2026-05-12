import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function StorageProxyTest() {
  const { currentUser } = useAuth();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toISOString().substring(11, 23)} - ${message}`]);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      addLog(`File selected: ${e.target.files[0].name} (${e.target.files[0].type}, ${e.target.files[0].size} bytes)`);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      addLog('No file selected');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      addLog('Starting upload via server-side proxy...');

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      
      // Get auth token if user is logged in
      let headers = {};
      if (currentUser) {
        const token = await currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
        addLog('Added authentication token to request');
      } else {
        addLog('Warning: No authentication token available');
      }
      
      // Upload via the proxy
      addLog('Sending request to /api/storage-upload...');
      const response = await fetch('/api/storage-upload', {
        method: 'POST',
        headers,
        body: formData
      });
      
      addLog(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed with status ${response.status}: ${text}`);
      }
      
      const data = await response.json();
      addLog('Upload successful');
      addLog(`URL: ${data.url}`);
      
      setUploadedUrl(data.url);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      addLog(`ERROR: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Firebase Storage Proxy Test</h1>
      <p className="mb-4 text-gray-600">
        This test page uses a server-side proxy to upload files to Firebase Storage, 
        avoiding CORS issues entirely.
      </p>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex flex-col space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Image File
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-green-50 file:text-green-700
                hover:file:bg-green-100"
            />
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className={`px-4 py-2 text-white font-medium rounded-md ${
                uploading || !file ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload via Proxy'}
            </button>
            
            <a 
              href="/admin/products"
              className="px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 inline-flex items-center"
            >
              Return to Products
            </a>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
          <h3 className="font-medium">Error</h3>
          <p>{error}</p>
        </div>
      )}
      
      {uploadedUrl && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-md mb-6">
          <h3 className="font-medium text-green-800 mb-2">Upload Successful!</h3>
          <div className="mb-4">
            <p className="text-sm text-gray-700 mb-1">Image URL:</p>
            <input
              type="text"
              readOnly
              value={uploadedUrl}
              className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
              onClick={(e) => e.target.select()}
            />
          </div>
          <div className="border border-gray-200 rounded-md p-2 bg-white">
            <img
              src={uploadedUrl}
              alt="Uploaded"
              className="max-h-64 max-w-full mx-auto"
            />
          </div>
        </div>
      )}
      
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-md">
        <h3 className="font-medium text-gray-700 mb-2">Debug Logs</h3>
        <div className="bg-gray-900 text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs yet. Select a file and upload to see logs.</p>
          ) : (
            logs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
} 