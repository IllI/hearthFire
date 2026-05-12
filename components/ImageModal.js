import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import ImageDirectUploader from './ImageDirectUploader';
import { uploadImageToImgBB } from '../utils/imgbbStorage';

/**
 * Modal component for displaying enlarged images with replacement functionality
 * @param {Object} props
 * @param {string} props.src - Image source URL
 * @param {string} props.alt - Image alt text
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Function to close the modal
 * @param {function} props.onReplace - Function to handle image replacement
 * @param {boolean} props.allowReplace - Whether to show image replacement UI
 * @param {number} props.imageIndex - Index of the image in the collection (for replacement)
 */
export default function ImageModal({
  src,
  alt,
  isOpen,
  onClose,
  onReplace,
  allowReplace = true,
  imageIndex = 0
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Create ref to track modal state to avoid redundant rerenders
  const modalRef = useRef(null);

  // Mark component as mounted to prevent state updates before mount
  useEffect(() => {
    setHasMounted(true);
    return () => setHasMounted(false);
  }, []);

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen && hasMounted) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setError(null);
      setUploading(false);
    }
  }, [isOpen, hasMounted]);

  // Close modal when ESC key is pressed
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // Close modal when clicking outside the image
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleFileSelected = (file) => {
    setSelectedFile(file);
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUploadComplete = (imageUrl) => {
    if (onReplace) {
      console.log("Upload successful, URL:", imageUrl);
      onReplace(imageUrl);
    }

    // Clean up any created object URLs to prevent memory leaks
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    onClose();
  };

  const handleCancel = () => {
    // Clean up any created object URLs
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    onClose();
  };

  const handleCustomFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const uploadToImgBB = async (file) => {
    // This function is no longer used for replacement, but kept for reference or other modes
    if (!file) return;
    try {
      const imageUrl = await uploadImageToImgBB(file);
      handleUploadComplete(imageUrl);
    } catch (err) {
      console.error('[ImgBB] Upload error:', err);
    }
  };

  if (!isOpen) return null;

  // Default placeholder image as base64
  const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f0f0f0'/%3E%3Cpath d='M80 100 L120 100 M100 80 L100 120' stroke='%23cccccc' stroke-width='8'/%3E%3C/svg%3E";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
      ref={modalRef}
    >
      <div className="bg-white rounded-lg max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Replace Image</h3>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
          <div className="border rounded-md p-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Current Image</h4>
            <div className="aspect-square relative bg-gray-100 flex items-center justify-center rounded overflow-hidden">
              {src ? (
                <img
                  src={src}
                  alt={alt || 'Current image'}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    console.log("Image failed to load:", src);
                    e.target.onerror = null;
                    e.target.src = placeholderImage;
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <p className="text-sm">No image available</p>
                </div>
              )}
            </div>
          </div>

          {previewUrl ? (
            <div className="border rounded-md p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">New Image</h4>
              <div className="aspect-square relative bg-gray-100 flex items-center justify-center rounded overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Preview of new image"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="mt-3 flex gap-2 justify-end">
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    setSelectedFile(null);
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                >
                  Cancel
                </button>

                <button
                  onClick={async () => {
                    if (selectedFile) {
                      setUploading(true);
                      setError(null);
                      try {
                        // Upload to ImgBB first, then pass the URL to onReplace
                        const imageUrl = await uploadImageToImgBB(selectedFile);
                        console.log('[ImageModal] Upload successful, URL:', imageUrl);
                        if (onReplace) {
                          onReplace(imageUrl);
                        }
                        // Clean up preview URL
                        if (previewUrl) {
                          URL.revokeObjectURL(previewUrl);
                        }
                        onClose();
                      } catch (err) {
                        console.error('[ImageModal] Upload error:', err);
                        setError(`Upload failed: ${err.message}`);
                      } finally {
                        setUploading(false);
                      }
                    }
                  }}
                  disabled={uploading}
                  className={`px-3 py-1.5 text-sm text-white rounded ${uploading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  {uploading ? 'Uploading...' : 'Confirm Replace'}
                </button>
              </div>
            </div>
          ) : (
            <div className="border rounded-md p-3 flex flex-col items-center justify-center">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Select New Image</h4>
              <div
                className="w-full aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all"
                onClick={() => document.getElementById('file-upload-modal').click()}
              >
                <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                <p className="text-sm text-gray-500">Click to select an image</p>
                <p className="text-xs text-gray-400 mt-1">or drag and drop</p>

                <input
                  id="file-upload-modal"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleCustomFileSelect}
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 text-red-600 text-sm rounded">
            {error}
          </div>
        )}

        <div className="mt-4 text-right">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md mr-2 hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 