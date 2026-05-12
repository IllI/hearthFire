import { useState, useRef } from 'react';
import Image from 'next/image';
import ImageModal from './ImageModal';
import ImageDirectUploader from './ImageDirectUploader';

/**
 * Component for displaying content images with preview and edit capabilities
 * @param {Object} props
 * @param {string} props.src - Image source URL
 * @param {string} props.alt - Image alt text
 * @param {function} props.onChangeImage - Function to handle opening the media library
 * @param {function} props.onDirectUpload - Function to handle direct uploads
 */
export default function ContentImagePreview({ 
  src, 
  alt = 'Content image', 
  onChangeImage,
  onDirectUpload
}) {
  const [showModal, setShowModal] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(src);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Handle file selection
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    // Start upload immediately
    await handleUpload(selectedFile);
  };
  
  // Handle direct upload
  const handleUpload = async (file) => {
    if (!file) return;
    
    try {
      setIsUploading(true);
      
      // Create a temporary preview
      const previewUrl = URL.createObjectURL(file);
      
      // ImgBB API key
      const IMGBB_API_KEY = '1ee847a5b670d770d31ba388e577f9b8';
      
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
      
      // Create form data for ImgBB API
      const formData = new FormData();
      formData.append('key', IMGBB_API_KEY);
      formData.append('image', base64Image);
      formData.append('name', file.name);
      
      // Call ImgBB API directly from the client
      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`ImgBB API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('ImgBB API returned error');
      }
      
      // Use the direct URL from ImgBB
      const imageUrl = data.data.display_url;
      setPreviewSrc(imageUrl);
      
      if (onDirectUpload) {
        onDirectUpload(imageUrl, file);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Error uploading image: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle upload button click - this will open the file selector
  const handleUploadButtonClick = () => {
    fileInputRef.current.click();
  };
  
  return (
    <>
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        style={{ display: 'none' }} 
        accept="image/*"
      />
      
      {/* Preview Image with Responsive Design */}
      <div className="relative w-full mb-2">
        <div 
          className="relative w-full h-auto bg-gray-100 rounded-md overflow-hidden border border-gray-200 flex justify-center items-center"
          style={{ minHeight: '100px', maxHeight: '260px' }}
        >
          {isUploading ? (
            <div className="w-full h-32 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-t-blue-500 border-blue-200 rounded-full animate-spin mb-2"></div>
              <span className="text-sm text-gray-500">Uploading image...</span>
            </div>
          ) : previewSrc ? (
            <div 
              className="w-full p-2 cursor-pointer"
              onClick={() => setShowModal(true)}
            >
              <img
                src={previewSrc}
                alt={alt}
                className="mx-auto max-h-[240px] object-contain"
                style={{ display: 'block', width: 'auto' }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 flex items-center justify-center transition-opacity">
                <span className="opacity-0 hover:opacity-100 text-white bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                  Click to preview
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-32 flex items-center justify-center text-gray-400">
              <span>No image selected</span>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onChangeImage}
            className="flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Choose from Media Library
          </button>
          
          <button
            type="button"
            onClick={handleUploadButtonClick}
            className="flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm text-blue-700 bg-blue-50 hover:bg-blue-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Upload New Image
          </button>
        </div>
      </div>
      
      {/* Image Modal for full preview */}
      <ImageModal
        src={previewSrc}
        alt={alt}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        allowReplace={false}
      />
    </>
  );
} 