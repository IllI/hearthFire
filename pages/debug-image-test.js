import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';

export default function DebugImageTest() {
  const [imageStatuses, setImageStatuses] = useState({});
  const [windowOrigin, setWindowOrigin] = useState('');

  useEffect(() => {
    setWindowOrigin(window.location.origin);
  }, []);

  // Helper to log image load status
  const handleImageLoad = (id) => {
    setImageStatuses(prev => ({
      ...prev,
      [id]: 'loaded'
    }));
  };

  const handleImageError = (id) => {
    setImageStatuses(prev => ({
      ...prev,
      [id]: 'error'
    }));
  };

  // Test sample paths
  const testImage = '/images/plants/anise-hyssop/anise-hyssop-agastache-026685.jpg';
  const testImageAbsolute = `${windowOrigin}/images/plants/anise-hyssop/anise-hyssop-agastache-026685.jpg`;
  
  return (
    <AdminLayout title="Image Debug Page">
      <div className="p-8 bg-white shadow-md rounded-lg">
        <h1 className="text-2xl font-bold mb-6">Image Loading Test Page</h1>
        <p className="mb-4">
          This page tests various ways to load images and helps diagnose issues with image paths and loading.
        </p>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Environment Information</h2>
          <div className="bg-gray-100 p-4 rounded">
            <p><strong>Window Origin:</strong> {windowOrigin}</p>
            <p><strong>Build Date:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Test 1: Relative Path */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold mb-2">Test 1: Relative Path</h3>
            <p className="text-sm mb-2">Path: {testImage}</p>
            <p className="text-xs text-gray-500 mb-4">Status: {imageStatuses.test1 || 'loading'}</p>
            
            <div className="h-48 bg-gray-100 flex items-center justify-center relative overflow-hidden rounded-lg">
              <img
                src={testImage}
                alt="Test 1"
                className="object-cover w-full h-full"
                onLoad={() => handleImageLoad('test1')}
                onError={() => handleImageError('test1')}
              />
              {imageStatuses.test1 === 'error' && (
                <div className="absolute inset-0 bg-red-100 bg-opacity-80 flex items-center justify-center">
                  <p className="text-red-600 font-bold">Failed to load image</p>
                </div>
              )}
            </div>
          </div>

          {/* Test 2: Absolute Path */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold mb-2">Test 2: Absolute Path</h3>
            <p className="text-sm mb-2">Path: {testImageAbsolute}</p>
            <p className="text-xs text-gray-500 mb-4">Status: {imageStatuses.test2 || 'loading'}</p>
            
            <div className="h-48 bg-gray-100 flex items-center justify-center relative overflow-hidden rounded-lg">
              <img
                src={testImageAbsolute}
                alt="Test 2"
                className="object-cover w-full h-full"
                onLoad={() => handleImageLoad('test2')}
                onError={() => handleImageError('test2')}
              />
              {imageStatuses.test2 === 'error' && (
                <div className="absolute inset-0 bg-red-100 bg-opacity-80 flex items-center justify-center">
                  <p className="text-red-600 font-bold">Failed to load image</p>
                </div>
              )}
            </div>
          </div>

          {/* Test 3: Direct Access */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold mb-2">Test 3: Direct Image Link Test</h3>
            <p className="text-sm mb-2">Direct link to image:</p>
            <a 
              href={testImageAbsolute} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Open direct image link
            </a>
          </div>

          {/* Test 4: Cache Busting */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold mb-2">Test 4: Cache Busting</h3>
            <p className="text-sm mb-2">Path: {`${testImage}?t=${Date.now()}`}</p>
            <p className="text-xs text-gray-500 mb-4">Status: {imageStatuses.test4 || 'loading'}</p>
            
            <div className="h-48 bg-gray-100 flex items-center justify-center relative overflow-hidden rounded-lg">
              <img
                src={`${testImage}?t=${Date.now()}`}
                alt="Test 4"
                className="object-cover w-full h-full"
                onLoad={() => handleImageLoad('test4')}
                onError={() => handleImageError('test4')}
              />
              {imageStatuses.test4 === 'error' && (
                <div className="absolute inset-0 bg-red-100 bg-opacity-80 flex items-center justify-center">
                  <p className="text-red-600 font-bold">Failed to load image</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
} 