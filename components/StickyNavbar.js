import Link from 'next/link';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useCart } from '../contexts/CartContext';
import { useState, useEffect } from 'react';

export default function StickyNavbar() {
  const { cart } = useCart();
  const [isVisible, setIsVisible] = useState(false);
  
  const itemCount = cart?.items?.reduce((total, item) => total + item.quantity, 0) || 0;
  
  useEffect(() => {
    const handleScroll = () => {
      // Show sticky nav after scrolling down 200px
      const currentScrollPos = window.pageYOffset;
      if (currentScrollPos > 200) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md transform transition-transform duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-green-700">
              Hearthfire Farm
            </Link>
          </div>
          <div className="flex items-center">
            <Link href="/cart" className="p-1 text-gray-400 hover:text-green-700 relative">
              <ShoppingCartIcon className="h-6 w-6" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 