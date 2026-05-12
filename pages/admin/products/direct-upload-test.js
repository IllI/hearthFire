import { useState } from 'react';
import DirectUploader from '../../../components/DirectUploader';
import AdminLayout from '../../../components/AdminLayout';
import { useAuth } from '../../../contexts/AuthContext';

export default function DirectUploadTest() {
  const { currentUser } = useAuth();
  const [uploadedUrls, setUploadedUrls] = useState([]);

  const handleUploadComplete = (url) => {
    setUploadedUrls((prev) => [...prev, url]);
  };

  return (
    <AdminLayout title="Direct Firebase Storage Upload Test">
      <div className="container">
        <h1>Direct Firebase Storage Upload Test</h1>
        
        {!currentUser ? (
          <div className="alert alert-warning">
            You must be logged in to upload files.
          </div>
        ) : (
          <>
            <p className="description">
              This page tests direct uploads to Firebase Storage without going through server functions.
              This approach should work even for large files and avoids the 502 errors.
            </p>

            <DirectUploader onUploadComplete={handleUploadComplete} />

            {uploadedUrls.length > 0 && (
              <div className="uploaded-files">
                <h3>Successfully Uploaded Files</h3>
                <ul>
                  {uploadedUrls.map((url, index) => (
                    <li key={index}>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        
        <style jsx>{`
          .container {
            padding: 20px;
            max-width: 800px;
          }
          
          .description {
            margin-bottom: 20px;
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #4285f4;
          }
          
          .alert {
            padding: 12px 16px;
            background-color: #fff3cd;
            color: #856404;
            border-radius: 4px;
            margin-bottom: 20px;
          }
          
          .uploaded-files {
            margin-top: 30px;
            padding: 15px;
            background-color: #f0f8ff;
            border-radius: 4px;
          }
          
          .uploaded-files ul {
            padding-left: 20px;
          }
          
          .uploaded-files li {
            margin-bottom: 8px;
            word-break: break-all;
          }
          
          .uploaded-files a {
            color: #0066cc;
          }
        `}</style>
      </div>
    </AdminLayout>
  );
} 