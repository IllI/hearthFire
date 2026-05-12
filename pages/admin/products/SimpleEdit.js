import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/AdminLayout';
import { useAuth } from '../../../contexts/AuthContext';
import Image from 'next/image';
import { uploadImageToImgBB } from '../../../utils/imgbbStorage';
import ImageUploadHelper from '../../../components/ImageUploadHelper';

export default function SimpleEdit() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { id } = router.query;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    inventory: '0',
    unit: 'each',
    organic: false,
    featured: false,
    images: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [imageUploadStatus, setImageUploadStatus] = useState('idle');
  const [imagePreview, setImagePreview] = useState(null);
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({ images: null });

  // Fetch product data when id changes
  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      try {
        setLoading(true);
        const response = await fetch(`/api/products/${id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch product');
        }

        const data = await response.json();
        console.log('Loaded product data:', data);

        setProduct(data);

        // Initialize form data from product
        setFormData({
          name: data.name || '',
          description: data.description || '',
          price: data.price?.toString() || '',
          category: data.category || '',
          inventory: data.stock?.toString() || '0',
          unit: data.unit || 'each',
          organic: data.organic || false,
          featured: data.featured || false,
          images: data.images || []
        });

        // Set initial images state
        setImages(data.images || []);

        // Set image preview if available
        if (data.images && data.images.length > 0) {
          const firstImage = data.images[0];
          // Format image URL if needed
          if (firstImage.startsWith('http://') || firstImage.startsWith('https://')) {
            setImagePreview(firstImage);
          } else if (firstImage.startsWith('/')) {
            setImagePreview(`${window.location.origin}${firstImage}`);
          } else {
            setImagePreview(`${window.location.origin}/${firstImage}`);
          }
        }
      } catch (err) {
        console.error('Error loading product:', err);
        setError('Failed to load product. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  // Update formData.images when images state changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      images
    }));
  }, [images]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      setError('You must be logged in to update products');
      return;
    }

    try {
      setSubmitting(true);

      // Get auth token
      const token = await currentUser.getIdToken();

      // Convert values
      const productData = {
        id,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        stock: parseInt(formData.inventory) || 0,
        unit: formData.unit,
        organic: formData.organic,
        featured: formData.featured,
        images: formData.images
      };

      // Update product
      const response = await fetch('/api/products/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update product');
      }

      // Redirect to products list
      router.push('/admin/products');
    } catch (err) {
      console.error('Error updating product:', err);
      setError(err.message || 'Failed to update product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = (imageUrl) => {
    setImages(prevImages => [...prevImages, imageUrl]);
  };

  const handleImageRemove = (index) => {
    setImages(prevImages => prevImages.filter((_, i) => i !== index));
  };

  const handleMakePrimary = (index) => {
    if (index === 0) return; // Already primary

    // Move the selected image to the first position
    setImages(prevImages => {
      const newImages = [...prevImages];
      const [selectedImage] = newImages.splice(index, 1);
      newImages.unshift(selectedImage);
      return newImages;
    });
  };

  const handleRecoverImage = (imageUrl) => {
    setImages(prevImages => [...prevImages, imageUrl]);
  };

  if (loading) {
    return (
      <AdminLayout title="Edit Product">
        <div className="p-6 text-center">Loading product...</div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Edit Product">
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
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Edit ${product?.name || 'Product'}`}>
      <div className="bg-white shadow-md rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Product Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Product Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category *</label>
              <select
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              >
                <option value="">Select a category</option>
                <option value="vegetables">Vegetables</option>
                <option value="fruits">Fruits</option>
                <option value="culinary-herbs">Culinary Herbs</option>
                <option value="native-plants">Native Plants</option>
                <option value="medicinal-herbs">Medicinal Herbs</option>
                <option value="pollinator-friendly">Pollinator Friendly</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              {/* Price */}
              <div className="sm:col-span-2">
                <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price ($) *</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={handleChange}
                    className="mt-1 block w-full pl-7 pr-12 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">USD</span>
                  </div>
                </div>
              </div>

              {/* Inventory */}
              <div className="sm:col-span-2">
                <label htmlFor="inventory" className="block text-sm font-medium text-gray-700">Inventory *</label>
                <input
                  type="number"
                  id="inventory"
                  name="inventory"
                  required
                  min="0"
                  value={formData.inventory}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>

              {/* Unit */}
              <div className="sm:col-span-2">
                <label htmlFor="unit" className="block text-sm font-medium text-gray-700">Unit *</label>
                <select
                  id="unit"
                  name="unit"
                  required
                  value={formData.unit}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
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

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              {/* Organic */}
              <div className="sm:col-span-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="organic"
                    name="organic"
                    checked={formData.organic}
                    onChange={handleChange}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="organic" className="ml-2 block text-sm text-gray-700">Organic Product</label>
                </div>
              </div>

              {/* Featured */}
              <div className="sm:col-span-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="featured"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleChange}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="featured" className="ml-2 block text-sm text-gray-700">Featured on Homepage</label>
                </div>
              </div>
            </div>

            {/* Product Image */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Images
              </label>
              <ImageUploadHelper
                images={images}
                onNewImage={handleImageUpload}
                onRemoveImage={handleImageRemove}
                onMakePrimary={handleMakePrimary}
                onRecoverImage={handleRecoverImage}
                productId={id}
              />
              {errors.images && (
                <p className="mt-1 text-sm text-red-600">{errors.images}</p>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/admin/products')}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${submitting ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
              >
                {submitting ? 'Updating...' : 'Update Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
} 