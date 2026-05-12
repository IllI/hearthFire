import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function UploadTest() {
  const { currentUser } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [method, setMethod] = useState('debug');

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const testUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (!currentUser) {
      setError('You must be logged in to test uploads');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', file);

      // Get auth token
      const token = await currentUser.getIdToken();

      console.log(`Testing ${method} upload with file:`, {
        name: file.name,
        type: file.type,
        size: file.size
      });

      // Determine endpoint based on selected method
      let endpoint;
      switch (method) {
        case 'debug':
          endpoint = '/api/debug-upload';
          break;
        case 'basic':
          endpoint = '/api/basic-upload';
          break;
        case 'simple':
          endpoint = '/api/simple-upload';
          break;
        case 'imgbb':
          endpoint = '/api/imgbb-upload';
          break;
        case 'manual':
          endpoint = '/api/manual-upload';
          break;
        default:
          endpoint = '/api/debug-upload';
      }

      // Make the request
      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed with status ${response.status}: ${text}`);
      }

      const data = await response.json();
      
      setResult({
        success: true,
        responseTime,
        statusCode: response.status,
        data
      });
    } catch (err) {
      console.error('Upload test error:', err);
      setError(err.message);
      setResult({
        success: false,
        error: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Upload Test Page</h1>
      
      <div className="bg-white p-6 rounded shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Upload Methods</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Upload Method:
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded"
          >
            <option value="debug">Debug Endpoint</option>
            <option value="basic">Basic Upload</option>
            <option value="simple">Simple Upload</option>
            <option value="imgbb">ImgBB Upload</option>
            <option value="manual">Manual Upload</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Image File:
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full p-2 border border-gray-300 rounded"
          />
        </div>
        
        <button
          onClick={testUpload}
          disabled={loading || !file}
          className={`px-4 py-2 rounded text-white ${
            loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {loading ? 'Testing...' : 'Test Upload'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded mb-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {result && (
        <div className={`border p-4 rounded mb-6 ${
          result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <h3 className="text-lg font-medium mb-2 text-gray-800">Result</h3>
          
          <div className="bg-white p-4 rounded border overflow-hidden">
            <pre className="whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
          
          {result.success && result.data?.display_url && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Image Preview:</h4>
              <div className="border border-gray-200 rounded p-2 w-64 h-64">
                <img 
                  src={result.data.display_url} 
                  alt="Uploaded" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-8 text-center">
        <a
          href="/admin/products"
          className="text-blue-500 hover:underline"
        >
          Return to Products
        </a>
      </div>
    </div>
  );
} 