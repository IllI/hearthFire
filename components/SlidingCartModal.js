import { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function SlidingCartModal({ isOpen, onClose }) {
  const { cart, updateQuantity, removeFromCart } = useCart();
  
  // Close modal when ESC key is pressed
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // Prevent scroll on body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-40 transition-opacity"
        onClick={onClose}
      ></div>
      
      {/* Modal panel */}
      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-3 border-b flex justify-between items-center sticky top-0 bg-white z-10">
            <h2 className="text-xl font-bold">Your Cart ({cart.items.length} items)</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.items.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">Your cart is empty</p>
                <button 
                  onClick={onClose}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <ul className="divide-y">
                {cart.items.map((item) => (
                  <li key={item.id} className="py-4 flex">
                    {/* Product image */}
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border bg-gray-100">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover object-center"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full w-full">
                          <span className="text-xs text-gray-500">No image</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Product details */}
                    <div className="ml-4 flex flex-1 flex-col">
                      <div>
                        <div className="flex justify-between">
                          <h3 className="text-base font-medium">{item.name}</h3>
                          <p className="text-base font-medium">${item.price.toFixed(2)}</p>
                        </div>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      
                      <div className="flex mt-2 space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="text-sm text-gray-600 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Footer with totals and checkout button */}
          {cart.items.length > 0 && (
            <div className="border-t px-4 py-4 bg-gray-50">
              <div className="flex justify-between mb-2">
                <span>Subtotal</span>
                <span>${cart.subtotal.toFixed(2)}</span>
              </div>
              
              {cart.deliveryFee > 0 && (
                <div className="flex justify-between mb-2">
                  <span>Delivery Fee</span>
                  <span>${cart.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                <span>Total</span>
                <span>${cart.total.toFixed(2)}</span>
              </div>
              
              <div className="mt-4 space-y-2">
                <Link
                  href="/cart"
                  className="block w-full bg-green-600 text-white text-center px-4 py-3 rounded-md hover:bg-green-700"
                  onClick={onClose}
                >
                  Checkout
                </Link>
                
                <button
                  onClick={onClose}
                  className="block w-full bg-white border border-gray-300 text-gray-700 text-center px-4 py-3 rounded-md hover:bg-gray-50"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 