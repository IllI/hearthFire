import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/AdminLayout';
import { useAuth } from '../../../contexts/AuthContext';
import ImageDirectUploader from '../../../components/ImageDirectUploader';

export default function FixImageUpload() {
  const router = useRouter();
  const { currentUser, isAdmin } = useAuth();
  
  const [uploadedImages, setUploadedImages] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [corsStatus, setCorsStatus] = useState('unknown');
  const [testInProgress, setTestInProgress] = useState(false);
  
  // Check authentication
  useEffect(() => {
    if (!currentUser) {
      // If not logged in, wait 1 second and then redirect to login
      const timer = setTimeout(() => {
        router.push('/login?redirect=/admin/products/fix-image-upload');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [currentUser, router]);

  // Handle CORS test
  const testCors = async () => {
    try {
      setTestInProgress(true);
      setCorsStatus('testing');
      
      // A simple OPTIONS request to test CORS
      const response = await fetch(
        'https://firebasestorage.googleapis.com/v0/b/hearthfire-farms.appspot.com/o?prefix=test', 
        { 
          method: 'OPTIONS',
          headers: {
            'Origin': window.location.origin,
            'Access-Control-Request-Method': 'GET'
          }
        }
      );
      
      if (response.ok) {
        setCorsStatus('success');
      } else {
        setCorsStatus('failed');
      }
    } catch (error) {
      console.error('Error testing CORS:', error);
      setCorsStatus('error');
    } finally {
      setTestInProgress(false);
    }
  };

  // Handle upload complete
  const handleUploadComplete = (downloadUrl, file) => {
    setUploadedImages(prev => [...prev, {
      url: downloadUrl,
      name: file.name,
      timestamp: new Date().toISOString()
    }]);
  };

  if (!currentUser) {
    return (
      <AdminLayout title="Fix Image Upload">
        <div className="container">
          <h1>Fix Image Upload</h1>
          <div className="alert alert-warning">
            You must be logged in to access this page. Redirecting to login...
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Fix Image Upload">
      <div className="container">
        <h1>Fix Image Upload</h1>
        
        <div className="card">
          <div className="card-header">
            <h2>CORS Configuration Test</h2>
          </div>
          <div className="card-body">
            <p>
              Before uploading, let's test if CORS is properly configured for Firebase Storage.
              This will check if your browser can communicate directly with Firebase Storage.
            </p>
            
            <button
              className={`test-button ${corsStatus}`}
              onClick={testCors}
              disabled={testInProgress}
            >
              {testInProgress ? 'Testing...' : 'Test CORS Configuration'}
            </button>
            
            {corsStatus !== 'unknown' && (
              <div className={`cors-status ${corsStatus}`}>
                {corsStatus === 'success' && (
                  <p>Success! CORS is properly configured for direct uploads.</p>
                )}
                {corsStatus === 'failed' && (
                  <p>
                    CORS check failed. You may need to configure CORS for your Firebase Storage bucket.
                    Run the following commands:
                    <pre>
                      {`firebase init storage
gsutil cors set cors.json gs://hearthfire-farms.appspot.com`}
                    </pre>
                  </p>
                )}
                {corsStatus === 'error' && (
                  <p>Error testing CORS. There might be a network issue or another problem.</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h2>Direct Upload Test</h2>
          </div>
          <div className="card-body">
            <p>
              This uploader component uses Firebase Storage client SDK to upload directly from your browser.
              It completely bypasses any server-side code, avoiding the 502 errors.
            </p>
            
            <ImageDirectUploader 
              onUploadComplete={handleUploadComplete}
              buttonText="Upload Directly to Firebase Storage"
            />
          </div>
        </div>
        
        {uploadedImages.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2>Successfully Uploaded Images</h2>
            </div>
            <div className="card-body">
              <div className="uploads-grid">
                {uploadedImages.map((image, index) => (
                  <div key={index} className="upload-item">
                    <div className="upload-preview">
                      <img src={image.url} alt={image.name} />
                    </div>
                    <div className="upload-details">
                      <div className="upload-filename">{image.name}</div>
                      <div className="upload-timestamp">{image.timestamp}</div>
                      <a href={image.url} target="_blank" rel="noopener noreferrer" className="upload-link">
                        View Full Size
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <div className="guide-section">
          <h2>Troubleshooting Guide</h2>
          
          <div className="guide-item">
            <h3>1. CORS Issues</h3>
            <p>
              If you're seeing CORS errors in the console, you need to configure CORS for your Firebase Storage bucket.
              Create a file named <code>cors.json</code> with the content as shown above, then run the gsutil command.
            </p>
          </div>
          
          <div className="guide-item">
            <h3>2. Authentication Issues</h3>
            <p>
              Make sure you are logged in as an admin user. Check Firebase Storage rules to ensure they allow writes to the products folder.
            </p>
          </div>
          
          <div className="guide-item">
            <h3>3. Check Storage Rules</h3>
            <p>
              Your Firebase Storage rules should allow authenticated users to upload. A basic rule could be:
            </p>
            <pre>
{`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read;
      allow write: if request.auth != null;
    }
  }
}`}
            </pre>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .container {
          padding: 20px;
          max-width: 1000px;
        }
        
        h1 {
          margin-bottom: 20px;
        }
        
        .card {
          margin-bottom: 30px;
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .card-header {
          background-color: #f5f5f5;
          padding: 15px 20px;
          border-bottom: 1px solid #ddd;
        }
        
        .card-header h2 {
          margin: 0;
          font-size: 18px;
        }
        
        .card-body {
          padding: 20px;
        }
        
        .test-button {
          background-color: #4285f4;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-bottom: 15px;
        }
        
        .test-button:hover {
          background-color: #3367d6;
        }
        
        .test-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        
        .cors-status {
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .cors-status.success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        
        .cors-status.failed, .cors-status.error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        
        .cors-status pre {
          background-color: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
          overflow-x: auto;
        }
        
        .alert {
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        
        .alert-warning {
          background-color: #fff3cd;
          color: #856404;
          border: 1px solid #ffeeba;
        }
        
        .uploads-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
        }
        
        .upload-item {
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .upload-preview {
          height: 200px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f5f5f5;
        }
        
        .upload-preview img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        
        .upload-details {
          padding: 10px;
        }
        
        .upload-filename {
          font-weight: bold;
          margin-bottom: 5px;
          word-break: break-all;
        }
        
        .upload-timestamp {
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }
        
        .upload-link {
          display: inline-block;
          margin-top: 5px;
          color: #4285f4;
          text-decoration: none;
        }
        
        .guide-section {
          margin-top: 40px;
        }
        
        .guide-item {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        
        .guide-item h3 {
          margin-bottom: 10px;
        }
        
        .guide-item pre {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
        }
      `}</style>
    </AdminLayout>
  );
} 