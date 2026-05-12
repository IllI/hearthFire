import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ImageModal from './ImageModal';

/**
 * Helper component for managing multiple product images
 */
export default function ImageUploadHelper({
  images = [],
  onNewImage,
  onRemoveImage,
  onMakePrimary,
  onRecoverImage,
  productId = null
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [deletedImages, setDeletedImages] = useState([]);
  const router = useRouter();

  // Load deleted images from localStorage on component mount
  useEffect(() => {
    try {
      const storedImages = localStorage.getItem('deletedImages');
      if (storedImages) {
        // If we have a productId, only load images for this product
        const parsedImages = JSON.parse(storedImages);
        if (productId) {
          const productImages = parsedImages.filter(item => item.productId === productId);
          setDeletedImages(productImages);
        } else {
          // Load all recent deleted images (limited to 20)
          setDeletedImages(parsedImages.slice(0, 20));
        }
      }
    } catch (error) {
      console.error('Error loading deleted images from localStorage', error);
    }
  }, [productId]);

  const handleAddImage = (imageUrl) => {
    if (onNewImage) {
      onNewImage(imageUrl);
    }
  };

  const handleRemoveImage = (index) => {
    if (onRemoveImage) {
      // Store the removed image in localStorage before removing it
      const imageToRemove = images[index];
      const timestamp = new Date().toISOString();
      
      const newDeletedImage = {
        url: imageToRemove,
        timestamp,
        productId: productId || router.query.id || 'unknown'
      };
      
      // Add to component state
      setDeletedImages(prev => [newDeletedImage, ...prev].slice(0, 20));
      
      // Add to localStorage
      try {
        const storedImages = localStorage.getItem('deletedImages');
        const parsedImages = storedImages ? JSON.parse(storedImages) : [];
        const updatedImages = [newDeletedImage, ...parsedImages].slice(0, 50); // Limit to 50 most recent
        localStorage.setItem('deletedImages', JSON.stringify(updatedImages));
      } catch (error) {
        console.error('Error saving deleted image to localStorage', error);
      }
      
      // Call the parent handler
      onRemoveImage(index);
    }
  };

  const handleMakePrimary = (index) => {
    if (onMakePrimary) {
      onMakePrimary(index);
    }
  };

  const handleRecoverImage = (url) => {
    if (onRecoverImage) {
      // Remove from deleted images list
      setDeletedImages(prev => prev.filter(item => item.url !== url));
      
      // Update localStorage
      try {
        const storedImages = localStorage.getItem('deletedImages');
        if (storedImages) {
          const parsedImages = JSON.parse(storedImages);
          const updatedImages = parsedImages.filter(item => item.url !== url);
          localStorage.setItem('deletedImages', JSON.stringify(updatedImages));
        }
      } catch (error) {
        console.error('Error updating localStorage after recovery', error);
      }
      
      // Call the parent handler
      onRecoverImage(url);
    }
  };

  const openImageModal = (image) => {
    setSelectedImage(image);
    setShowModal(true);
  };

  const handleImageReplace = (newImageUrl) => {
    // Find the index of the image being replaced
    const index = images.findIndex(img => img === selectedImage);
    
    if (index !== -1) {
      // Store the replaced image in deletedImages
      const timestamp = new Date().toISOString();
      
      const newDeletedImage = {
        url: selectedImage,
        timestamp,
        productId: productId || router.query.id || 'unknown'
      };
      
      // Add to component state
      setDeletedImages(prev => [newDeletedImage, ...prev].slice(0, 20));
      
      // Add to localStorage
      try {
        const storedImages = localStorage.getItem('deletedImages');
        const parsedImages = storedImages ? JSON.parse(storedImages) : [];
        const updatedImages = [newDeletedImage, ...parsedImages].slice(0, 50);
        localStorage.setItem('deletedImages', JSON.stringify(updatedImages));
      } catch (error) {
        console.error('Error saving replaced image to localStorage', error);
      }
      
      // Remove the old image and add the new one at the same position
      const newImages = [...images];
      newImages[index] = newImageUrl;
      
      // Update the parent component directly
      if (onRemoveImage && onNewImage) {
        // First remove the old image
        onRemoveImage(index);
        // Then add the new image
        setTimeout(() => {
          onNewImage(newImageUrl);
          // If it was the primary image, make the new one primary
          if (index === 0 && onMakePrimary) {
            // We need to find where the new image was added (usually at the end)
            setTimeout(() => {
              const newIndex = images.length - 1;
              onMakePrimary(newIndex);
            }, 0);
          }
        }, 0);
      }
    }
    
    setShowModal(false);
    setSelectedImage(null);
  };

  return (
    <div className="space-y-4">
      {/* Current Images */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((image, index) => (
            <div 
              key={`${image}-${index}`} 
              className={`relative group border rounded-lg overflow-hidden ${index === 0 ? 'border-green-500 shadow-md' : 'border-gray-200'}`}
            >
              <div className="aspect-square relative bg-gray-50">
                <img 
                  src={image}
                  alt={`Product image ${index + 1}`}
                  className="w-full h-full object-cover"
                  onClick={() => openImageModal(image)}
                />
              </div>
              
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex space-x-1">
                  <button
                    onClick={() => openImageModal(image)}
                    className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    title="View or replace image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  
                  {index !== 0 && (
                    <button
                      onClick={() => handleMakePrimary(index)}
                      className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      title="Make primary image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                    title="Remove image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {index === 0 && (
                <div className="absolute top-0 left-0 bg-green-500 text-white text-xs px-1 py-0.5">
                  Primary
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Upload New Image Button */}
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setSelectedImage(null) || setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Image
        </button>
      </div>
      
      {/* Recently Deleted Images */}
      {deletedImages.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Recently Deleted Images</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 border rounded-md p-3 bg-gray-50">
            {deletedImages.map((item, index) => (
              <div key={`${item.url}-${index}`} className="relative group">
                <div className="aspect-square relative bg-gray-200 rounded overflow-hidden">
                  <img 
                    src={item.url}
                    alt={`Deleted image ${index + 1}`}
                    className="w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity"
                  />
                </div>
                
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleRecoverImage(item.url)}
                    className="p-1.5 bg-indigo-500 text-white rounded-full hover:bg-indigo-600"
                    title="Recover image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 truncate">
                  {new Date(item.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Image Modal */}
      <ImageModal
        src={selectedImage}
        alt="Product Image"
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onReplace={handleImageReplace}
      />
    </div>
  );
} 