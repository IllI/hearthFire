import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/AdminLayout';
import { useAuth } from '../../../contexts/AuthContext';
import ImageUploadHelper from '../../../components/ImageUploadHelper';

export default function NewProductForm() {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();
  
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
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [primaryImage, setPrimaryImage] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  
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
  
  // Check authentication
  useEffect(() => {
    if (!currentUser) {
      // If not logged in, wait 1 second and then redirect to login
      const timer = setTimeout(() => {
        router.push('/login?redirect=/admin/products/NewProductForm');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [currentUser, router]);
  
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
      setError('You must be logged in to create products');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get auth token
      const token = await currentUser.getIdToken();
      
      // Convert values
      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        stock: parseInt(formData.inventory) || 0,
        quantity: parseInt(formData.inventory) || 0, // For compatibility
        unit: formData.unit,
        organic: formData.organic,
        featured: formData.featured,
        images: formData.images,
        image: primaryImage // For compatibility
      };
      
      // Create product
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create product');
      }
      
      const data = await response.json();
      
      // Redirect to products list
      router.push('/admin/products');
    } catch (err) {
      console.error('Error creating product:', err);
      setError(err.message || 'Failed to create product. Please try again.');
    } finally {
      setLoading(false);
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
  
  if (!currentUser) {
    return (
      <AdminLayout title="New Product">
        <div className="container">
          <h1>New Product</h1>
          <div className="alert alert-warning">
            You must be logged in to create products. Redirecting to login...
          </div>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout title="New Product">
      <div className="container">
        <h1>New Product</h1>
        
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Product Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-control"
              rows="4"
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group col-md-4">
              <label htmlFor="price">Price ($)</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className="form-control"
                step="0.01"
                min="0"
                required
              />
            </div>
            
            <div className="form-group col-md-4">
              <label htmlFor="inventory">Inventory</label>
              <input
                type="number"
                id="inventory"
                name="inventory"
                value={formData.inventory}
                onChange={handleChange}
                className="form-control"
                min="0"
                required
              />
            </div>
            
            <div className="form-group col-md-4">
              <label htmlFor="unit">Unit</label>
              <select
                id="unit"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                className="form-control"
              >
                <option value="each">Each</option>
                <option value="lb">Pound (lb)</option>
                <option value="oz">Ounce (oz)</option>
                <option value="bunch">Bunch</option>
                <option value="pint">Pint</option>
                <option value="quart">Quart</option>
                <option value="gallon">Gallon</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <div className="category-input-container">
              <input
                type="text"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="form-control"
                list="category-options"
                placeholder="Select or enter a category"
              />
              <datalist id="category-options">
                {availableCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            {availableCategories.length > 0 && (
              <div className="category-suggestions">
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className="category-tag"
                    onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="form-group form-check">
            <input
              type="checkbox"
              id="organic"
              name="organic"
              checked={formData.organic}
              onChange={handleChange}
              className="form-check-input"
            />
            <label htmlFor="organic" className="form-check-label">Organic</label>
          </div>
          
          <div className="form-group form-check">
            <input
              type="checkbox"
              id="featured"
              name="featured"
              checked={formData.featured}
              onChange={handleChange}
              className="form-check-input"
            />
            <label htmlFor="featured" className="form-check-label">Featured Product</label>
          </div>
          
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
            />
            {errors.images && (
              <p className="mt-1 text-sm text-red-600">{errors.images}</p>
            )}
          </div>
          
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push('/admin/products')}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      
      <style jsx>{`
        .container {
          padding: 20px;
          max-width: 1000px;
        }
        
        h1 {
          margin-bottom: 20px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-row {
          display: flex;
          flex-wrap: wrap;
          margin-right: -10px;
          margin-left: -10px;
        }
        
        .col-md-4 {
          flex: 0 0 33.333333%;
          max-width: 33.333333%;
          padding-right: 10px;
          padding-left: 10px;
        }
        
        .form-control {
          display: block;
          width: 100%;
          padding: 0.375rem 0.75rem;
          font-size: 1rem;
          line-height: 1.5;
          color: #495057;
          background-color: #fff;
          background-clip: padding-box;
          border: 1px solid #ced4da;
          border-radius: 0.25rem;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }
        
        .form-check {
          position: relative;
          display: block;
          padding-left: 1.25rem;
        }
        
        .form-check-input {
          position: absolute;
          margin-top: 0.3rem;
          margin-left: -1.25rem;
        }
        
        .form-check-label {
          margin-bottom: 0;
        }
        
        .category-input-container {
          position: relative;
        }
        
        .category-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }
        
        .category-tag {
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .category-tag:hover {
          background-color: #e0e0e0;
        }
        
        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 30px;
        }
        
        .btn {
          display: inline-block;
          font-weight: 400;
          text-align: center;
          white-space: nowrap;
          vertical-align: middle;
          user-select: none;
          border: 1px solid transparent;
          padding: 0.375rem 0.75rem;
          font-size: 1rem;
          line-height: 1.5;
          border-radius: 0.25rem;
          transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out;
          cursor: pointer;
        }
        
        .btn-primary {
          color: #fff;
          background-color: #4285f4;
          border-color: #4285f4;
        }
        
        .btn-primary:hover {
          background-color: #3367d6;
          border-color: #3367d6;
        }
        
        .btn-secondary {
          color: #fff;
          background-color: #6c757d;
          border-color: #6c757d;
        }
        
        .btn-secondary:hover {
          background-color: #5a6268;
          border-color: #5a6268;
        }
        
        .btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        
        .alert {
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        
        .alert-danger {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        
        .alert-warning {
          background-color: #fff3cd;
          color: #856404;
          border: 1px solid #ffeeba;
        }
      `}</style>
    </AdminLayout>
  );
} 