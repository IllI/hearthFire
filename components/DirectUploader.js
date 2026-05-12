import { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Component for direct Firebase Storage uploads that completely bypasses server functions
 */
export default function DirectUploader({ onUploadComplete, folder = 'products' }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadURL, setUploadURL] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      // Create a unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filename = `${timestamp}_${randomStr}_${safeName}`;
      const filePath = `${folder}/${filename}`;
      
      console.log(`[Direct Storage] Starting upload of ${file.name} (${file.size} bytes) to ${filePath}`);
      
      // Create a storage reference
      const storageRef = ref(storage, filePath);
      
      // Create upload task
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      // Monitor upload progress
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percentage = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setProgress(percentage);
          console.log(`[Direct Storage] Upload progress: ${percentage}%`);
        },
        (error) => {
          console.error('[Direct Storage] Upload error:', error);
          setError(`Upload failed: ${error.message}`);
          setUploading(false);
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('[Direct Storage] Upload successful. URL:', downloadURL);
            setUploadURL(downloadURL);
            
            if (onUploadComplete) {
              onUploadComplete(downloadURL);
            }
          } catch (urlError) {
            console.error('[Direct Storage] Error getting download URL:', urlError);
            setError(`Error getting download URL: ${urlError.message}`);
          } finally {
            setUploading(false);
          }
        }
      );
    } catch (error) {
      console.error('[Direct Storage] Upload setup error:', error);
      setError(`Upload setup error: ${error.message}`);
      setUploading(false);
    }
  };

  return (
    <div className="direct-uploader">
      <h3>Direct Firebase Storage Upload</h3>
      <div className="upload-controls">
        <input 
          type="file" 
          onChange={handleFileChange} 
          disabled={uploading}
          accept="image/*"
        />
        <button 
          onClick={handleUpload} 
          disabled={!file || uploading}
          className="upload-button"
        >
          {uploading ? 'Uploading...' : 'Upload Directly to Firebase'}
        </button>
      </div>
      
      {uploading && (
        <div className="progress-container">
          <div 
            className="progress-bar" 
            style={{ width: `${progress}%` }}
          ></div>
          <div className="progress-text">{progress}%</div>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      
      {uploadURL && (
        <div className="success-message">
          <p>Upload successful!</p>
          <div className="image-preview">
            <img src={uploadURL} alt="Uploaded file" style={{ maxWidth: '300px' }} />
          </div>
          <p className="image-url">
            URL: {uploadURL}
          </p>
        </div>
      )}
      
      <style jsx>{`
        .direct-uploader {
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
          margin-bottom: 20px;
          max-width: 500px;
        }
        
        .upload-controls {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 15px;
        }
        
        .upload-button {
          background-color: #4285f4;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .upload-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        
        .progress-container {
          height: 20px;
          background-color: #f0f0f0;
          border-radius: 4px;
          margin-bottom: 10px;
          position: relative;
        }
        
        .progress-bar {
          height: 100%;
          background-color: #4caf50;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        
        .progress-text {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          text-align: center;
          line-height: 20px;
          font-size: 12px;
          color: #333;
          text-shadow: 0 0 2px white;
        }
        
        .error-message {
          color: #d32f2f;
          margin-top: 10px;
          padding: 8px;
          background-color: #ffebee;
          border-radius: 4px;
        }
        
        .success-message {
          margin-top: 10px;
          padding: 10px;
          background-color: #e8f5e9;
          border-radius: 4px;
        }
        
        .image-preview {
          margin: 10px 0;
          text-align: center;
        }
        
        .image-url {
          word-break: break-all;
          font-size: 12px;
          background: #f5f5f5;
          padding: 5px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
} 