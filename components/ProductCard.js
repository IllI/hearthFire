import { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import Link from 'next/link';
import Image from 'next/image';

export default function ProductCard({ product, onAddToCart, setCartModalOpen }) {
  const { cart, addToCart, updateQuantity } = useCart();
  const [isInCart, setIsInCart] = useState(false);
  const [currentQuantity, setCurrentQuantity] = useState(0);
  const [showQuantitySelector, setShowQuantitySelector] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [imageError, setImageError] = useState(false);
  
  // Support both stock and quantity fields for backward compatibility
  const inventoryCount = product.quantity !== undefined ? product.quantity : (product.stock || 0);
  
  // Determine if product has low stock (less than 4 items)
  const isLowStock = inventoryCount > 0 && inventoryCount < 4;
  
  // Determine if product is in stock
  const isInStock = inventoryCount > 0;
  
  // Check if product is already in cart
  useEffect(() => {
    const cartItem = cart.items.find(item => item.id === product.id);
    if (cartItem) {
      setIsInCart(true);
      setCurrentQuantity(cartItem.quantity);
      setSelectedQuantity(cartItem.quantity);
    } else {
      setIsInCart(false);
      setCurrentQuantity(0);
      setSelectedQuantity(1);
    }
  }, [cart.items, product.id]);

  const handleAddOrUpdate = () => {
    if (isInCart) {
      // If already in cart, show quantity selector with current quantity
      setSelectedQuantity(currentQuantity);
      setShowQuantitySelector(true);
    } else {
      // If not in cart, show quantity selector
      setSelectedQuantity(1);
      setShowQuantitySelector(true);
    }
  };
  
  const handleConfirm = () => {
    if (isInCart) {
      // Update quantity if already in cart
      updateQuantity(product.id, selectedQuantity);
    } else {
      // Add to cart if not already in cart
      addToCart(product, selectedQuantity);
    }
    
    // Hide the quantity selector
    setShowQuantitySelector(false);
    
    // Show the sliding cart modal
    setCartModalOpen(true);
  };
  
  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value);
    if (value > 0 && value <= inventoryCount) {
      setSelectedQuantity(value);
    }
  };
  
  const handleImageError = (e) => {
    setImageError(true);
    // Use a timestamp to prevent caching
    const timestamp = new Date().getTime();
    e.target.src = `/api/fallback-placeholder?name=${encodeURIComponent(product.name)}&t=${timestamp}`;
  };

  // Check if the product has a valid image
  const hasImage = product.image || (product.images && product.images.length > 0);
  
  // If no image is available, set error state to use placeholder
  useEffect(() => {
    if (!hasImage) {
      setImageError(true);
    }
  }, [hasImage]);

  // Get the appropriate image source with cache-busting for placeholder
  const timestamp = new Date().getTime();
  
  // Add console log to debug the image URLs
  useEffect(() => {
    if (product && product.id) {
      console.log(`Product ${product.id} (${product.name}) image data:`, {
        image: product.image,
        images: product.images,
        hasMainImage: !!product.image,
        hasImages: Array.isArray(product.images) && product.images.length > 0
      });
    }
  }, [product]);
  
  const imageSrc = imageError 
    ? `/api/fallback-placeholder?name=${encodeURIComponent(product.name)}&t=${timestamp}`
    : (product.image || (product.images && product.images.length > 0 ? product.images[0] : null));

  // Add cache-busting parameter to the image URL to prevent browser caching
  const imageUrlWithCacheBusting = imageSrc ? 
    (imageSrc.includes('?') ? `${imageSrc}&t=${timestamp}` : `${imageSrc}?t=${timestamp}`) 
    : null;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
      {/* Product Image */}
      <div className="relative h-48">
        <img 
          src={imageUrlWithCacheBusting}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
          {/* Organic badge */}
          {product.organic && (
            <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Organic
            </div>
          )}
          
          {/* Featured badge */}
          {product.featured && (
            <div className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Featured
            </div>
          )}
          
          {/* Low stock badge */}
          {isLowStock && (
            <div className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Only {inventoryCount} left
            </div>
          )}
        </div>
      </div>
      
      {/* Product Info */}
      <div className="p-4 flex-grow">
        <h3 className="text-lg font-semibold mb-1">{product.name}</h3>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {product.description ? product.description.substring(0, 100) + (product.description.length > 100 ? '...' : '') : ''}
        </p>
        
        <div className="mt-auto flex justify-between items-center">
          <span className="text-green-600 font-bold">${product.price.toFixed(2)}</span>
          
          {!showQuantitySelector ? (
            <button
              onClick={handleAddOrUpdate}
              disabled={!isInStock}
              className={`px-4 py-2 rounded-md ${isInStock 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-300 cursor-not-allowed text-gray-500'}`}
            >
              {!isInStock ? 'Sold Out' : (isInCart ? 'Update' : 'Add to bag')}
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <button
                  className="bg-gray-200 px-2 py-1 rounded-l-md"
                  onClick={() => setSelectedQuantity(prev => Math.max(1, prev - 1))}
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={inventoryCount}
                  value={selectedQuantity}
                  onChange={handleQuantityChange}
                  className="w-12 text-center border-y py-1"
                />
                <button
                  className="bg-gray-200 px-2 py-1 rounded-r-md"
                  onClick={() => setSelectedQuantity(prev => Math.min(inventoryCount, prev + 1))}
                >
                  +
                </button>
              </div>
              <button
                onClick={handleConfirm}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Link to product details (optional) */}
      <Link 
        href={`/products/${product.id}`}
        className="py-2 px-4 bg-gray-100 text-center text-gray-600 hover:bg-gray-200 text-sm"
      >
        View Details
      </Link>
    </div>
  );
}