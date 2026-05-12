import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../../components/AdminLayout';
import ImageModal from '../../../../components/ImageModal';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';

/**
 * Product Edit Content Component
 * Syncs with the immediate-save logic found in the products list page
 */
const EditProductContent = ({ id }) => {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    stock: '',
    unit: 'each',
    organic: false,
    featured: false
  });

  const [availableCategories, setAvailableCategories] = useState([]);

  // Image Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState({ src: null, alt: '', index: 0 });
  const [imageReplacing, setImageReplacing] = useState(false);

  // Fetch product data and categories
  useEffect(() => {
    if (!id || !currentUser) return;

    async function fetchData() {
      try {
        setLoading(true);
        const token = await currentUser.getIdToken();

        // Fetch categories from products list
        const catResponse = await fetch('/api/products');
        if (catResponse.ok) {
          const products = await catResponse.json();
          const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
          setAvailableCategories(categories.sort());
        }

        // Fetch product
        const response = await fetch(`/api/products/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch product');

        const data = await response.json();
        setProduct(data);
        setFormData({
          name: data.name || '',
          description: data.description || '',
          price: data.price ? data.price.toString() : '',
          category: data.category || '',
          stock: data.stock !== undefined ? data.stock.toString() : '0',
          unit: data.unit || 'each',
          organic: data.organic || false,
          featured: data.featured || false
        });
      } catch (err) {
        console.error('Error fetching product:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, currentUser]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openImageModal = (src, alt, index = 0) => {
    setModalImage({ src, alt, index });
    setModalOpen(true);
  };

  const closeImageModal = () => {
    setModalOpen(false);
    setModalImage({ src: null, alt: '', index: 0 });
  };

  /**
   * IMMEDIATE SAVE logic identical to index.js
   * This is what the user specifically requested
   */
  const handleImageReplace = async (imageUrl) => {
    console.log('[EditProduct] Starting image replacement with URL:', imageUrl);

    if (!currentUser || !id || !product) {
      console.error('[EditProduct] Missing data for replacement');
      return false;
    }

    setImageReplacing(true);

    try {
      const token = await currentUser.getIdToken();

      // Logic identical to index.js: move new image to front (primary)
      let updatedImages = product.images ? [...product.images] : [];

      // If we are replacing an existing image
      if (modalImage.index !== undefined && modalImage.index < updatedImages.length) {
        updatedImages.splice(modalImage.index, 1);
      }

      // Add the new image to the front (primary) - pattern from index.js
      const newImagesArray = [imageUrl, ...updatedImages.filter(img => img !== imageUrl)];

      // Prepare data for API
      const updatedProductData = {
        ...product,
        image: imageUrl, // Primary image
        images: newImagesArray
      };

      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedProductData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update image: ${errorText}`);
      }

      // Update local state
      setProduct(prev => ({
        ...prev,
        images: newImagesArray,
        image: imageUrl
      }));

      // Update modal preview
      setModalImage(prev => ({ ...prev, src: imageUrl }));

      return true;
    } catch (err) {
      console.error('[EditProduct] Error replacing image:', err);
      alert(`Failed to save image: ${err.message}`);
      return false;
    } finally {
      setImageReplacing(false);
    }
  };

  const handleRemoveImage = async (index) => {
    if (!confirm('Are you sure you want to remove this image?')) return;
    if (!product || !currentUser || !id) return;

    try {
      const token = await currentUser.getIdToken();
      const updatedImages = product.images.filter((_, i) => i !== index);

      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...product,
          images: updatedImages,
          image: updatedImages.length > 0 ? updatedImages[0] : ''
        })
      });

      if (!response.ok) throw new Error('Failed to remove image');

      setProduct(prev => ({
        ...prev,
        images: updatedImages,
        image: updatedImages.length > 0 ? updatedImages[0] : ''
      }));
    } catch (err) {
      console.error('Error removing image:', err);
      alert(err.message);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !id) return;

    setSubmitting(true);
    try {
      const token = await currentUser.getIdToken();
      // Only update the basic details, maintain current images
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...product,
          ...formData,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock) || 0
        })
      });

      if (!response.ok) throw new Error('Failed to update product details');

      router.push('/admin/products');
    } catch (err) {
      console.error('Error updating product:', err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading product data...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sidebar - Images */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Images</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {product?.images?.map((src, index) => (
              <div key={index} className="relative group aspect-square">
                <div
                  className="w-full h-full rounded-lg overflow-hidden border-2 border-gray-100 hover:border-green-500 cursor-pointer transition-all shadow-sm"
                  onClick={() => openImageModal(src, `Product image ${index + 1}`, index)}
                >
                  <img src={src} alt="Product" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white text-xs font-medium px-2 py-1 bg-black/60 rounded">Replace</span>
                  </div>
                </div>
                {index === 0 && (
                  <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shadow-sm">
                    Primary
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                  className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}

            {/* Add Image Button */}
            <button
              onClick={() => openImageModal(null, 'Add new image', product?.images?.length || 0)}
              className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-gray-400 hover:text-green-600"
            >
              <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <span className="text-[10px] font-medium">Add Image</span>
            </button>
          </div>

          <div className="text-xs text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
            <p className="font-semibold mb-1">💡 Image Tips:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Click an image to replace it</li>
              <li>The first image is the <strong>Primary</strong> photo</li>
              <li>Replacing an image moves it to the front</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className="lg:col-span-2">
        <form onSubmit={handleFormSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Product Details</h2>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all appearance-none"
                >
                  <option value="">Select Category</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit</label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all appearance-none"
                >
                  <option value="each">Each</option>
                  <option value="plant">Plant</option>
                  <option value="lb">Pound (lb)</option>
                  <option value="bunch">Bunch</option>
                  <option value="dozen">Dozen</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Price ($)</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  required
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Inventory</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  required
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                />
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="organic"
                    checked={formData.organic}
                    onChange={handleChange}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Organic</span>
                </label>

                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleChange}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Featured</span>
                </label>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 flex justify-between items-center">
            <Link href="/admin/products" className="text-sm font-medium text-gray-500 hover:text-gray-700">
              Discard Changes
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className={`px-8 py-2.5 rounded-lg text-white font-bold transition-all shadow-md ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:transform active:scale-95'}`}
            >
              {submitting ? 'Saving...' : 'Save Product Changes'}
            </button>
          </div>
        </form>
      </div>

      <ImageModal
        src={modalImage.src}
        alt={modalImage.alt}
        isOpen={modalOpen}
        onClose={closeImageModal}
        onReplace={handleImageReplace}
        imageIndex={modalImage.index}
        allowReplace={true}
      />
    </div>
  );
};

export default function EditProduct() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <AdminLayout title={`Edit ${id ? 'Product' : ''}`}>
      {id && <EditProductContent id={id} />}
    </AdminLayout>
  );
}