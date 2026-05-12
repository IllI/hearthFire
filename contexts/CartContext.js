import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState({
    items: [],
    subtotal: 0,
    deliveryFee: 0,
    tax: 0,
    total: 0,
    promoCode: null,
    promoCodes: [],
    discount: 0
  });
  const [deliveryInfo, setDeliveryInfo] = useState({
    date: '',
    timeSlot: '',
    scheduleId: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: ''
    },
    instructions: ''
  });
  const { currentUser, userData } = useAuth();
  
  // Helper function to check localStorage availability
  const checkStorageAvailability = () => {
    const testKey = '__storage_test__';
    try {
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.error('localStorage not available:', e);
      return false;
    }
  };
  
  // Check localStorage on mount
  useEffect(() => {
    const isStorageAvailable = checkStorageAvailability();
    console.log('localStorage available:', isStorageAvailable);
    
    // Try to read existing cart data as a test
    if (isStorageAvailable) {
      try {
        const existingCart = localStorage.getItem('cart');
        console.log('Existing cart in storage:', existingCart ? 'Yes' : 'No');
      } catch (e) {
        console.error('Error checking existing cart:', e);
      }
    }
  }, []);
  
  // Load cart from localStorage on initial render
  useEffect(() => {
    try {
      console.log('Loading cart data from localStorage');
      let cartData = null;
      let cartSource = '';
      
      // Try to load from localStorage first
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          if (parsedCart && parsedCart.items && parsedCart.items.length > 0) {
            console.log('Successfully loaded cart from localStorage:', parsedCart);
            cartData = parsedCart;
            cartSource = 'localStorage';
          }
        } catch (error) {
          console.error('Error parsing saved cart from localStorage:', error);
        }
      }
      
      // If localStorage failed, try sessionStorage backup
      if (!cartData) {
        try {
          const sessionCart = sessionStorage.getItem('cart_backup');
          if (sessionCart) {
            const parsedSessionCart = JSON.parse(sessionCart);
            if (parsedSessionCart && parsedSessionCart.items && parsedSessionCart.items.length > 0) {
              console.log('Restored cart from sessionStorage backup:', parsedSessionCart);
              cartData = parsedSessionCart;
              cartSource = 'sessionStorage';
              
              // Also restore to localStorage
              localStorage.setItem('cart', sessionCart);
            }
          }
        } catch (sessionError) {
          console.error('Error checking sessionStorage backup:', sessionError);
        }
      }
      
      // Set the cart state if we found valid data
      if (cartData) {
        console.log(`Setting cart state with data from ${cartSource}`);
        setCart(cartData);
      } else {
        console.log('No valid cart data found in any storage');
      }
    } catch (storageError) {
      console.error('Error accessing storage for cart:', storageError);
    }
  }, []); // No dependencies to ensure it only runs once
  
  // Load delivery info from localStorage or populate from user data
  useEffect(() => {
    try {
      console.log('Loading delivery info from localStorage');
      const savedDeliveryInfo = localStorage.getItem('deliveryInfo');
      if (savedDeliveryInfo) {
        try {
          const parsedDeliveryInfo = JSON.parse(savedDeliveryInfo);
          console.log('Successfully loaded delivery info:', parsedDeliveryInfo);
          setDeliveryInfo(parsedDeliveryInfo);
        } catch (error) {
          console.error('Error parsing saved delivery info:', error);
        }
      } else if (userData?.address) {
        // Populate with user's address if available
        console.log('Populating delivery info from user data:', userData.address);
        setDeliveryInfo(prev => ({
          ...prev,
          phone: userData.phone || '',
          address: {
            street: userData.address.street || '',
            city: userData.address.city || '',
            state: userData.address.state || '',
            zip: userData.address.zip || ''
          }
        }));
      } else {
        console.log('No saved delivery info found and no user data available');
      }
    } catch (storageError) {
      console.error('Error accessing localStorage for delivery info:', storageError);
    }
  }, [userData]); // Only depends on userData
  
  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      console.log('Saving cart to localStorage:', cart);
      
      // Only save if we have a valid cart with items
      if (cart && cart.items) {
        // Save to both localStorage and sessionStorage for redundancy
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Backup to sessionStorage
        try {
          sessionStorage.setItem('cart_backup', JSON.stringify(cart));
        } catch (sessionError) {
          console.error('Error backing up cart to sessionStorage:', sessionError);
        }
      }
    } catch (storageError) {
      console.error('Error saving cart to localStorage:', storageError);
    }
  }, [cart]);
  
  // Save delivery info to localStorage whenever it changes
  useEffect(() => {
    try {
      console.log('Saving delivery info to localStorage:', deliveryInfo);
      localStorage.setItem('deliveryInfo', JSON.stringify(deliveryInfo));
    } catch (storageError) {
      console.error('Error saving delivery info to localStorage:', storageError);
    }
  }, [deliveryInfo]);
  
  // Calculate totals
  const calculateTotals = (items, promoCodes = cart.promoCodes || [], promoDiscount = cart.discount) => {
    const subtotal = items.reduce((total, item) => {
      // Ensure price is treated as a number
      const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
      const itemQuantity = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0;
      return total + (itemPrice * itemQuantity);
    }, 0);
    
    // Get orderType from deliveryInfo
    const orderType = deliveryInfo?.orderType || 'pickup';
    
    // Set the fee based on order type
    let deliveryFee = orderType === 'delivery' ? 10 : 0;
    
    // Apply discount if promo codes exist
    let discount = promoDiscount || 0;
    
    // Special case for DELIVFREE - don't double count
    const hasFreeDelivery = promoCodes.includes('DELIVFREE');
    if (hasFreeDelivery && orderType === 'delivery') {
      // For DELIVFREE promo, set delivery fee to 0
      deliveryFee = 0;
    }
    
    // Subtotal after discount (can't be negative)
    const discountedSubtotal = Math.max(subtotal - discount, 0);
    
    // Tax calculation (assuming 7% tax rate) on the discounted subtotal
    const tax = parseFloat((discountedSubtotal * 0.07).toFixed(2));
    
    // Ensure total is a valid number rounded to 2 decimal places
    const total = parseFloat((discountedSubtotal + deliveryFee + tax).toFixed(2));
    
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      deliveryFee: parseFloat(deliveryFee.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      promoCode: promoCodes.length > 0 ? promoCodes[0] : null, // For backwards compatibility
      promoCodes
    };
  };
  
  // Update the applyPromoCode function to use the backend API
  const applyPromoCode = async (code) => {
    if (!code) {
      // If no code provided, keep existing behavior for now - remove all codes
      setCart(prevCart => ({
        ...prevCart,
        promoCode: null,
        promoCodes: [],
        discount: 0,
        ...calculateTotals(prevCart.items, [], 0)
      }));
      return { success: true, message: 'Promo codes removed' };
    }

    try {
      // Check if code is already applied
      if (cart.promoCodes.includes(code.toUpperCase())) {
        return {
          success: false,
          message: 'This promo code has already been applied'
        };
      }
      
      // Call the API to validate the promo code
      const response = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        return { 
          success: false, 
          message: data.error || 'Invalid promo code'
        };
      }
      
      const promoInfo = data.promo;
      
      // Get existing discount
      let totalDiscount = cart.discount || 0;
      
      // Calculate additional discount amount based on the promo type
      let additionalDiscount = 0;
      
      if (promoInfo.type === 'fixed') {
        // Fixed amount discount
        additionalDiscount = promoInfo.value;
      } else if (promoInfo.type === 'percentage') {
        // Percentage discount
        additionalDiscount = (cart.subtotal * (promoInfo.value / 100));
      } else if (promoInfo.type === 'shipping') {
        // Free shipping (only applies if delivery is selected)
        additionalDiscount = deliveryInfo.orderType === 'delivery' ? 10 : 0;
      }
      
      // Apply the new promo code and update the discount
      setCart(prevCart => {
        const updatedPromoCodes = [...(prevCart.promoCodes || []), promoInfo.code];
        return {
          ...prevCart,
          promoCode: promoInfo.code, // Keep for backwards compatibility
          promoCodes: updatedPromoCodes,
          discount: totalDiscount + additionalDiscount,
          ...calculateTotals(prevCart.items, updatedPromoCodes, totalDiscount + additionalDiscount)
        };
      });
      
      return { 
        success: true, 
        message: `Promo code applied: ${promoInfo.description}`,
        discount: additionalDiscount
      };
      
    } catch (error) {
      console.error('Error applying promo code:', error);
      return { 
        success: false, 
        message: 'An error occurred while validating the promo code. Please try again.'
      };
    }
  };
  
  // Add item to cart
  const addToCart = (product, quantity = 1) => {
    if (!product) return;
    
    // Ensure we have valid product data
    const validProduct = {
      id: product.id,
      name: product.name || 'Unknown Product',
      // Make sure price is treated as a regular decimal number, not cents
      price: typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0,
      image: product.image || null,
      unit: product.unit || 'item'
    };
    
    setCart(prevCart => {
      // Check if item already exists in cart
      const existingItemIndex = prevCart.items.findIndex(item => item.id === validProduct.id);
      
      let updatedItems;
      if (existingItemIndex >= 0) {
        // Update quantity if already in cart
        updatedItems = [...prevCart.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity
        };
      } else {
        // Add new item
        updatedItems = [
          ...prevCart.items,
          {
            ...validProduct,
            quantity
          }
        ];
      }
      
      // Calculate new totals
      const totals = calculateTotals(updatedItems, prevCart.promoCodes, prevCart.discount);
      
      return {
        items: updatedItems,
        ...totals
      };
    });
  };
  
  // Update cart item quantity
  const updateQuantity = (productId, quantity) => {
    setCart(prevCart => {
      // If quantity is 0 or less, remove item
      if (quantity <= 0) {
        return removeFromCart(productId);
      }
      
      // Find and update item
      const updatedItems = prevCart.items.map(item => 
        item.id === productId ? { ...item, quantity } : item
      );
      
      // Calculate new totals
      const totals = calculateTotals(updatedItems, prevCart.promoCodes, prevCart.discount);
      
      return {
        items: updatedItems,
        ...totals
      };
    });
  };
  
  // Remove item from cart
  const removeFromCart = (productId) => {
    setCart(prevCart => {
      const updatedItems = prevCart.items.filter(item => item.id !== productId);
      
      // Calculate new totals
      const totals = calculateTotals(updatedItems, prevCart.promoCodes, prevCart.discount);
      
      return {
        items: updatedItems,
        ...totals
      };
    });
  };
  
  // Clear cart
  const clearCart = () => {
    setCart({
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      tax: 0,
      total: 0,
      promoCode: null,
      promoCodes: [],
      discount: 0
    });
  };
  
  // Update delivery information
  const updateDeliveryInfo = (info) => {
    setDeliveryInfo(prev => ({
      ...prev,
      ...info
    }));
  };
  
  // Check cart persistence status - can be used for debugging
  const checkCartPersistence = () => {
    try {
      const savedCart = localStorage.getItem('cart');
      const savedDeliveryInfo = localStorage.getItem('deliveryInfo');
      const sessionCart = sessionStorage.getItem('cart_backup');
      
      let localStorageCartSize = 0;
      let sessionStorageCartSize = 0;
      
      try {
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          localStorageCartSize = parsedCart.items ? parsedCart.items.length : 0;
        }
      } catch (e) {
        console.error('Error parsing cart from localStorage:', e);
      }
      
      try {
        if (sessionCart) {
          const parsedSessionCart = JSON.parse(sessionCart);
          sessionStorageCartSize = parsedSessionCart.items ? parsedSessionCart.items.length : 0;
        }
      } catch (e) {
        console.error('Error parsing cart from sessionStorage:', e);
      }
      
      return {
        storageAvailable: checkStorageAvailability(),
        localStorageCartExists: !!savedCart,
        localStorageCartSize: localStorageCartSize,
        sessionStorageCartExists: !!sessionCart,
        sessionStorageCartSize: sessionStorageCartSize,
        deliveryInfoInStorage: !!savedDeliveryInfo,
        currentCartSize: cart.items.length,
        mismatchDetected: (cart.items.length === 0 && (localStorageCartSize > 0 || sessionStorageCartSize > 0)),
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('Error checking cart persistence:', e);
      return {
        error: e.message,
        storageAvailable: false,
        timestamp: new Date().toISOString()
      };
    }
  };
  
  // Clear all cart storage (for troubleshooting)
  const resetCartStorage = () => {
    try {
      localStorage.removeItem('cart');
      localStorage.removeItem('deliveryInfo');
      
      // Reset the state to defaults
      setCart({
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        tax: 0,
        total: 0,
        promoCode: null,
        promoCodes: [],
        discount: 0
      });
      
      setDeliveryInfo({
        date: '',
        timeSlot: '',
        scheduleId: '',
        phone: '',
        address: {
          street: '',
          city: '',
          state: '',
          zip: ''
        },
        instructions: ''
      });
      
      return true;
    } catch (e) {
      console.error('Error resetting cart storage:', e);
      return false;
    }
  };
  
  // Helper function to manually sync cart from storage
  const syncCartFromStorage = () => {
    try {
      console.log('Manually syncing cart from storage');
      let cartData = null;
      
      // Try localStorage first
      try {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          if (parsedCart && parsedCart.items && parsedCart.items.length > 0) {
            cartData = parsedCart;
            console.log('Using cart data from localStorage:', parsedCart);
          }
        }
      } catch (e) {
        console.error('Error reading localStorage during manual sync:', e);
      }
      
      // Try sessionStorage as fallback
      if (!cartData) {
        try {
          const sessionCart = sessionStorage.getItem('cart_backup');
          if (sessionCart) {
            const parsedCart = JSON.parse(sessionCart);
            if (parsedCart && parsedCart.items && parsedCart.items.length > 0) {
              cartData = parsedCart;
              console.log('Using cart data from sessionStorage:', parsedCart);
              
              // Restore to localStorage
              localStorage.setItem('cart', sessionCart);
            }
          }
        } catch (e) {
          console.error('Error reading sessionStorage during manual sync:', e);
        }
      }
      
      // Update cart state if we found data
      if (cartData) {
        setCart(cartData);
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('Error during manual cart sync:', e);
      return false;
    }
  };

  // Public sync function that can be called from anywhere
  const forceCartSync = () => {
    return syncCartFromStorage();
  };
  
  return (
    <CartContext.Provider value={{
      cart,
      deliveryInfo,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      updateDeliveryInfo,
      applyPromoCode,
      checkCartPersistence,
      resetCartStorage,
      forceCartSync
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
} 