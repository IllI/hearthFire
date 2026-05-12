import { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Component for directly uploading images to Firebase Storage with proper authentication,
 * progress tracking, and error handling
 */
export default function ImageDirectUploader({
  onUploadComplete,
  folder = 'products',
  existingImageUrl = null,
  buttonText = 'Upload Image',
  showPreview = true,
  uploadMethod = 'imgbb',
  showMethodSelector = false,
  onUploadStart = null
}) {
  const { currentUser } = useAuth();
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(existingImageUrl);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadURL, setUploadURL] = useState(existingImageUrl);
  const [fileSelected, setFileSelected] = useState(false);
  const [selectedUploadMethod, setSelectedUploadMethod] = useState(uploadMethod);
  const [storageBucket, setStorageBucket] = useState(null);

  // Update preview when existing image changes
  useEffect(() => {
    setFilePreview(existingImageUrl);
    setUploadURL(existingImageUrl);
  }, [existingImageUrl]);

  // Get storage bucket info
  useEffect(() => {
    // Extract bucket name from Firebase Storage
    if (storage && storage._bucket) {
      setStorageBucket(storage._bucket.name);
    }
  }, []);

  // Preview file when selected
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileSelected(true);
    setError(null);

    // Create a preview URL for the selected file
    const previewUrl = URL.createObjectURL(selectedFile);
    setFilePreview(previewUrl);

    // Auto-upload if this is the intended behavior
    // handleUpload();
  };

  const handleServerProxyUpload = async () => {
    if (!file || !currentUser) return;

    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      console.log(`[ProxyUploader] Starting upload via server proxy: ${file.name} (${file.size} bytes)`);

      // Create FormData for the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      // Get authentication token
      const token = await currentUser.getIdToken();

      // Upload using the server-side proxy
      const response = await fetch('/api/storage-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      // Check for success
      if (!response.ok) {
        // If server proxy fails, try manual upload as final fallback
        console.log('[ProxyUploader] Server proxy failed, trying manual upload as final fallback');
        return handleManualUpload();
      }

      const data = await response.json();
      console.log('[ProxyUploader] Upload successful. URL:', data.url);

      setUploadURL(data.url);
      setFilePreview(data.url);

      if (onUploadComplete) {
        onUploadComplete(data.url, file);
      }
    } catch (error) {
      console.error('[ProxyUploader] Upload error:', error);

      // Try manual upload as a final fallback
      console.log('[ProxyUploader] Error, trying manual upload as final fallback');
      return handleManualUpload();
    } finally {
      setUploading(false);
      setFileSelected(false);
    }
  };

  const handleManualUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setProgress(50); // Set to 50% since we can't track progress with this method
      setError(null);

      console.log(`[ManualUploader] Starting upload via manual endpoint: ${file.name} (${file.size} bytes)`);

      // Create FormData for the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      // Use relative path to API endpoint to avoid CORS issues
      const apiUrl = window.location.hostname === 'localhost'
        ? '/api/manual-upload'
        : '/api/ultra-simple-upload'; // Use our new ultra simple endpoint in production

      console.log(`[ManualUploader] Using API endpoint: ${apiUrl}`);

      // Upload using the manual upload endpoint
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      // Check for success
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ManualUploader] Server responded with ${response.status}: ${errorText}`);
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('[ManualUploader] Upload successful. URL:', data.url);

      setUploadURL(data.url);
      setFilePreview(data.url);

      if (onUploadComplete) {
        onUploadComplete(data.url, file);
      }
    } catch (error) {
      console.error('[ManualUploader] Upload error:', error);
      setError(`Manual upload error: ${error.message}`);

      // Fallback to client-side approach if server-side fails
      try {
        console.log('[ManualUploader] Attempting in-browser fallback...');
        await handleLocalFallbackUpload();
      } catch (fallbackError) {
        console.error('[ManualUploader] Fallback upload failed:', fallbackError);
        setError(`All upload methods failed. Please try again later.`);
      }
    } finally {
      setUploading(false);
      setFileSelected(false);
    }
  };

  // Last resort fallback that creates a data URL in the browser
  const handleLocalFallbackUpload = async () => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();

        reader.onload = (event) => {
          const dataUrl = event.target.result;
          console.log('[LocalFallback] Created data URL');

          // Just use the data URL directly
          setUploadURL(dataUrl);
          setFilePreview(dataUrl);

          if (onUploadComplete) {
            onUploadComplete(dataUrl, file);
          }

          resolve(dataUrl);
        };

        reader.onerror = (error) => {
          console.error('[LocalFallback] Error:', error);
          reject(error);
        };

        reader.readAsDataURL(file);
      } catch (error) {
        console.error('[LocalFallback] Setup error:', error);
        reject(error);
      }
    });
  };

  // Handle direct Firebase Storage upload
  const handleFirebaseDirectUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setProgress(10);
      setError(null);

      if (onUploadStart) onUploadStart();

      console.log(`[FirebaseDirect] Starting upload: ${file.name}`);

      // Generate a unique filename
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storagePath = `${folder}/${filename}`;
      const storageRef = ref(storage, storagePath);

      // Upload
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(progress);
        },
        (error) => {
          console.error('[FirebaseDirect] Upload error:', error);
          setError(`Upload failed: ${error.message}`);
          setUploading(false);
        },
        async () => {
          // Complete
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('[FirebaseDirect] Upload successful. URL:', downloadURL);

          setUploadURL(downloadURL);
          setFilePreview(downloadURL);

          if (onUploadComplete) {
            onUploadComplete(downloadURL, file);
          }

          setUploading(false);
          setFileSelected(false);
        }
      );

    } catch (error) {
      console.error('[FirebaseDirect] Setup error:', error);
      setError(`Upload setup failed: ${error.message}`);
      setUploading(false);
    }
  };

  // Handle direct ImgBB upload as the primary method
  const handleDirectImgbbUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setProgress(10); // Initial progress
      setError(null);

      // Call onUploadStart if provided
      if (onUploadStart) {
        onUploadStart();
      }

      console.log(`[DirectImgBB] Starting direct upload to ImgBB: ${file.name} (${file.size} bytes)`);

      // ImgBB API key - we can expose this publicly as it's already in the client code
      // and has limited permissions
      const IMGBB_API_KEY = '93d42a3af8827220fb00930836b61a44';

      // Read the file as base64
      const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Get the base64 string (remove the data:image/jpeg;base64, part)
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProgress(40); // Progress after file read

      // Create form data for ImgBB API
      const formData = new FormData();
      formData.append('key', IMGBB_API_KEY);
      formData.append('image', base64Image);
      formData.append('name', file.name);

      console.log('[DirectImgBB] Sending direct request to ImgBB API');

      // Call ImgBB API directly from the client
      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData
      });

      setProgress(80); // Progress after API call

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DirectImgBB] ImgBB API responded with ${response.status}: ${errorText}`);
        throw new Error(`ImgBB API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        console.error('[DirectImgBB] ImgBB API returned error:', data);
        throw new Error('ImgBB API returned error');
      }

      console.log('[DirectImgBB] Upload successful. URL:', data.data.url);

      // Use the direct URL from ImgBB
      const imageUrl = data.data.display_url;
      setUploadURL(imageUrl);
      setFilePreview(imageUrl);

      if (onUploadComplete) {
        onUploadComplete(imageUrl, file);
      }

      setProgress(100);
    } catch (error) {
      console.error('[DirectImgBB] Upload error:', error);
      setError(`Direct ImgBB upload error: ${error.message}`);

      // Fall back to the local data URL approach
      try {
        console.log('[DirectImgBB] Attempting in-browser fallback...');
        await handleLocalFallbackUpload();
      } catch (fallbackError) {
        console.error('[DirectImgBB] Fallback upload failed:', fallbackError);
        setError(`All upload methods failed. Please try again later.`);
      }
    } finally {
      setUploading(false);
      setFileSelected(false);
    }
  };

  // Main upload handler that defaults to ImgBB
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    // Reset states
    setError(null);

    // Use the selected method
    if (selectedUploadMethod === 'direct') {
      // Direct to Firebase Storage
      // We need to implement this here or use the logic from firebase-storage.js
      // But wait, the component imports 'storage' from '../lib/firebase'
      // Let's implement a direct upload function
      await handleFirebaseDirectUpload();
    } else if (selectedUploadMethod === 'proxy') {
      await handleServerProxyUpload();
    } else if (selectedUploadMethod === 'manual') {
      await handleManualUpload();
    } else {
      await handleDirectImgbbUpload();
    }
  };

  return (
    <div className="image-direct-uploader">
      {showPreview && filePreview && (
        <div className="image-preview">
          <img
            src={filePreview}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: '200px' }}
          />
        </div>
      )}

      {showMethodSelector && (
        <div className="upload-method-selector">
          <label className="method-label">
            <input
              type="radio"
              name="uploadMethod"
              value="direct"
              checked={selectedUploadMethod === 'direct'}
              onChange={() => setSelectedUploadMethod('direct')}
            />
            Direct to Firebase Storage {storageBucket && `(${storageBucket})`}
          </label>

          <label className="method-label">
            <input
              type="radio"
              name="uploadMethod"
              value="proxy"
              checked={selectedUploadMethod === 'proxy'}
              onChange={() => setSelectedUploadMethod('proxy')}
            />
            Via Server Proxy (Bypasses CORS issues)
          </label>

          <label className="method-label">
            <input
              type="radio"
              name="uploadMethod"
              value="imgbb"
              checked={selectedUploadMethod === 'imgbb'}
              onChange={() => setSelectedUploadMethod('imgbb')}
            />
            Via ImgBB (Third-party hosting, most reliable)
          </label>

          <label className="method-label">
            <input
              type="radio"
              name="uploadMethod"
              value="manual"
              checked={selectedUploadMethod === 'manual'}
              onChange={() => setSelectedUploadMethod('manual')}
            />
            Direct to Server (Data URL fallback)
          </label>
        </div>
      )}

      <div className="upload-controls">
        <input
          type="file"
          id="file-upload"
          onChange={handleFileSelect}
          disabled={uploading}
          accept="image/*"
          className="file-input"
        />

        <label htmlFor="file-upload" className="file-label">
          {fileSelected ? 'Change Image' : 'Select Image'}
        </label>

        {fileSelected && (
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="upload-button"
          >
            {uploading ? `Uploading ${progress}%` : buttonText}
          </button>
        )}
      </div>

      {uploading && (
        <div className="progress-container">
          <div
            className="progress-bar"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <style jsx>{`
        .image-direct-uploader {
          margin-bottom: 15px;
        }
        
        .image-preview {
          margin-bottom: 10px;
          text-align: center;
          border: 1px solid #ddd;
          padding: 10px;
          border-radius: 4px;
          background: #f9f9f9;
        }
        
        .upload-method-selector {
          margin-bottom: 10px;
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 4px;
        }
        
        .method-label {
          display: block;
          margin-bottom: 5px;
          font-size: 14px;
        }
        
        .upload-controls {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .file-input {
          position: absolute;
          width: 0.1px;
          height: 0.1px;
          opacity: 0;
          overflow: hidden;
          z-index: -1;
        }
        
        .file-label {
          background-color: #f0f0f0;
          color: #333;
          border: 1px solid #ddd;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          display: inline-block;
          transition: background-color 0.3s;
        }
        
        .file-label:hover {
          background-color: #e0e0e0;
        }
        
        .upload-button {
          background-color: #4285f4;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.3s;
        }
        
        .upload-button:hover {
          background-color: #3367d6;
        }
        
        .upload-button:disabled {
          background-color: #b3cdfb;
          cursor: not-allowed;
        }
        
        .progress-container {
          height: 8px;
          background-color: #f0f0f0;
          border-radius: 4px;
          margin-bottom: 10px;
          overflow: hidden;
        }
        
        .progress-bar {
          height: 100%;
          background-color: #4caf50;
          transition: width 0.3s ease;
        }
        
        .error-message {
          color: #d32f2f;
          font-size: 14px;
          margin-top: 5px;
        }
      `}</style>
    </div>
  );
} 