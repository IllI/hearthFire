import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../../components/AdminLayout';
import ProductForm from '../../../../components/ProductForm';
import Link from 'next/link';
import Image from 'next/image';

// Creating a completely new page at a different URL to bypass caching - v3.0
export default function EditProductV2() {
  const router = useRouter();
  const { id } = router.query;
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated] = useState(new Date().toISOString());
  
  useEffect(() => {
    if (!id) return;
    
    async function fetchProduct() {
      try {
        console.log(`[Edit Product V3] Fetching product with ID: ${id}, timestamp: ${lastUpdated}`);
        const response = await fetch(`/api/products/${id}?t=${Date.now()}`); // Add cache-busting parameter
        
        if (!response.ok) {
          throw new Error('Failed to fetch product');
        }
        
        const data = await response.json();
        console.log('[Edit Product V3] Loaded product data:', data);
        
        // Create a normalized product with consistent image handling
        const normalizedProduct = { ...data };
        
        // Handle different image field formats
        normalizedProduct.images = [];
          
        // Check for single image field and convert to array
        if (normalizedProduct.image) {
          console.log('[Edit Product V3] Found single image field:', normalizedProduct.image);
          normalizedProduct.images.push(normalizedProduct.image);
        }
          
        // Also check for imageUrl field
        if (normalizedProduct.imageUrl) {
          console.log('[Edit Product V3] Found imageUrl field:', normalizedProduct.imageUrl);
          normalizedProduct.images.push(normalizedProduct.imageUrl);
        }
        
        // Handle image array if it exists already
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
          console.log('[Edit Product V3] Found existing images array:', data.images);
          // Add any existing images that aren't already included
          data.images.forEach(img => {
            if (!normalizedProduct.images.includes(img)) {
              normalizedProduct.images.push(img);
            }
          });
        }
        
        console.log('[Edit Product V3] Normalized images array:', normalizedProduct.images);
        
        // Ensure images are properly formatted
        if (normalizedProduct.images && normalizedProduct.images.length > 0) {
          normalizedProduct.images = normalizedProduct.images.map(img => {
            if (!img) return null;
            
            // If it's already a full URL, use it as is
            if (img.startsWith('http://') || img.startsWith('https://')) {
              return img;
            }
            // If it's a relative path, make it absolute
            if (img.startsWith('/')) {
              return `${window.location.origin}${img}`;
            }
            // Otherwise assume it's a relative path without leading slash
            return `${window.location.origin}/${img}`;
          }).filter(Boolean); // Remove any null/undefined values
        }
        
        console.log('[Edit Product V3] Final normalized product data:', normalizedProduct);
        setProduct(normalizedProduct);
      } catch (err) {
        console.error('[Edit Product V3] Error loading product:', err);
        setError('Failed to load product. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchProduct();
  }, [id, lastUpdated]);
  
  if (loading) {
    return (
      <AdminLayout title="Edit Product (New Version)">
        <div className="p-6 text-center">
          <div className="animate-spin h-8 w-8 mx-auto mb-4 border-t-2 border-b-2 border-green-500 rounded-full"></div>
          Loading product...
        </div>
      </AdminLayout>
    );
  }
  
  if (error) {
    return (
      <AdminLayout title="Edit Product (New Version)">
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
        
        <div className="mt-4">
          <Link 
            href="/admin/products"
            className="text-green-600 hover:text-green-800"
          >
            &larr; Back to Products
          </Link>
        </div>
      </AdminLayout>
    );
  }
  
  // Add debug information
  const imageInfo = product?.images?.length 
    ? `Product has ${product.images.length} images: ${product.images.join(', ')}`
    : 'No images available';
  
  return (
    <AdminLayout title={`Edit ${product?.name || 'Product'} (New Version)`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Product (V3)</h1>
        <Link 
          href="/admin/products" 
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
        >
          Cancel
        </Link>
      </div>
      
      {/* Debug info */}
      <div className="mb-4 p-4 bg-yellow-100 text-sm text-gray-800 rounded-lg border border-yellow-200">
        <h3 className="font-bold text-yellow-800 mb-2">Debug Information</h3>
        <p><strong>Image Debug:</strong> {imageInfo}</p>
        <p><strong>Image Field:</strong> {product?.image || 'Not set'}</p>
        <p><strong>Version:</strong> V3.0 (Created {new Date().toLocaleString()})</p>
        <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
        <p><strong>Origin:</strong> <span id="page-origin">{typeof window !== 'undefined' ? window.location.origin : 'Server-side'}</span></p>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <ProductForm product={product} isEdit={true} />
      </div>
    </AdminLayout>
  );
} 