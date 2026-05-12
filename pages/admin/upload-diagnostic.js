import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';

export default function UploadDiagnostic() {
  const { currentUser } = useAuth();
  const [dirInfo, setDirInfo] = useState(null);
  const [dirLoading, setDirLoading] = useState(false);
  const [dirError, setDirError] = useState(null);
  
  const [testUploadResult, setTestUploadResult] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  const fileInputRef = useRef(null);
  
  // Check upload directories
  const checkDirectories = async () => {
    setDirLoading(true);
    setDirError(null);
    
    try {
      const response = await fetch('/api/check-upload-dir');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Directory check failed: ${errorText}`);
      }
      
      const data = await response.json();
      setDirInfo(data);
    } catch (error) {
      console.error('Error checking directories:', error);
      setDirError(error.message);
    } finally {
      setDirLoading(false);
    }
  };
  
  // Test basic upload
  const testBasicUpload = async (e) => {
    e.preventDefault();
    
    if (!fileInputRef.current.files.length) {
      setUploadError('Please select a file to upload');
      return;
    }
    
    setUploadLoading(true);
    setUploadError(null);
    setTestUploadResult(null);
    
    const file = fileInputRef.current.files[0];
    
    try {
      // Get auth token
      const token = await currentUser.getIdToken();
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', 'test-uploads');
      
      // Log debug info
      console.log('Starting test upload:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
      
      // Send to basic v2 endpoint
      const response = await fetch('/api/fallback-upload-basic-v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      console.log('Upload response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Unknown error' };
        }
        throw new Error(errorData.error || `Upload failed (${response.status})`);
      }
      
      const data = await response.json();
      console.log('Upload successful:', data);
      setTestUploadResult(data);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError(error.message);
    } finally {
      setUploadLoading(false);
    }
  };
  
  // Run directory check on page load
  useEffect(() => {
    if (currentUser) {
      checkDirectories();
    }
  }, [currentUser]);
  
  if (!currentUser) {
    return (
      <Layout>
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-4">Upload Diagnostic</h1>
          <p className="text-red-500">Please log in to access this page.</p>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Upload Directory Diagnostic</h1>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Directory Check</h2>
          <button
            onClick={checkDirectories}
            disabled={dirLoading}
            className="mb-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {dirLoading ? 'Checking...' : 'Check Upload Directories'}
          </button>
          
          {dirError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Error:</p>
              <p>{dirError}</p>
            </div>
          )}
          
          {dirInfo && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Directory Status:</p>
              <pre className="mt-2 overflow-auto">{JSON.stringify(dirInfo, null, 2)}</pre>
            </div>
          )}
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Test Upload</h2>
          <form onSubmit={testBasicUpload}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="file">
                Select a file to upload:
              </label>
              <input
                type="file"
                id="file"
                ref={fileInputRef}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            
            <button
              type="submit"
              disabled={uploadLoading}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
            >
              {uploadLoading ? 'Uploading...' : 'Test Basic Upload'}
            </button>
          </form>
          
          {uploadError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              <p className="font-bold">Upload Error:</p>
              <p>{uploadError}</p>
            </div>
          )}
          
          {testUploadResult && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mt-4">
              <p className="font-bold">Upload Successful:</p>
              <pre className="mt-2 overflow-auto">{JSON.stringify(testUploadResult, null, 2)}</pre>
              
              {testUploadResult.url && (
                <div className="mt-4">
                  <p className="font-bold">Image Preview:</p>
                  <img 
                    src={testUploadResult.url} 
                    alt="Uploaded file preview" 
                    className="mt-2 max-w-lg max-h-64 border border-gray-300" 
                  />
                </div>
              )}
            </div>
          )}
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-3">Debug Information</h2>
          <div className="bg-gray-100 border border-gray-300 rounded p-4">
            <p><strong>Node.js Runtime:</strong> {process.env.NODE_ENV}</p>
            <p><strong>Current User:</strong> {currentUser?.email}</p>
            <p><strong>Server Timestamp:</strong> {new Date().toISOString()}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
} 