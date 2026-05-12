import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '../../contexts/CartContext';
import StickyNavbar from '../../components/StickyNavbar';

export default function ProductDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { addToCart: addItemToCart, checkCartPersistence } = useCart();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  
  useEffect(() => {
    if (!id) return;
    
    async function fetchProduct() {
      try {
        const response = await fetch(`/api/products/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch product');
        }
        
        const data = await response.json();
        setProduct(data);
      } catch (err) {
        console.error('Error loading product:', err);
        setError('Failed to load product details. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchProduct();
  }, [id]);
  
  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value);
    // Prioritize quantity over stock
    const inventoryCount = product?.quantity !== undefined ? product.quantity : (product?.stock || 1);
    if (value > 0 && value <= inventoryCount) {
      setQuantity(value);
    }
  };
  
  const handleAddToCart = () => {
    // Use the addItemToCart from context
    addItemToCart(product, quantity);
    setAddedToCart(true);
    // Reset after a short delay
    setTimeout(() => setAddedToCart(false), 2000);
  };
  
  if (loading) {
    return <div className="text-center py-10">Loading product details...</div>;
  }
  
  if (error) {
    return <div className="text-center py-10 text-red-500">{error}</div>;
  }
  
  if (!product) {
    return <div className="text-center py-10">Product not found.</div>;
  }
  
  return (
    <>
      {/* Sticky navigation that appears when scrolling */}
      <StickyNavbar />
      
      <div className="max-w-6xl mx-auto p-4">
        <Link href="/products" className="text-green-600 hover:underline mb-6 inline-block">
          &larr; Back to Products
        </Link>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="relative h-96 bg-gray-100 rounded-lg overflow-hidden">
            {product.images && product.images.length > 0 ? (
              <Image 
                src={product.images[0]} 
                alt={product.name} 
                fill 
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-500">No image available</span>
              </div>
            )}
          </div>
          
          <div>
            <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
            
            <div className="flex items-center mb-4">
              <span className="text-2xl text-green-600 font-bold">
                ${(product.price).toFixed(2)} / {product.unit}
              </span>
              
              {product.organic && (
                <span className="ml-4 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                  Organic
                </span>
              )}
            </div>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <p className="text-gray-700">{product.description}</p>
            </div>
            
            {product.nutrition && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Nutrition Facts</h2>
                <div className="bg-gray-50 p-4 rounded">
                  <div className="grid grid-cols-2 gap-2">
                    <div>Calories: {product.nutrition.calories}</div>
                    <div>Protein: {product.nutrition.protein}g</div>
                    <div>Carbs: {product.nutrition.carbs}g</div>
                    <div>Fat: {product.nutrition.fat}g</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-6">
              <label htmlFor="quantity" className="block font-medium mb-2">
                Quantity:
              </label>
              <div className="flex items-center">
                <button
                  className="bg-gray-200 px-3 py-1 rounded-l"
                  onClick={() => quantity > 1 && setQuantity(quantity - 1)}
                >
                  -
                </button>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max={product.quantity !== undefined ? product.quantity : (product.stock || 0)}
                  value={quantity}
                  onChange={handleQuantityChange}
                  className="w-16 text-center border-t border-b py-1"
                />
                <button
                  className="bg-gray-200 px-3 py-1 rounded-r"
                  onClick={() => {
                    const maxInventory = product.quantity !== undefined ? product.quantity : (product.stock || 0);
                    if (quantity < maxInventory) setQuantity(quantity + 1);
                  }}
                >
                  +
                </button>
                
                <span className="ml-4 text-gray-600">
                  {product.quantity !== undefined ? product.quantity : (product.stock || 0)} {product.unit}s available
                </span>
              </div>
            </div>
            
            <button
              onClick={handleAddToCart}
              disabled={product.quantity <= 0 && (product.stock || 0) <= 0}
              className={`w-full py-3 rounded-lg font-bold text-white ${
                (product.quantity > 0 || (product.stock || 0) > 0)
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {(product.quantity > 0 || (product.stock || 0) > 0) ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 