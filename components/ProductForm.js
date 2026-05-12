import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Image from 'next/image';
import ImageModal from './ImageModal';
import { uploadImageToImgBB } from '../utils/imgbbStorage';

export default function ProductForm({ product = null, isEdit = false }) {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();

  // Create a reference of the initial form data to compare for changes
  const initialFormData = useRef({
    name: '',
    description: '',
    price: '',
    category: '',
    inventory: '',
    unit: 'each',
    organic: false,
    featured: false,
    images: []
  });

  const [formData, setFormData] = useState({ ...initialFormData.current });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formChanged, setFormChanged] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState({ src: '', alt: '', index: 0 });
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  // Fetch available categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Failed to fetch products for categories');

        const products = await response.json();
        // Extract unique categories
        const categories = [...new Set(products.map(product => product.category).filter(Boolean))];
        setAvailableCategories(categories.sort());
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    }

    fetchCategories();
  }, []);

  // If editing, populate form with product data
  useEffect(() => {
    if (isEdit && product) {
      setImagesLoading(true);
      console.log('Populating form with product data:', product);

      // Get inventory value - check all possible property names
      const inventoryValue =
        product.stock !== undefined ? product.stock :
          product.inventory !== undefined ? product.inventory :
            product.quantity !== undefined ? product.quantity : 0;

      const initialData = {
        name: product.name || '',
        description: product.description || '',
        price: product.price ? product.price.toString() : '',
        category: product.category || '',
        inventory: inventoryValue ? inventoryValue.toString() : '0',
        unit: product.unit || 'each',
        organic: product.organic || false,
        featured: product.featured || false,
        images: product.images || []
      };

      // Store the initial data for change detection
      initialFormData.current = { ...initialData };

      // Set the form data
      setFormData(initialData);

      // Set preview images from product
      if (product.images && product.images.length > 0) {
        console.log('Setting preview images:', product.images);

        // Make sure images are properly normalized URLs
        const normalizedImages = product.images.map(img => {
          console.log('Processing image URL:', img);

          // If it's already a full URL, use it as is
          if (img.startsWith('http://') || img.startsWith('https://')) {
            console.log('Image is already a full URL');
            return img;
          }

          // If it's a relative path, make it absolute
          if (img.startsWith('/')) {
            const fullUrl = `${window.location.origin}${img}`;
            console.log('Converting relative path with leading slash to:', fullUrl);
            return fullUrl;
          }

          // Otherwise assume it's a relative path without leading slash
          const fullUrl = `${window.location.origin}/${img}`;
          console.log('Converting relative path without leading slash to:', fullUrl);
          return fullUrl;
        });

        console.log('Normalized image URLs:', normalizedImages);
        setPreviewImages(normalizedImages);
      } else {
        console.log('No images found in product data');
        setPreviewImages([]);
      }

      setImagesLoading(false);
    }
  }, [isEdit, product]);

  // Check for form changes
  useEffect(() => {
    if (!isEdit) {
      // Always enable the button for new products
      setFormChanged(true);
      return;
    }

    // Compare current form data with initial data to detect changes
    const hasChanges = Object.keys(formData).some(key => {
      // For arrays (like images), check length and content
      if (Array.isArray(formData[key])) {
        if (formData[key].length !== initialFormData.current[key].length) return true;
        return formData[key].some((item, index) => item !== initialFormData.current[key][index]);
      }

      // For regular values
      return formData[key] !== initialFormData.current[key];
    });

    // Also check if we have new uploaded images
    const hasNewImages = uploadedImages.length > 0;

    setFormChanged(hasChanges || hasNewImages);
  }, [formData, uploadedImages, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);

    // Preview images
    const newPreviewImages = files.map(file => URL.createObjectURL(file));
    setPreviewImages(prev => [...prev, ...newPreviewImages]);

    // Store files for upload
    setUploadedImages(prev => [...prev, ...files]);
  };

  const removeImage = (index) => {
    // Remove from preview
    setPreviewImages(prev => prev.filter((_, i) => i !== index));

    if (index < formData.images.length) {
      // Remove existing image
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));
    } else {
      // Remove uploaded image
      const uploadedIndex = index - formData.images.length;
      setUploadedImages(prev => prev.filter((_, i) => i !== uploadedIndex));
    }
  };

  const openImageModal = (src, alt, index) => {
    setModalImage({ src, alt, index });
    setModalOpen(true);
  };

  const closeImageModal = () => {
    setModalOpen(false);
  };

  // Handle replacing an existing image with a new one (receives URL from ImageModal after upload)
  // This now immediately saves to the database like the products list page does
  const replaceImage = async (newImageUrl, imageIndex) => {
    console.log("[ProductForm] Processing image replacement with URL:", newImageUrl, "at index:", imageIndex);

    if (!currentUser) {
      console.error('[ProductForm] No user logged in');
      return false;
    }

    setReplaceLoading(true);

    try {
      // Build updated images array
      let updatedImages = [...formData.images];

      if (imageIndex !== undefined && imageIndex < updatedImages.length) {
        // Replace existing image at index
        updatedImages[imageIndex] = newImageUrl;
      } else {
        // Add as new image (append to end, or set as first if no images)
        updatedImages.push(newImageUrl);
      }

      // If this is an edit of an existing product, save immediately to database
      if (isEdit && product?.id) {
        const token = await currentUser.getIdToken();

        const updateResponse = await fetch(`/api/products/${product.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...product,
            image: updatedImages[0], // Primary image
            images: updatedImages
          })
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('[ProductForm] Failed to save image:', errorText);
          throw new Error('Failed to save image to database');
        }

        console.log('[ProductForm] Image saved to database successfully');
      }

      // Update local state
      setFormData(prev => ({
        ...prev,
        images: updatedImages,
        primaryImage: updatedImages[0]
      }));

      // Update preview images
      setPreviewImages(updatedImages);

      // Update modal to show new image
      setModalImage(prev => ({ ...prev, src: newImageUrl }));

      return true;
    } catch (error) {
      console.error('[ProductForm] Error replacing image:', error);
      throw error;
    } finally {
      setReplaceLoading(false);
    }
  };

  // Handle adding a new image (opens modal with empty source)
  const addNewImage = () => {
    // Open modal with null source to indicate adding new image
    const newIndex = formData.images?.length || 0;
    setModalImage({ src: null, alt: 'Add new image', index: newIndex });
    setModalOpen(true);
  };

  const uploadImagesToStorage = async () => {
    if (uploadedImages.length === 0) return formData.images;

    const imageUrls = [...formData.images];

    for (const file of uploadedImages) {
      try {
        // Check if currentUser exists before uploading
        if (!currentUser) {
          throw new Error('You must be logged in to upload images');
        }

        console.log("[Storage] Uploading image directly to Firebase Storage:", file.name);

        // Use the direct Firebase Storage upload utility
        const downloadUrl = await uploadImageToImgBB(file, 'products');
        console.log("[Storage] Direct upload successful, URL:", downloadUrl);

        // Add URL to the list
        imageUrls.push(downloadUrl);
      } catch (error) {
        console.error('[Storage] Error uploading image:', error);
        // Continue with other uploads even if one fails
      }
    }

    return imageUrls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Check authentication status first
    if (!currentUser) {
      setError('You must be logged in as an admin to save products');
      setLoading(false);
      setTimeout(() => {
        router.push('/login?redirect=/admin/products/new');
      }, 2000);
      return;
    }

    // Check admin status
    if (!isAdmin) {
      setError('You must have admin privileges to save products');
      setLoading(false);
      return;
    }

    try {
      // Don't convert price to cents, leave as is since price is already in correct format from the Products table
      const price = parseFloat(formData.price);

      // Upload images
      const imageUrls = await uploadImagesToStorage();

      // Convert inventory to number
      const inventoryCount = parseInt(formData.inventory) || 0;

      // Prepare product data
      const productData = {
        name: formData.name,
        description: formData.description,
        price: price,
        category: formData.category,
        stock: inventoryCount,
        quantity: inventoryCount,
        unit: formData.unit,
        organic: formData.organic,
        featured: formData.featured,
        images: imageUrls
      };

      // Set main image to the first image in the array for backward compatibility
      if (imageUrls && imageUrls.length > 0) {
        productData.image = imageUrls[0];
        console.log("[Debug] Setting main image field to:", productData.image);
      }

      // Get auth token
      const token = await currentUser.getIdToken();

      // Create or update product
      const url = isEdit
        ? `/api/products/${product.id}`
        : '/api/products';

      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save product');
      }

      // Redirect to products list
      router.push('/admin/products');
    } catch (error) {
      console.error('Error saving product:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
      {/* Image Modal */}
      <ImageModal
        src={modalImage.src}
        alt={modalImage.alt}
        isOpen={modalOpen}
        onClose={closeImageModal}
        onReplace={(imageUrl) => replaceImage(imageUrl, modalImage.index)}
        imageIndex={modalImage.index}
      />

      {error && (
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Product Name *
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="name"
              id="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category *
          </label>
          <div className="mt-1">
            <select
              id="category"
              name="category"
              required
              value={formData.category}
              onChange={handleChange}
              className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="">Select a category</option>
              {availableCategories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              {/* Include hardcoded options as fallback */}
              {!availableCategories.includes('vegetables') && <option value="vegetables">Vegetables</option>}
              {!availableCategories.includes('fruits') && <option value="fruits">Fruits</option>}
              {!availableCategories.includes('culinary-herbs') && <option value="culinary-herbs">Culinary Herbs</option>}
              {!availableCategories.includes('native-plants') && <option value="native-plants">Native Plants</option>}
              {!availableCategories.includes('medicinal-herbs') && <option value="medicinal-herbs">Medicinal Herbs</option>}
              {!availableCategories.includes('pollinator-friendly') && <option value="pollinator-friendly">Pollinator Friendly</option>}
            </select>
          </div>
        </div>

        <div className="sm:col-span-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <div className="mt-1">
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="price" className="block text-sm font-medium text-gray-700">
            Price ($) *
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              name="price"
              id="price"
              required
              min="0"
              step="0.01"
              value={formData.price}
              onChange={handleChange}
              className="focus:ring-green-500 focus:border-green-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
              placeholder="0.00"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">USD</span>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="inventory" className="block text-sm font-medium text-gray-700">
            Inventory *
          </label>
          <div className="mt-1">
            <input
              type="number"
              name="inventory"
              id="inventory"
              required
              min="0"
              step="1"
              value={formData.inventory}
              onChange={handleChange}
              className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="unit" className="block text-sm font-medium text-gray-700">
            Unit *
          </label>
          <div className="mt-1">
            <select
              id="unit"
              name="unit"
              required
              value={formData.unit}
              onChange={handleChange}
              className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="each">Each</option>
              <option value="plant">Plant</option>
              <option value="lb">Pound (lb)</option>
              <option value="oz">Ounce (oz)</option>
              <option value="g">Gram (g)</option>
              <option value="kg">Kilogram (kg)</option>
              <option value="bunch">Bunch</option>
              <option value="dozen">Dozen</option>
            </select>
          </div>
        </div>

        <div className="sm:col-span-3">
          <div className="flex items-center">
            <input
              id="organic"
              name="organic"
              type="checkbox"
              checked={formData.organic}
              onChange={handleChange}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="organic" className="ml-2 block text-sm text-gray-700">
              Organic Product
            </label>
          </div>
        </div>

        <div className="sm:col-span-3">
          <div className="flex items-center">
            <input
              id="featured"
              name="featured"
              type="checkbox"
              checked={formData.featured}
              onChange={handleChange}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="featured" className="ml-2 block text-sm text-gray-700">
              Featured on Homepage
            </label>
          </div>
        </div>

        <div className="sm:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product Images
          </label>

          {imagesLoading ? (
            <div className="flex justify-center items-center h-32 bg-gray-50 rounded-md border border-gray-200">
              <svg className="animate-spin h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-gray-500">Loading images...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {/* Existing images - click to replace */}
              {previewImages && previewImages.map((src, index) => (
                <div
                  key={index}
                  className="relative group cursor-pointer"
                  onClick={() => openImageModal(src, `Product image ${index + 1}`, index)}
                >
                  <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-green-500 transition-colors">
                    <img
                      src={src}
                      alt={`Product image ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20fill%3D%22%23f0f0f0%22%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3Ctext%20x%3D%2250%22%20y%3D%2250%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999%22%20font-size%3D%2210%22%3EImage%3C%2Ftext%3E%3C%2Fsvg%3E';
                      }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                      <span className="hidden group-hover:block text-white text-sm font-medium">
                        Click to Replace
                      </span>
                    </div>
                    {/* Primary badge for first image */}
                    {index === 0 && (
                      <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                        Primary
                      </div>
                    )}
                  </div>
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Add new image card */}
              <div
                className="relative cursor-pointer"
                onClick={addNewImage}
              >
                <div className="w-full aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-green-500 hover:bg-gray-100 transition-all flex flex-col items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm text-gray-500">Add Image</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-5 border-t border-gray-200 mt-5">
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mr-3"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || (!formChanged && isEdit)}
          className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${loading ? 'bg-gray-400' : (!formChanged && isEdit) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
            }`}
        >
          {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
        </button>
      </div>
    </form>
  );
} 