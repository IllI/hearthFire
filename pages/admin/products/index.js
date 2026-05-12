import { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../../contexts/AuthContext';
import ImageModal from '../../../components/ImageModal';

export default function AdminProducts() {
  return (
    <AdminLayout title="Products">
      <ProductsContent />
    </AdminLayout>
  );
}

function ProductsContent() {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState({ src: '', alt: '', productId: null, imageIndex: 0 });
  const [imageReplaceStatus, setImageReplaceStatus] = useState({ loading: false, error: null });

  // Sorting state
  const [sortField, setSortField] = useState(null); // 'name', 'price', 'stock', 'category'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  // Filter state
  const [filterCategories, setFilterCategories] = useState([]); // array of selected category strings
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'in-stock', 'out-of-stock'

  // State for inline editing
  const [editingDescription, setEditingDescription] = useState(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  // New state for name editing
  const [editingName, setEditingName] = useState(null);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  // New state for Latin name editing
  const [editingLatinName, setEditingLatinName] = useState(null);
  const [latinNameValue, setLatinNameValue] = useState('');
  const [savingLatinName, setSavingLatinName] = useState(false);

  // New state for price editing
  const [editingPrice, setEditingPrice] = useState(null);
  const [priceValue, setPriceValue] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // New state for stock editing
  const [editingStock, setEditingStock] = useState(null);
  const [stockValue, setStockValue] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  // New state for category editing
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryValue, setCategoryValue] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // For multiple categories
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Add state for available categories
  const [availableCategories, setAvailableCategories] = useState([]);

  // Add state to track which images are currently loading
  const [loadingImages, setLoadingImages] = useState({});

  // Mobile filters state
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  useEffect(() => {
    // Fetch products
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);

      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');

      const data = await response.json();
      setProducts(data);

      // Extract unique categories from all products
      const allCategories = new Set();

      data.forEach(product => {
        // Handle both string categories and arrays of categories
        if (Array.isArray(product.categories)) {
          product.categories.forEach(cat => {
            if (cat) allCategories.add(cat);
          });
        } else if (product.category) {
          // Legacy support for single category
          allCategories.add(product.category);
        }
      });

      setAvailableCategories([...allCategories].sort());
    } catch (error) {
      console.error('Error fetching products:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleImageError = (productId) => {
    setImageErrors(prev => ({
      ...prev,
      [productId]: true
    }));
  };

  const openImageModal = (src, alt, productId, imageIndex = 0) => {
    setModalImage({ src, alt, productId, imageIndex });
    setModalOpen(true);
  };

  const closeImageModal = () => {
    setModalOpen(false);
    // Reset any error status from previous upload attempts
    setImageReplaceStatus({ loading: false, error: null });
  };

  // Handle image replacement using the direct ImgBB URL from ImageModal
  const replaceImage = async (imageUrl) => {
    if (!currentUser) {
      throw new Error('Authentication required.');
    }
    if (!modalImage.productId) {
      console.error('No product ID provided for image replacement');
      throw new Error('No product ID provided for image replacement');
    }

    // Set the specific product image as loading
    setLoadingImages(prev => ({
      ...prev,
      [modalImage.productId]: true
    }));

    console.log('[Debug] Processing image replacement with direct ImgBB URL:', imageUrl);
    setImageReplaceStatus({ loading: true, error: null });

    try {
      // Get auth token for admin verification
      const token = await currentUser.getIdToken();

      // Update Firestore Product Document
      const product = products.find(p => p.id === modalImage.productId);
      if (!product) {
        console.error('[Debug] Product not found for update with ID:', modalImage.productId);
        throw new Error('Product not found during update');
      }

      // Create a new images array with the new image as primary
      let updatedImages = product.images ? [...product.images] : [];
      if (modalImage.imageIndex < updatedImages.length) {
        updatedImages.splice(modalImage.imageIndex, 1); // Remove old image if replacing existing
      }
      const newImagesArray = [imageUrl, ...updatedImages.filter(img => img !== imageUrl)];

      // Create a new product object with the updated image
      const updatedProduct = {
        ...product,
        image: imageUrl, // Set primary image
        images: newImagesArray // Update images array
      };

      console.log('[Debug] Sending request to update product in Firestore:', {
        productId: modalImage.productId,
        updatedImageUrl: imageUrl,
        updatedImages: newImagesArray,
        productBeforeUpdate: product,
        productAfterUpdate: updatedProduct
      });

      // Update the product in the database
      const updateResponse = await fetch(`/api/products/${modalImage.productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedProduct)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('[Debug] Firestore update failed:', errorText);
        throw new Error(`Failed to update product in Firestore (${updateResponse.status}): ${errorText}`);
      }

      const updatedData = await updateResponse.json();
      console.log('[Debug] Firestore update succeeded with data:', updatedData);

      // Update Local State immediately
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === modalImage.productId
            ? { ...p, image: imageUrl, images: newImagesArray }
            : p
        )
      );

      // Update the modal to display the new image
      setModalImage(prev => ({ ...prev, src: imageUrl }));

      console.log('[Debug] Image replacement completed successfully.');
      return true;

    } catch (error) {
      console.error('[Debug] Error during image replacement:', error);
      setImageReplaceStatus({ loading: false, error: error.message });
      throw error; // Re-throw to be caught by the component if needed
    } finally {
      setImageReplaceStatus({ loading: false, error: null });
      // Remove the loading state for this image
      setTimeout(() => {
        setLoadingImages(prev => ({
          ...prev,
          [modalImage.productId]: false
        }));
      }, 500); // Small delay to ensure the UI has updated
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      // Get the auth token for admin verification
      const token = await currentUser.getIdToken();

      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete product');

      // Remove product from state
      setProducts(products.filter(product => product.id !== id));
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product: ' + error.message);
    }
  };

  // Start editing a product description
  const startEditingDescription = (productId, currentDescription) => {
    setEditingDescription(productId);
    setDescriptionValue(currentDescription || '');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingDescription(null);
    setDescriptionValue('');
    // Clear other editing states too
    setEditingPrice(null);
    setPriceValue('');
    setEditingStock(null);
    setStockValue('');
    setEditingCategory(null);
    setCategoryValue('');
    // Reset multiple categories state
    setSelectedCategories([]);
    // Clear name editing states
    setEditingName(null);
    setNameValue('');
    setEditingLatinName(null);
    setLatinNameValue('');
  };

  // Save edited description
  const saveDescription = async (productId) => {
    if (!currentUser) return;

    setSavingDescription(true);
    try {
      // Find the product to update
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('Product not found');

      // Get auth token
      const token = await currentUser.getIdToken();

      // Update the product
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...product,
          description: descriptionValue
        })
      });

      if (!response.ok) throw new Error('Failed to update product description');

      // Update local state
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? { ...p, description: descriptionValue }
            : p
        )
      );

      // Close the editor
      setEditingDescription(null);
    } catch (error) {
      console.error('Error saving description:', error);
      alert('Failed to save description: ' + error.message);
    } finally {
      setSavingDescription(false);
    }
  };

  // Start editing price
  const startEditingPrice = (productId, currentPrice) => {
    setEditingPrice(productId);
    setPriceValue(currentPrice || '');
  };

  // Save edited price - now called on blur
  const savePrice = async (productId) => {
    if (!currentUser) return;

    // Validate price
    const price = parseFloat(priceValue);
    if (isNaN(price) || price < 0) {
      alert('Please enter a valid price');
      return;
    }

    setSavingPrice(true);
    try {
      // Find the product to update
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('Product not found');

      // Get auth token
      const token = await currentUser.getIdToken();

      // Update the product
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...product,
          price: price
        })
      });

      if (!response.ok) throw new Error('Failed to update product price');

      // Update local state
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? { ...p, price: price }
            : p
        )
      );

      // Close the editor
      setEditingPrice(null);
    } catch (error) {
      console.error('Error saving price:', error);
      alert('Failed to save price: ' + error.message);
    } finally {
      setSavingPrice(false);
    }
  };

  // Start editing stock
  const startEditingStock = (productId, currentStock) => {
    setEditingStock(productId);
    setStockValue(currentStock || 0);
  };

  // Save edited stock - now called on blur
  const saveStock = async (productId) => {
    if (!currentUser) return;

    // Validate stock
    const stock = parseInt(stockValue);
    if (isNaN(stock) || stock < 0) {
      alert('Please enter a valid stock number');
      return;
    }

    setSavingStock(true);
    try {
      // Find the product to update
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('Product not found');

      // Get auth token
      const token = await currentUser.getIdToken();

      // Update the product
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...product,
          stock: stock
        })
      });

      if (!response.ok) throw new Error('Failed to update product stock');

      // Update local state
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? { ...p, stock: stock }
            : p
        )
      );

      // Close the editor
      setEditingStock(null);
    } catch (error) {
      console.error('Error saving stock:', error);
      alert('Failed to save stock: ' + error.message);
    } finally {
      setSavingStock(false);
    }
  };

  // Start editing categories with enhanced UI
  const startEditingCategories = (productId, product) => {
    setEditingCategory(productId);

    // Initialize selected categories from product
    if (Array.isArray(product.categories)) {
      setSelectedCategories(product.categories);
    } else if (product.category) {
      // Legacy support for single category
      setSelectedCategories(product.category ? [product.category] : []);
    } else {
      setSelectedCategories([]);
    }

    setCategoryValue('');
  };

  // Save edited categories
  const saveCategories = async (productId, newCategories = null) => {
    if (!currentUser) return;

    // Find the product to update
    const product = products.find(p => p.id === productId);
    if (!product) {
      console.error('Product not found:', productId);
      return;
    }

    // Use provided categories or fall back to selected categories state
    const categoriesToSave = newCategories || selectedCategories;

    // Compare if categories have actually changed
    const currentCategories = Array.isArray(product.categories)
      ? product.categories
      : (product.category ? [product.category] : []);

    // If categories haven't changed, just close the editor
    if (JSON.stringify(currentCategories.sort()) === JSON.stringify([...categoriesToSave].sort())) {
      if (!newCategories) { // Only close editor if this was called from the Save button
        setEditingCategory(null);
        setSelectedCategories([]);
      }
      return;
    }

    setSavingCategory(true);
    try {
      // Get auth token
      const token = await currentUser.getIdToken();

      // Update the product with new categories array and maintain backward compatibility
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          categories: categoriesToSave,
          category: categoriesToSave.length > 0 ? categoriesToSave[0] : '' // Legacy support
        })
      });

      if (!response.ok) throw new Error('Failed to update product categories');

      // Update local state
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? {
              ...p,
              categories: categoriesToSave,
              category: categoriesToSave.length > 0 ? categoriesToSave[0] : '' // Legacy support
            }
            : p
        )
      );

      // Only close the editor if this was called from the Save button
      if (!newCategories) {
        setEditingCategory(null);
        setSelectedCategories([]);
      }
    } catch (error) {
      console.error('Error saving categories:', error);
      alert('Failed to save categories: ' + error.message);
    } finally {
      setSavingCategory(false);
    }
  };

  // Start editing product name
  const startEditingName = (productId, currentName) => {
    setEditingName(productId);
    setNameValue(currentName || '');
  };

  // Save edited product name
  const saveName = async (productId) => {
    if (!currentUser || !nameValue.trim()) return;

    setSavingName(true);
    try {
      // Find the product to update
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('Product not found');

      // Get auth token
      const token = await currentUser.getIdToken();

      // Update the product
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...product,
          name: nameValue.trim()
        })
      });

      if (!response.ok) throw new Error('Failed to update product name');

      // Update local state
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? { ...p, name: nameValue.trim() }
            : p
        )
      );

      // Close the editor
      setEditingName(null);
    } catch (error) {
      console.error('Error saving product name:', error);
      alert('Failed to save product name: ' + error.message);
    } finally {
      setSavingName(false);
    }
  };

  // Start editing Latin name
  const startEditingLatinName = (productId, currentLatinName) => {
    setEditingLatinName(productId);
    setLatinNameValue(currentLatinName || '');
  };

  // Save edited Latin name
  const saveLatinName = async (productId) => {
    if (!currentUser) return;

    setSavingLatinName(true);
    try {
      // Find the product to update
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('Product not found');

      // Get auth token
      const token = await currentUser.getIdToken();

      // Update the product
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...product,
          latinName: latinNameValue.trim()
        })
      });

      if (!response.ok) throw new Error('Failed to update Latin name');

      // Update local state
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? { ...p, latinName: latinNameValue.trim() }
            : p
        )
      );

      // Close the editor
      setEditingLatinName(null);
    } catch (error) {
      console.error('Error saving Latin name:', error);
      alert('Failed to save Latin name: ' + error.message);
    } finally {
      setSavingLatinName(false);
    }
  };

  // Helper function to truncate text for preview
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Sorting logic
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getProductCategory = (product) => {
    if (Array.isArray(product.categories) && product.categories.length > 0) {
      return product.categories[0].toLowerCase();
    }
    if (product.category) return product.category.toLowerCase();
    return 'zzz'; // push uncategorized to end
  };

  // Filtering logic
  const getProductCategories = (product) => {
    if (Array.isArray(product.categories) && product.categories.length > 0) {
      return product.categories;
    }
    if (product.category) return [product.category];
    return [];
  };

  const toggleCategoryFilter = (category) => {
    setFilterCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearAllFilters = () => {
    setFilterCategories([]);
    setStockFilter('all');
  };

  const hasActiveFilters = filterCategories.length > 0 || stockFilter !== 'all';

  const filteredProducts = products.filter(product => {
    // Category filter
    if (filterCategories.length > 0) {
      const productCats = getProductCategories(product);
      const hasMatchingCategory = filterCategories.some(fc => productCats.includes(fc));
      if (!hasMatchingCategory) return false;
    }

    // Stock filter
    if (stockFilter === 'in-stock' && !(parseInt(product.stock) > 0)) return false;
    if (stockFilter === 'out-of-stock' && parseInt(product.stock) > 0) return false;

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField) return 0;

    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = (a.name || '').localeCompare(b.name || '');
        break;
      case 'price':
        comparison = (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
        break;
      case 'stock':
        comparison = (parseInt(a.stock) || 0) - (parseInt(b.stock) || 0);
        break;
      case 'category':
        comparison = getProductCategory(a).localeCompare(getProductCategory(b));
        break;
      default:
        return 0;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Sort arrow indicator component
  const SortArrow = ({ field }) => {
    if (sortField !== field) {
      return (
        <span className="ml-1 inline-flex flex-col opacity-30 group-hover:opacity-60 transition-opacity" style={{ fontSize: '8px', lineHeight: '8px', verticalAlign: 'middle' }}>
          <span>▲</span>
          <span>▼</span>
        </span>
      );
    }
    return (
      <span className="ml-1 inline-flex items-center text-green-600" style={{ fontSize: '10px' }}>
        {sortDirection === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  if (loading) return <div className="p-6 text-center">Loading products...</div>;
  if (error) return <div className="p-6 text-center text-red-500">Error: {error}</div>;

  return (
    <div>
      {/* Image Modal */}
      <ImageModal
        src={modalImage.src}
        alt={modalImage.alt}
        isOpen={modalOpen}
        onClose={closeImageModal}
        onReplace={(imageUrl) => replaceImage(imageUrl)}
        imageIndex={modalImage.imageIndex}
        allowReplace={true}
      />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link
          href="/admin/products/new"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
        >
          Add New Product
        </Link>
      </div>

      {/* Filter Bar */}
      {products.length > 0 && (
        <div className={`mb-4 bg-white shadow-md rounded-lg transition-all duration-200 sticky top-0 z-30 md:static md:z-auto ${isMobileFiltersOpen ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
          {/* Filter header - Clickable on mobile to toggle */}
          <div
            className="p-4 flex items-center justify-between cursor-pointer md:cursor-auto"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          >
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Filters & Sort</span>
              {hasActiveFilters && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {sortedProducts.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAllFilters();
                  }}
                  className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-red-50"
                >
                  Clear
                </button>
              )}

              {/* Mobile toggle chevron */}
              <svg
                className={`h-5 w-5 text-gray-400 md:hidden transform transition-transform duration-200 ${isMobileFiltersOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Collapsible Content */}
          <div className={`px-4 pb-4 md:block ${isMobileFiltersOpen ? 'block border-t border-gray-100 pt-3' : 'hidden'}`}>
            {/* Category chips */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map(category => {
                  const isActive = filterCategories.includes(category);
                  return (
                    <button
                      key={category}
                      onClick={() => toggleCategoryFilter(category)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${isActive
                        ? 'bg-green-600 text-white border-green-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:text-green-700'
                        }`}
                    >
                      {category}
                      {isActive && (
                        <svg className="ml-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
                {availableCategories.length === 0 && (
                  <span className="text-xs text-gray-400 italic">No categories available</span>
                )}
              </div>
            </div>

            {/* Stock filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Stock Status</label>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'in-stock', label: 'In Stock' },
                  { value: 'out-of-stock', label: 'Out of Stock' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setStockFilter(option.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all duration-150 ${stockFilter === option.value
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:text-green-700'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Sort Options - Only visible on mobile since desktop has table headers */}
            <div className="mt-4 md:hidden border-t pt-3 border-gray-100">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Sort Order</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { field: 'name', label: 'Name' },
                  { field: 'price', label: 'Price' },
                  { field: 'stock', label: 'Stock' },
                  { field: 'category', label: 'Category' },
                ].map(option => (
                  <button
                    key={option.field}
                    onClick={() => handleSort(option.field)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold border transition-all duration-150 ${sortField === option.field
                      ? 'bg-green-50 text-green-800 border-green-300 ring-1 ring-green-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                      }`}
                  >
                    {option.label}
                    <SortArrow field={option.field} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center p-6 bg-white rounded-lg shadow">
          <p className="text-gray-500">No products found. Add your first product!</p>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="text-center p-6 bg-white rounded-lg shadow">
          <p className="text-gray-500">No products match the current filters.</p>
          <button
            onClick={clearAllFilters}
            className="mt-2 text-sm text-green-600 hover:text-green-800 font-medium"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div>
          {/* Table for larger screens */}
          <div className="hidden md:block overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none group hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <span className="flex items-center">Product<SortArrow field="name" /></span>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none group hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('price')}
                  >
                    <span className="flex items-center">Price<SortArrow field="price" /></span>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none group hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('stock')}
                  >
                    <span className="flex items-center">Stock<SortArrow field="stock" /></span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none group hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('category')}
                  >
                    <span className="flex items-center">Category<SortArrow field="category" /></span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-16 w-16 relative flex-shrink-0">
                          {product.images && product.images.length > 0 && !imageErrors[product.id] ? (
                            <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0">
                              {loadingImages[product.id] ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse">
                                  <svg className="animate-spin h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </div>
                              ) : (
                                <img
                                  src={product.images[0]}
                                  alt={product.name}
                                  className="h-16 w-16 object-fill rounded-md cursor-pointer"
                                  onClick={() => openImageModal(product.images[0], product.name, product.id, 0)}
                                  onError={() => handleImageError(product.id)}
                                />
                              )}
                            </div>
                          ) : product.image && !imageErrors[product.id] ? (
                            <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0">
                              {loadingImages[product.id] ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse">
                                  <svg className="animate-spin h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </div>
                              ) : (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="h-16 w-16 object-fill rounded-md cursor-pointer"
                                  onClick={() => openImageModal(product.image, product.name, product.id, 0)}
                                  onError={() => handleImageError(product.id)}
                                />
                              )}
                            </div>
                          ) : (
                            <div
                              className="h-16 w-16 bg-gray-200 rounded-md flex items-center justify-center cursor-pointer text-gray-400"
                              onClick={() => openImageModal(null, product.name, product.id, 0)}
                            >
                              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex-1">
                          {editingName === product.id ? (
                            <div>
                              <input
                                type="text"
                                value={nameValue}
                                onChange={(e) => setNameValue(e.target.value)}
                                onBlur={() => saveName(product.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveName(product.id);
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-lg font-medium border-gray-300 rounded-md"
                                autoFocus
                              />
                              {savingName && <span className="text-xs text-gray-500">Saving...</span>}
                            </div>
                          ) : (
                            <h3
                              className="text-lg font-medium text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
                              onClick={() => startEditingName(product.id, product.name)}
                              title="Click to edit name"
                            >
                              {product.name}
                            </h3>
                          )}
                          {editingLatinName === product.id ? (
                            <div>
                              <input
                                type="text"
                                value={latinNameValue}
                                onChange={(e) => setLatinNameValue(e.target.value)}
                                onBlur={() => saveLatinName(product.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveLatinName(product.id);
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-sm italic border-gray-300 rounded-md mt-1"
                                placeholder="Latin name"
                                autoFocus
                              />
                              {savingLatinName && <span className="text-xs text-gray-500">Saving...</span>}
                            </div>
                          ) : (
                            <p
                              className="text-sm text-gray-500 italic cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
                              onClick={() => startEditingLatinName(product.id, product.latinName)}
                              title="Click to edit latin name"
                            >
                              {product.latinName || <span className="text-gray-400">Add latin name...</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingPrice === product.id ? (
                        <div className="w-full">
                          <div className="flex items-center">
                            <span className="mr-1">$</span>
                            <input
                              type="number"
                              value={priceValue}
                              onChange={(e) => setPriceValue(e.target.value)}
                              onBlur={() => savePrice(product.id)}
                              onKeyDown={(e) => e.key === 'Enter' && savePrice(product.id)}
                              className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-20 text-sm border-gray-300 rounded-md"
                              step="0.01"
                              min="0"
                              autoFocus
                            />
                            <span className="ml-1">/ {product.unit}</span>
                          </div>
                          {savingPrice && (
                            <div className="mt-1 text-xs text-gray-500">Saving...</div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="text-sm text-gray-900 cursor-pointer group"
                          onClick={() => startEditingPrice(product.id, product.price)}
                        >
                          <div className="group-hover:bg-gray-50 p-2 rounded transition-colors">
                            ${parseFloat(product.price).toFixed(2)} / {product.unit}
                            <div className="mt-1 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to edit
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingStock === product.id ? (
                        <div className="w-full">
                          <input
                            type="number"
                            value={stockValue}
                            onChange={(e) => setStockValue(e.target.value)}
                            onBlur={() => saveStock(product.id)}
                            onKeyDown={(e) => e.key === 'Enter' && saveStock(product.id)}
                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-20 text-sm border-gray-300 rounded-md"
                            min="0"
                            autoFocus
                          />
                          {savingStock && (
                            <div className="mt-1 text-xs text-gray-500">Saving...</div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="text-sm text-gray-900 cursor-pointer group"
                          onClick={() => startEditingStock(product.id, product.stock || 0)}
                        >
                          <div className="group-hover:bg-gray-50 p-2 rounded transition-colors">
                            {product.stock || 0}
                            <div className="mt-1 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to edit
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingDescription === product.id ? (
                        <div className="w-full">
                          <textarea
                            value={descriptionValue}
                            onChange={(e) => setDescriptionValue(e.target.value)}
                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-sm border-gray-300 rounded-md"
                            rows={4}
                            placeholder="Enter product description"
                          />
                          <div className="mt-2 flex space-x-2">
                            <button
                              type="button"
                              disabled={savingDescription}
                              onClick={() => saveDescription(product.id)}
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              {savingDescription ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="text-sm text-gray-900 cursor-pointer group"
                          onClick={() => startEditingDescription(product.id, product.description)}
                        >
                          <div className="group-hover:bg-gray-50 p-2 rounded transition-colors">
                            {product.description ? (
                              truncateText(product.description)
                            ) : (
                              <span className="text-gray-400 italic">Add description...</span>
                            )}
                            <div className="mt-1 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to edit
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingCategory === product.id ? (
                        <div className="w-full">
                          <div className="mb-2 flex flex-wrap gap-2">
                            {/* Display currently selected categories as tags */}
                            {selectedCategories.map((cat, index) => (
                              <div
                                key={`${cat}-${index}`}
                                className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs flex items-center"
                              >
                                {cat}
                                <button
                                  type="button"
                                  className="ml-1 text-green-600 hover:text-green-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newCategories = selectedCategories.filter((_, i) => i !== index);
                                    setSelectedCategories(newCategories);
                                    // Auto-save when removing a category
                                    saveCategories(product.id, newCategories);
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Combined dropdown and text input for adding categories */}
                          <div className="mb-2">
                            <div className="flex flex-col space-y-2">
                              {/* Dropdown for existing categories */}
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value && !selectedCategories.includes(e.target.value)) {
                                    const newCategories = [...selectedCategories, e.target.value];
                                    setSelectedCategories(newCategories);
                                    // Auto-save after selection
                                    saveCategories(product.id, newCategories);
                                  }
                                }}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-sm border-gray-300 rounded-md"
                              >
                                <option value="">Select existing category</option>
                                {availableCategories
                                  .filter(cat => !selectedCategories.includes(cat))
                                  .map(category => (
                                    <option key={category} value={category}>
                                      {category}
                                    </option>
                                  ))}
                              </select>

                              {/* Text input for new categories */}
                              <div className="relative">
                                <input
                                  type="text"
                                  value={categoryValue}
                                  onChange={(e) => setCategoryValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && categoryValue.trim()) {
                                      e.preventDefault();
                                      if (!selectedCategories.includes(categoryValue.trim())) {
                                        const newCategories = [...selectedCategories, categoryValue.trim()];
                                        setSelectedCategories(newCategories);
                                        // Auto-save after adding
                                        saveCategories(product.id, newCategories);
                                        setCategoryValue('');
                                      }
                                    }
                                  }}
                                  placeholder="Type to add a new category and press Enter"
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-sm border-gray-300 rounded-md"
                                />
                                {categoryValue && (
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <span className="text-xs text-gray-500">Press Enter to add</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Done button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(null);
                              setSelectedCategories([]);
                              setCategoryValue('');
                            }}
                            className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            Done
                          </button>

                          {savingCategory && (
                            <span className="ml-2 text-xs text-gray-500">Saving...</span>
                          )}
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer group"
                          onClick={() => startEditingCategories(product.id, product)}
                        >
                          <div className="flex flex-wrap gap-1">
                            {/* Show categories as tags */}
                            {Array.isArray(product.categories) && product.categories.length > 0 ? (
                              product.categories.map((cat, index) => (
                                <span
                                  key={`${cat}-${index}`}
                                  className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"
                                >
                                  {cat}
                                </span>
                              ))
                            ) : product.category ? (
                              // Legacy support for single category
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {product.category}
                              </span>
                            ) : (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                Uncategorized
                              </span>
                            )}
                            <div className="ml-1 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              ✏️
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/admin/products/edit/${product.id}`}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-4">
            {sortedProducts.map((product) => (
              <div key={product.id} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-4">
                  {/* Product header with image and name */}
                  <div className="flex items-center mb-4">
                    <div className="h-16 w-16 relative flex-shrink-0">
                      {product.images && product.images.length > 0 && !imageErrors[product.id] ? (
                        <div className="relative h-10 w-10 rounded-md overflow-hidden flex-shrink-0">
                          {loadingImages[product.id] ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse">
                              <svg className="animate-spin h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                          ) : (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="h-10 w-10 object-fill rounded-md cursor-pointer"
                              onClick={() => openImageModal(product.images[0], product.name, product.id, 0)}
                              onError={() => handleImageError(product.id)}
                            />
                          )}
                        </div>
                      ) : product.image && !imageErrors[product.id] ? (
                        <div className="relative h-10 w-10 rounded-md overflow-hidden flex-shrink-0">
                          {loadingImages[product.id] ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse">
                              <svg className="animate-spin h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                          ) : (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-10 w-10 object-fill rounded-md cursor-pointer"
                              onClick={() => openImageModal(product.image, product.name, product.id, 0)}
                              onError={() => handleImageError(product.id)}
                            />
                          )}
                        </div>
                      ) : (
                        <div
                          className="h-10 w-10 bg-gray-200 rounded-md flex items-center justify-center cursor-pointer text-gray-400"
                          onClick={() => openImageModal(null, product.name, product.id, 0)}
                        >
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex-1">
                      {editingName === product.id ? (
                        <div>
                          <input
                            type="text"
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            onBlur={() => saveName(product.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveName(product.id);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-lg font-medium border-gray-300 rounded-md"
                            autoFocus
                          />
                          {savingName && <span className="text-xs text-gray-500">Saving...</span>}
                        </div>
                      ) : (
                        <h3
                          className="text-lg font-medium text-gray-900 cursor-pointer"
                          onClick={() => startEditingName(product.id, product.name)}
                        >
                          {product.name}
                          <span className="ml-1 text-xs text-blue-600">✏️</span>
                        </h3>
                      )}
                      {editingLatinName === product.id ? (
                        <div>
                          <input
                            type="text"
                            value={latinNameValue}
                            onChange={(e) => setLatinNameValue(e.target.value)}
                            onBlur={() => saveLatinName(product.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveLatinName(product.id);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-sm italic border-gray-300 rounded-md mt-1"
                            placeholder="Latin name"
                            autoFocus
                          />
                          {savingLatinName && <span className="text-xs text-gray-500">Saving...</span>}
                        </div>
                      ) : (
                        <p
                          className="text-sm text-gray-500 italic cursor-pointer"
                          onClick={() => startEditingLatinName(product.id, product.latinName)}
                        >
                          {product.latinName || <span className="text-gray-400">Add latin name...</span>}
                          <span className="ml-1 text-xs text-blue-600">✏️</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mobile sections for each editable field */}
                  <div className="space-y-3 border-t pt-3">
                    {/* Price section */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Price:</span>
                      <div>
                        {editingPrice === product.id ? (
                          <div className="flex items-center">
                            <span className="mr-1">$</span>
                            <input
                              type="number"
                              value={priceValue}
                              onChange={(e) => setPriceValue(e.target.value)}
                              onBlur={() => savePrice(product.id)}
                              onKeyDown={(e) => e.key === 'Enter' && savePrice(product.id)}
                              className="shadow-sm focus:ring-green-500 focus:border-green-500 w-20 text-sm border-gray-300 rounded-md"
                              step="0.01"
                              min="0"
                              autoFocus
                            />
                            <span className="ml-1">/ {product.unit}</span>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer"
                            onClick={() => startEditingPrice(product.id, product.price)}
                          >
                            <span className="text-sm font-medium">${parseFloat(product.price).toFixed(2)} / {product.unit}</span>
                            <span className="ml-1 text-xs text-blue-600">✏️</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stock section */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Stock:</span>
                      <div>
                        {editingStock === product.id ? (
                          <div className="flex items-center">
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const current = parseInt(stockValue) || 0;
                                setStockValue(Math.max(0, current - 1).toString());
                              }}
                              className="p-1 px-3 bg-red-100 text-red-600 rounded-l-md border border-r-0 border-red-200 hover:bg-red-200"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={stockValue}
                              onChange={(e) => setStockValue(e.target.value)}
                              onBlur={() => saveStock(product.id)}
                              onKeyDown={(e) => e.key === 'Enter' && saveStock(product.id)}
                              className="shadow-sm focus:ring-green-500 focus:border-green-500 w-16 text-center text-sm border-gray-300 rounded-none z-10"
                              min="0"
                              autoFocus
                            />
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const current = parseInt(stockValue) || 0;
                                setStockValue((current + 1).toString());
                              }}
                              className="p-1 px-3 bg-green-100 text-green-600 rounded-r-md border border-l-0 border-green-200 hover:bg-green-200"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer"
                            onClick={() => startEditingStock(product.id, product.stock || 0)}
                          >
                            <span className="text-sm font-medium">{product.stock || 0}</span>
                            <span className="ml-1 text-xs text-blue-600">✏️</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Categories section */}
                    <div>
                      <span className="text-sm font-medium text-gray-500 block mb-1">Categories:</span>
                      <div>
                        {editingCategory === product.id ? (
                          <div className="mt-1">
                            <div className="mb-2 flex flex-wrap gap-1">
                              {selectedCategories.map((cat, index) => (
                                <div
                                  key={`${cat}-${index}`}
                                  className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs flex items-center"
                                >
                                  {cat}
                                  <button
                                    type="button"
                                    className="ml-1 text-green-600 hover:text-green-800"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newCategories = selectedCategories.filter((_, i) => i !== index);
                                      setSelectedCategories(newCategories);
                                      // Auto-save when removing a category
                                      saveCategories(product.id, newCategories);
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>

                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value && !selectedCategories.includes(e.target.value)) {
                                  const newCategories = [...selectedCategories, e.target.value];
                                  setSelectedCategories(newCategories);
                                  // Auto-save after selection
                                  saveCategories(product.id, newCategories);
                                }
                              }}
                              className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-sm border-gray-300 rounded-md mb-2"
                            >
                              <option value="">Select existing category</option>
                              {availableCategories
                                .filter(cat => !selectedCategories.includes(cat))
                                .map(category => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                            </select>

                            <div className="relative mb-2">
                              <input
                                type="text"
                                value={categoryValue}
                                onChange={(e) => setCategoryValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && categoryValue.trim()) {
                                    e.preventDefault();
                                    if (!selectedCategories.includes(categoryValue.trim())) {
                                      const newCategories = [...selectedCategories, categoryValue.trim()];
                                      setSelectedCategories(newCategories);
                                      // Auto-save after adding
                                      saveCategories(product.id, newCategories);
                                      setCategoryValue('');
                                    }
                                  }
                                }}
                                placeholder="Type to add a new category and press Enter"
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-sm border-gray-300 rounded-md"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory(null);
                                setSelectedCategories([]);
                                setCategoryValue('');
                              }}
                              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer flex flex-wrap gap-1"
                            onClick={() => startEditingCategories(product.id, product)}
                          >
                            {Array.isArray(product.categories) && product.categories.length > 0 ? (
                              product.categories.map((cat, index) => (
                                <span
                                  key={`${cat}-${index}`}
                                  className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"
                                >
                                  {cat}
                                </span>
                              ))
                            ) : product.category ? (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {product.category}
                              </span>
                            ) : (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                Uncategorized
                              </span>
                            )}
                            <span className="ml-1 text-xs text-blue-600">✏️</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description section - truncated with edit option */}
                    <div>
                      <span className="text-sm font-medium text-gray-500 block mb-1">Description:</span>
                      {editingDescription === product.id ? (
                        <div>
                          <textarea
                            value={descriptionValue}
                            onChange={(e) => setDescriptionValue(e.target.value)}
                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full text-sm border-gray-300 rounded-md"
                            rows={3}
                            placeholder="Enter product description"
                          />
                          <div className="mt-2 flex space-x-2">
                            <button
                              type="button"
                              disabled={savingDescription}
                              onClick={() => saveDescription(product.id)}
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                            >
                              {savingDescription ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer"
                          onClick={() => startEditingDescription(product.id, product.description)}
                        >
                          <p className="text-sm text-gray-800">
                            {product.description ? (
                              truncateText(product.description, 120)
                            ) : (
                              <span className="text-gray-400 italic">Add description...</span>
                            )}
                          </p>
                          <span className="text-xs text-blue-600">✏️ Edit</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-3 border-t flex justify-between items-center">
                    <Link
                      href={`/admin/products/edit/${product.id}`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      Edit Details
                    </Link>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 