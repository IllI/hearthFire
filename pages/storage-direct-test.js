import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

export default function StorageDirectTest() {
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
      addLog('Starting upload to Firebase Storage...');

      // Create a unique file name
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const filePath = `test-uploads/${fileName}`;
      
      addLog(`Creating storage reference at: ${filePath}`);
      const storageRef = ref(storage, filePath);

      // Log storage bucket info
      addLog(`Storage bucket: ${storage.app.options.storageBucket}`);
      
      // Upload the file
      addLog('Uploading file...');
      const snapshot = await uploadBytes(storageRef, file);
      addLog(`Upload complete. Total bytes: ${snapshot.metadata.size}`);
      
      // Get the URL
      addLog('Getting download URL...');
      const url = await getDownloadURL(snapshot.ref);
      addLog(`Got download URL: ${url}`);
      
      setUploadedUrl(url);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      addLog(`ERROR: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const clearBrowserCache = () => {
    if ('caches' in window) {
      addLog('Clearing browser cache...');
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
          addLog(`Cleared cache: ${name}`);
        });
      });
    } else {
      addLog('Cache API not available in this browser');
    }
    addLog('Please manually clear browser cache and reload the page');
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Firebase Storage Direct Test</h1>
      
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
              {uploading ? 'Uploading...' : 'Upload to Firebase'}
            </button>
            
            <button
              onClick={clearBrowserCache}
              className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300"
            >
              Clear Browser Cache
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
      
      <div className="mt-6 text-sm text-gray-500">
        <h3 className="font-medium">Troubleshooting Tips:</h3>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Try disabling browser extensions, especially ad blockers</li>
          <li>Clear your browser cache or try in an incognito/private window</li>
          <li>Check browser console for additional errors</li>
          <li>Verify your Firebase Storage rules allow uploads</li>
        </ul>
      </div>
    </div>
  );
} 