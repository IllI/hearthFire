import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch('/api/products');
        
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        
        const data = await response.json();
        setProducts(data);
      } catch (err) {
        console.error('Error loading products:', err);
        setError('Failed to load products. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchProducts();
  }, []);
  
  if (loading) {
    return <div className="text-center py-10">Loading products...</div>;
  }
  
  if (error) {
    return <div className="text-center py-10 text-red-500">{error}</div>;
  }
  
  if (products.length === 0) {
    return <div className="text-center py-10">No products found.</div>;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-8">
      {products.map((product) => (
        <div key={product.id} className="border rounded-lg overflow-hidden shadow-md">
          <div className="relative h-48">
            {product.images && product.images.length > 0 ? (
              <Image 
                src={product.images[0]} 
                alt={product.name} 
                fill 
                className="object-cover"
              />
            ) : (
              <div className="bg-gray-200 w-full h-full flex items-center justify-center">
                <span className="text-gray-500">No image</span>
              </div>
            )}
          </div>
          
          <div className="p-4">
            <h3 className="text-lg font-semibold">{product.name}</h3>
            <p className="text-gray-600 line-clamp-2 h-12">{product.description}</p>
            
            <div className="flex justify-between items-center mt-4">
              <span className="text-green-600 font-bold">
                ${(product.price / 100).toFixed(2)} / {product.unit}
              </span>
              
              <Link 
                href={`/products/${product.id}`}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 