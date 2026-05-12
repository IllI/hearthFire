import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import Link from 'next/link';
import CheckoutForm from '../components/CheckoutForm';
import { useStripe } from '@stripe/react-stripe-js';
import { formatTimeSlot, formatDeliveryDate } from '../utils/formatters';
import Head from 'next/head';
import { CardElement } from '@stripe/react-stripe-js';

export default function Checkout() {
  const { cart, deliveryInfo, clearCart, checkCartPersistence, forceCartSync } = useCart();
  const { currentUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [cartRecoveryComplete, setCartRecoveryComplete] = useState(false);
  
  const stripe = useStripe();
  
  // Local validation function to avoid import issues
  const validatePhoneNumber = (phone) => {
    if (!phone) {
      return { isValid: false, error: 'Phone number is required' };
    }
    
    // Convert to string and remove all non-digits
    const cleaned = ('' + phone).replace(/\D/g, '');
    
    // Check length requirement
    if (cleaned.length !== 10) {
      return { 
        isValid: false, 
        error: cleaned.length < 10 
          ? 'Phone number must have 10 digits' 
          : 'Phone number cannot exceed 10 digits' 
      };
    }
    
    // Check for valid area code (can't start with 0 or 1)
    const areaCode = cleaned.substring(0, 3);
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
      return { isValid: false, error: 'Area code cannot start with 0 or 1' };
    }
    
    // Check for valid exchange code (second set of 3 digits)
    const exchangeCode = cleaned.substring(3, 6);
    if (exchangeCode.startsWith('0') || exchangeCode.startsWith('1')) {
      return { isValid: false, error: 'Exchange code cannot start with 0 or 1' };
    }
    
    return { isValid: true };
  };
  
  // Check if we're in development environment
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Check cart persistence on mount - First recovery step
  useEffect(() => {
    try {
      // Prevent redirect loops by checking for a recent redirect
      const lastRedirectTime = parseInt(sessionStorage.getItem('last_redirect_time') || '0');
      const currentTime = Date.now();
      const isRecentRedirect = (currentTime - lastRedirectTime) < 2000; // Within 2 seconds
      
      if (isRecentRedirect) {
        console.log('Detected recent redirect, breaking potential loop');
        // Clear redirect tracking to start fresh
        sessionStorage.removeItem('checkout_return_url');
        sessionStorage.removeItem('last_redirect_time');
        setCartRecoveryComplete(true);
        return;
      }
      
      // Keep track of the initial URL with query parameters
      const currentURL = window.location.href;
      console.log('Initial checkout URL:', currentURL);
      
      // If we have items in cart, we don't need to restore the URL - we're already good
      if (cart.items && cart.items.length > 0) {
        console.log('Cart already has items, skipping full recovery process');
        setCartRecoveryComplete(true);
        return;
      }
      
      // Prevent infinite reloads - check if we've already tried to reload
      const reloadAttempts = parseInt(sessionStorage.getItem('checkout_reload_attempts') || '0');
      
      // If we've already tried to reload once, don't try again
      if (reloadAttempts >= 1) {
        console.log(`Already attempted reload ${reloadAttempts} times, not attempting again`);
        sessionStorage.removeItem('checkout_reload_attempts'); // Reset for next time
        
        // Try manual sync first instead of redirecting
        const syncSuccessful = forceCartSync();
        
        if (syncSuccessful) {
          console.log('Manual cart sync was successful');
          setCartRecoveryComplete(true);
          return;
        }
        
        // Only redirect if we absolutely failed to recover the cart
        console.log('Manual cart sync failed, redirecting to cart page');
        // Record the redirect time to prevent loops
        sessionStorage.setItem('last_redirect_time', Date.now().toString());
        redirectToCart();
        return;
      } else {
        // First attempt: Try direct cart sync first
        const syncSuccessful = forceCartSync();
        
        if (syncSuccessful) {
          console.log('Cart sync successful on first try');
          setCartRecoveryComplete(true);
          return;
        }
        
        // Check if localStorage has cart data we can use
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          try {
            const parsedCart = JSON.parse(savedCart);
            if (parsedCart && parsedCart.items && parsedCart.items.length > 0) {
              console.log('Found cart data in localStorage - trying a reload');
              
              // Increment the reload counter to prevent infinite loops
              sessionStorage.setItem('checkout_reload_attempts', '1');
              
              // Store the current URL for restoration
              try {
                sessionStorage.setItem('checkout_return_url', currentURL);
              } catch (e) {
                console.error('Error saving return URL:', e);
              }
              
              // Force a single reload attempt
              window.location.reload();
              return;
            }
          } catch (parseError) {
            console.error('Error parsing saved cart:', parseError);
          }
        }
        
        // Last resort - redirect to cart
        console.log('No recoverable cart data found, redirecting to cart page');
        // Record the redirect time to prevent loops
        sessionStorage.setItem('last_redirect_time', Date.now().toString());
        redirectToCart();
        return;
      }
    } catch (e) {
      console.error('Error in cart recovery process:', e);
      setCartRecoveryComplete(true); // Still mark as complete to avoid hanging
    }
  }, []);
  
  // Determine if cash payment is allowed based on order type and environment
  const isCashPaymentAllowed = () => {
    // Always allow cash payment for pickup orders
    if (deliveryInfo.orderType === 'pickup') return true;
    
    // For delivery orders, only allow cash payment in development
    return isDevelopment;
  };
  
  // Helper function to redirect to cart while preserving query parameters
  const redirectToCart = () => {
    try {
      // Get the current URL parameters to preserve them if needed
      const currentUrl = new URL(window.location.href);
      const params = currentUrl.searchParams;
      const t = params.get('t');
      
      // Build a cart URL that preserves the timestamp parameter
      let cartUrl = '/cart';
      if (t) {
        cartUrl += `?t=${t}`;
      }
      
      // Save the original URL (with query params) in case we need to restore it
      sessionStorage.setItem('checkout_return_url', window.location.href);
      
      console.log(`Redirecting to cart with preserved parameters: ${cartUrl}`);
      router.push(cartUrl);
    } catch (e) {
      console.error('Error in redirectToCart:', e);
      // Fallback to basic redirect
      router.push('/cart');
    }
  };
  
  // Redirect if cart is empty or delivery info is incomplete
  // BUT ONLY AFTER cart recovery is complete
  useEffect(() => {
    // Skip validation until cart recovery is complete
    if (!cartRecoveryComplete) {
      console.log('Skipping validation - cart recovery not complete yet');
      return;
    }

    // Check if we were in the middle of a checkout and need to restore the URL
    const returnUrl = sessionStorage.getItem('checkout_return_url');
    if (returnUrl && window.location.href !== returnUrl) {
      sessionStorage.removeItem('checkout_return_url');
      console.log('Restoring checkout URL:', returnUrl);
      window.history.replaceState({}, '', returnUrl);
    }
    
    console.log('Running checkout validation with recovered cart:', cart);
    if (!cart || cart.items.length === 0) {
      console.log('Cart is empty after recovery, redirecting to cart page');
      redirectToCart();
      return;
    }
    
    // Check if we need to validate delivery or pickup information
    const isPickupOrder = deliveryInfo.orderType === 'pickup';
    
    console.log('Checkout page loaded, order type:', deliveryInfo.orderType);
    console.log('DeliveryInfo:', deliveryInfo);
    
    // Set default payment method based on order type and environment
    if (!isPickupOrder && !isDevelopment) {
      // Force credit card payment for delivery orders in production
      setPaymentMethod('credit');
    }
    
    if (isPickupOrder) {
      // Validate pickup information
      if (!deliveryInfo.pickupInfo || !deliveryInfo.pickupInfo.locationId || !deliveryInfo.pickupInfo.date) {
        console.log('Pickup information is incomplete, redirecting to cart');
        redirectToCart();
        return;
      }
    } else {
      // Validate delivery information
      if (!deliveryInfo.date || !deliveryInfo.timeSlot || 
          !deliveryInfo.address.street || !deliveryInfo.address.city || 
          !deliveryInfo.address.state || !deliveryInfo.address.zip) {
        console.log('Delivery information is incomplete, redirecting to cart');
        redirectToCart();
        return;
      }
    }
    
    // Validate phone number for both pickup and delivery
    const phoneValidation = validatePhoneNumber(deliveryInfo.phone);
    if (!phoneValidation.isValid) {
      console.log('Phone number is invalid, redirecting to cart');
      redirectToCart();
      return;
    }
    
    // Set default values if user is logged in
    if (currentUser) {
      currentUser.getIdTokenResult()
        .then((tokenResult) => {
          // Split display name into first and last name if available
          if (currentUser.displayName) {
            const nameParts = currentUser.displayName.split(' ');
            setFirstName(nameParts[0] || '');
            setLastName(nameParts.slice(1).join(' ') || '');
          }
          setCustomerEmail(currentUser.email || '');
        })
        .catch(err => console.error('Error getting user details:', err));
    }
  }, [cart, deliveryInfo, router, currentUser, cartRecoveryComplete]);
  
  // Reset payment method if order type changes and cash is not allowed
  useEffect(() => {
    // If order type is delivery in production, force credit card payment
    if (deliveryInfo.orderType === 'delivery' && !isDevelopment && paymentMethod === 'cash') {
      setPaymentMethod('credit');
    }
  }, [deliveryInfo.orderType]);
  
  const handlePaymentMethodChange = (e) => {
    setPaymentMethod(e.target.value);
    
    // Clear any previous payment error when switching methods
    setError(null);
    setPaymentInfo(null);
  };
  
  // Helper function to format delivery info for the API
  const getDeliveryInfo = () => {
    // Create a structured object with all delivery information
    return {
      fullName: `${firstName} ${lastName}`,
      email: customerEmail,
      phone: deliveryInfo.phone || '',
      address: deliveryInfo.address,
      instructions: deliveryInfo.instructions || '',
      date: deliveryInfo.date,
      timeSlot: deliveryInfo.timeSlot,
      type: deliveryInfo.orderType || 'delivery',
      deliverySchedule: {
        id: deliveryInfo.scheduleId,
        timeSlotId: deliveryInfo.timeSlot,
        date: deliveryInfo.date,
        timeSlot: deliveryInfo.timeSlotName || 'Not specified'
      },
      pickupInfo: deliveryInfo.pickupInfo || null
    };
  };
  
  const handlePaymentSuccess = async (paymentInfo) => {
    setPaymentProcessing(true);
    
    try {
      // Get our checkout data from session storage and context
      const deliveryInfo = getDeliveryInfo();
      const cartItems = cart.items;
      
      // Make sure the data is valid
      if (!deliveryInfo || !cartItems || cartItems.length === 0) {
        throw new Error('Missing required checkout information');
      }
      
      const order = {
        customerName: deliveryInfo.fullName,
        deliveryAddress: deliveryInfo.address,
        deliveryInstructions: deliveryInfo.deliveryInstructions || '',
        contactPhone: deliveryInfo.phone,
        contactEmail: deliveryInfo.email,
        items: cartItems.map(item => ({
          id: item.id,
          name: item.name,
          price: parseFloat(item.price),
          quantity: parseInt(item.quantity, 10),
          unit: item.unit || 'item',
          image: item.image
        })),
        scheduledDelivery: {
          scheduleId: deliveryInfo.deliverySchedule.id,
          timeSlotId: deliveryInfo.deliverySchedule.timeSlotId,
          date: deliveryInfo.deliverySchedule.date,
          timeSlot: deliveryInfo.deliverySchedule.timeSlot
        },
        paymentMethod: paymentMethod,
        total: parseFloat(cart.total)
      };
      
      // If payment option is credit card, add the payment info
      if (paymentMethod === 'credit' && paymentInfo) {
        order.paymentInfo = {
          paymentIntentId: paymentInfo.paymentIntentId,
          paymentMethodId: paymentInfo.id,
          last4: paymentInfo.last4,
          brand: paymentInfo.brand
        };
        
        // Add billing information if provided
        if (paymentInfo.billingName || paymentInfo.billingAddress) {
          order.billingDetails = {
            name: paymentInfo.billingName,
            ...paymentInfo.billingAddress && {
              address: {
                line1: paymentInfo.billingAddress.line1,
                line2: paymentInfo.billingAddress.line2 || undefined,
                city: paymentInfo.billingAddress.city,
                state: paymentInfo.billingAddress.state,
                postalCode: paymentInfo.billingAddress.postalCode,
                country: paymentInfo.billingAddress.country
              }
            }
          };
        }
      }
      
      // Submit the order to our API
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'Authorization': `Bearer ${await currentUser.getIdToken()}` } : {})
        },
        body: JSON.stringify(order)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }
      
      const orderData = await response.json();
      
      // If everything was successful, clear the cart
      clearCart();
      
      // Redirect to confirmation page
      router.push(`/orders/${orderData.orderId}/confirmation`);
    } catch (error) {
      console.error('Order submission error:', error);
      setError(error.message || 'There was a problem creating your order');
      setPaymentProcessing(false);
    }
  };
  
  const handlePaymentError = (errorMessage) => {
    setError(errorMessage);
  };
  
  const handleSubmitOrder = async (e, paymentData = null) => {
    if (e) e.preventDefault();
    
    // Prevent multiple submissions
    if (paymentProcessing) return;
    
    try {
      setPaymentProcessing(true);
      setError(null);
      
      // Validate customer information for guest orders
      if (!currentUser) {
        if (!firstName.trim() || !lastName.trim()) {
          setError('Please provide your full name');
          setPaymentProcessing(false);
          return;
        }
        
        if (!customerEmail.trim() || !customerEmail.includes('@')) {
          setError('Please provide a valid email address');
          setPaymentProcessing(false);
          return;
        }
      }
      
      // Validate phone number
      const phoneValidation = validatePhoneNumber(deliveryInfo.phone);
      if (!phoneValidation.isValid) {
        setError(phoneValidation.error);
        setPaymentProcessing(false);
        return;
      }
      
      // For credit payment, ensure payment was successful
      if (paymentMethod === 'credit' && !paymentData && !paymentInfo) {
        setError('Please complete the payment first');
        setPaymentProcessing(false);
        return;
      }
      
      let token = 'dev-token';
      // Try to get a real token if the user is logged in
      if (currentUser) {
        try {
          console.log('Getting token for user:', currentUser.uid);
          token = await currentUser.getIdToken();
        } catch (tokenError) {
          console.error('Error getting token:', tokenError);
          if (process.env.NODE_ENV !== 'development') {
            setError('Authentication error. Please try logging in again.');
            setPaymentProcessing(false);
            return;
          }
          // Proceed with dev token in development
        }
      } else {
        console.log('No user logged in, using guest checkout');
        if (process.env.NODE_ENV === 'production') {
          token = 'guest-token';
        }
      }
      
      // Use payment info if it was passed directly, otherwise use stored payment info
      const paymentInformation = paymentData || paymentInfo;
      
      // Prepare order data with customer information
      const orderData = {
        items: cart.items.map(item => ({
          productId: item.id,
          name: item.name,
          price: parseFloat(item.price),
          quantity: parseInt(item.quantity, 10),
          unit: item.unit || 'item',
          subtotal: parseFloat(item.price) * parseInt(item.quantity, 10)
        })),
        subtotal: parseFloat(cart.subtotal),
        tax: parseFloat(cart.tax),
        deliveryFee: parseFloat(cart.deliveryFee),
        total: parseFloat(cart.total),
        deliveryInfo: {
          date: deliveryInfo.date,
          timeSlot: deliveryInfo.timeSlot,
          scheduleId: deliveryInfo.scheduleId,
          phone: deliveryInfo.phone || '',
          address: deliveryInfo.address,
          instructions: deliveryInfo.instructions
        },
        paymentMethod,
        // For credit payment, add payment info
        paymentInfo: paymentMethod === 'credit' ? {
          paymentMethodId: paymentInformation?.id,
          paymentIntentId: paymentInformation?.paymentIntentId,
          last4: paymentInformation?.last4,
          brand: paymentInformation?.brand
        } : undefined,
        status: 'pending',
        paymentStatus: paymentMethod === 'credit' ? 'paid' : 'pending',
        // Always include customer information
        customerName: `${firstName} ${lastName}`,
        customerEmail: customerEmail || currentUser?.email || '',
        customerPhone: deliveryInfo.phone || '',
        orderType: deliveryInfo.orderType || 'delivery',
      };
      
      // Add order type specific information
      if (orderData.orderType === 'delivery') {
        // Add delivery-specific information
        orderData.delivery = {
          address: {
            street: deliveryInfo.address.street,
            city: deliveryInfo.address.city,
            state: deliveryInfo.address.state,
            zip: deliveryInfo.address.zip
          },
          date: deliveryInfo.date,
          timeSlot: deliveryInfo.timeSlot,
          instructions: deliveryInfo.instructions,
          scheduleId: deliveryInfo.scheduleId
        };
      } else {
        // Add pickup-specific information
        orderData.pickupInfo = {
          locationId: deliveryInfo.pickupInfo.locationId,
          locationName: deliveryInfo.pickupInfo.locationName,
          address: deliveryInfo.pickupInfo.address,
          date: deliveryInfo.pickupInfo.date,
          instructions: deliveryInfo.instructions || deliveryInfo.pickupInfo.instructions
        };
      }
      
      console.log('Submitting order with customer info:', {
        name: orderData.customerName,
        email: orderData.customerEmail,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: orderData.paymentStatus
      });
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to place order');
      }
      
      const orderResponse = await response.json();
      console.log('Order created successfully:', orderResponse.id);
      
      // Store the orderId in localStorage as a fallback
      try {
        localStorage.setItem('lastOrderId', orderResponse.id);
        localStorage.setItem('lastOrderTime', new Date().toISOString());
        // Also store user ID if available, to help with guest vs. authenticated orders
        if (currentUser) {
          localStorage.setItem('orderUserId', currentUser.uid);
        }
      } catch (storageError) {
        console.warn('Could not store order info in localStorage:', storageError);
      }
      
      // Ensure we have an ID before redirecting
      if (orderResponse && (orderResponse.id || orderResponse.orderId)) {
        const orderId = orderResponse.id || orderResponse.orderId;
        const confirmationUrl = `/orders/${orderId}/confirmation`;
        
        // Navigate directly to confirmation page
        // Don't use window.location.href as it causes a flash of the cart page
        router.push(confirmationUrl);
        
        // Note: The cart will be cleared on the confirmation page
        // We don't clear it here to avoid showing an empty cart during navigation
      } else {
        setError('Order was placed but confirmation details are missing. Please check your orders in your account.');
        setPaymentProcessing(false);
      }
      
    } catch (error) {
      console.error('Error placing order:', error);
      setError(error.message || 'An unexpected error occurred');
      setPaymentProcessing(false);
    }
    // Note: We don't set loading to false here because we're navigating away
  };
  
  if (!cart || cart.items.length === 0 || (deliveryInfo.orderType === 'delivery' && (!deliveryInfo.date || !deliveryInfo.timeSlot)) || (deliveryInfo.orderType === 'pickup' && (!deliveryInfo.pickupInfo || !deliveryInfo.pickupInfo.locationId))) {
    return (
      <Layout title="Checkout">
        <Head>
          <title>Checkout - Hearthfire Farm</title>
          <meta name="description" content="Complete your order" />
        </Head>
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-8">Checkout</h1>
          <div className="bg-white shadow-md rounded-lg p-8 text-center">
            <p className="text-lg text-gray-600 mb-6">
              Your cart is empty or {deliveryInfo.orderType === 'delivery' ? 'delivery' : 'pickup'} information is incomplete
            </p>
            <Link 
              href="/cart" 
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Return to Cart
            </Link>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Checkout">
      <Head>
        <title>Checkout - Hearthfire Farm</title>
        <meta name="description" content="Complete your order" />
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        
        {/* Loading Overlay */}
        {(loading || paymentProcessing) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-lg font-medium">
                {paymentProcessing ? 'Processing your order...' : 'Loading...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">Please don't close this page.</p>
            </div>
          </div>
        )}
        
        {orderSuccess ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">Order Placed!</h2>
            <p className="text-gray-600 mb-8">Your order has been successfully placed!</p>
            <Link href="/orders" className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700">
              View Orders
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left side: Customer info form */}
            <div className="md:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Customer Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full p-2 border rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full p-2 border rounded-md"
                      required
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>

                {/* Order Type Info Summary */}
                <div className="mt-6 pt-6 border-t">
                  <h2 className="text-xl font-semibold mb-4">
                    {deliveryInfo.orderType === 'pickup' ? 'Pickup' : 'Delivery'} Information
                  </h2>
                  
                  {deliveryInfo.orderType === 'pickup' ? (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="mb-2">
                        <span className="font-medium">Pickup Location:</span>{' '}
                        {deliveryInfo.pickupInfo?.locationName || 'Unknown Location'}
                      </div>
                      <div className="mb-2">
                        <span className="font-medium">Pickup Address:</span>{' '}
                        {deliveryInfo.pickupInfo?.address || 'Address not provided'}
                      </div>
                      <div className="mb-2">
                        <span className="font-medium">Pickup Date:</span>{' '}
                        {deliveryInfo.pickupInfo?.date 
                          ? (() => {
                              // Parse the date without timezone issues
                              const dateStr = deliveryInfo.pickupInfo.date;
                              console.log('Checkout page - Processing pickup date:', dateStr);
                              
                              // Clean the date string to ensure YYYY-MM-DD format
                              const cleanDateStr = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
                              console.log('Checkout page - Cleaned date string:', cleanDateStr);
                              
                              // Extract date components
                              const [year, month, day] = cleanDateStr.split('-').map(Number);
                              console.log('Checkout page - Date components:', { year, month, day });
                              
                              // Create date using UTC to avoid timezone issues
                              const date = new Date(Date.UTC(year, month - 1, day));
                              console.log('Checkout page - Created UTC date:', date.toISOString());
                              
                              // Format using fixed UTC methods
                              const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
                              const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                              const formattedDate = `${weekday}, ${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
                              console.log('Checkout page - Final formatted date:', formattedDate);
                              
                              return formattedDate;
                            })()
                          : 'Not specified'}
                      </div>
                      <div className="mb-2">
                        <span className="font-medium">Phone Number:</span>{' '}
                        <span className={`${!validatePhoneNumber(deliveryInfo.phone).isValid ? 'text-red-500 font-medium' : ''}`}>
                          {deliveryInfo.phone || 'Not provided'}
                          {!validatePhoneNumber(deliveryInfo.phone).isValid && (
                            <span className="ml-2 text-xs bg-red-100 text-red-700 py-1 px-2 rounded">
                              Invalid - Please update
                            </span>
                          )}
                        </span>
                      </div>
                      {deliveryInfo.instructions && (
                        <div className="mb-2">
                          <span className="font-medium">Special Instructions:</span>{' '}
                          {deliveryInfo.instructions}
                        </div>
                      )}
                      <Link href="/cart" className="text-green-600 text-sm hover:underline">
                        Edit Pickup Information
                      </Link>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="mb-2">
                        <span className="font-medium">Delivery Address:</span>{' '}
                        {`${deliveryInfo.address?.street || ''}, ${deliveryInfo.address?.city || ''}, ${deliveryInfo.address?.state || ''} ${deliveryInfo.address?.zip || ''}`}
                      </div>
                      <div className="mb-2">
                        <span className="font-medium">Delivery Date:</span>{' '}
                        {deliveryInfo.date ? formatDeliveryDate(deliveryInfo.date) : 'Not selected'}
                        <div className="text-xs text-gray-600 mt-1">
                          Your specific delivery window will be determined based on the most efficient route for all deliveries that day.
                          You will receive a confirmation email with your estimated delivery time.
                        </div>
                      </div>
                      <div className="mb-2">
                        <span className="font-medium">Phone Number:</span>{' '}
                        <span className={`${!validatePhoneNumber(deliveryInfo.phone).isValid ? 'text-red-500 font-medium' : ''}`}>
                          {deliveryInfo.phone || 'Not provided'}
                          {!validatePhoneNumber(deliveryInfo.phone).isValid && (
                            <span className="ml-2 text-xs bg-red-100 text-red-700 py-1 px-2 rounded">
                              Invalid - Please update
                            </span>
                          )}
                        </span>
                      </div>
                      {deliveryInfo.instructions && (
                        <div className="mb-2">
                          <span className="font-medium">Delivery Instructions:</span>{' '}
                          {deliveryInfo.instructions}
                        </div>
                      )}
                      <Link href="/cart" className="text-green-600 text-sm hover:underline">
                        Edit Delivery Information
                      </Link>
                    </div>
                  )}
                </div>

                {/* Payment section */}
                <div className="mt-6 pt-6 border-t">
                  <h2 className="text-xl font-semibold mb-4">Payment Information</h2>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    {/* Show explanation if it's a delivery order in production */}
                    {(deliveryInfo.orderType === 'delivery' && !isDevelopment) && (
                      <div className="mb-3 p-3 text-sm bg-blue-50 text-blue-700 rounded">
                        <strong>Note:</strong> All delivery orders require credit card payment. Cash payment is only available for pickup orders.
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Only show cash payment option if allowed */}
                      {isCashPaymentAllowed() && (
                        <div 
                          className={`border rounded-md p-4 cursor-pointer ${
                            paymentMethod === 'cash' ? 'bg-green-50 border-green-500' : ''
                          }`}
                          onClick={() => handlePaymentMethodChange({ target: { value: 'cash' } })}
                        >
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="paymentMethod"
                              checked={paymentMethod === 'cash'}
                              onChange={() => handlePaymentMethodChange({ target: { value: 'cash' } })}
                              className="mr-2"
                            />
                            <div>
                              <div className="font-medium">Cash on {deliveryInfo.orderType === 'pickup' ? 'Pickup' : 'Delivery'}</div>
                              <div className="text-sm text-gray-500">Pay when you receive your order</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div 
                        className={`border rounded-md p-4 cursor-pointer ${
                          paymentMethod === 'credit' ? 'bg-green-50 border-green-500' : ''
                        }`}
                        onClick={() => handlePaymentMethodChange({ target: { value: 'credit' } })}
                      >
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === 'credit'}
                            onChange={() => handlePaymentMethodChange({ target: { value: 'credit' } })}
                            className="mr-2"
                          />
                          <div>
                            <div className="font-medium">Credit Card</div>
                            <div className="text-sm text-gray-500">Pay securely with your credit card</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Credit Card Form */}
                  {paymentMethod === 'credit' && (
                    <div className="mt-4 p-4 border rounded-md">
                      <h3 className="text-lg font-medium mb-4">Card Details</h3>
                      <CheckoutForm 
                        onPaymentSuccess={(paymentInfo) => {
                          setPaymentInfo(paymentInfo);
                          handleSubmitOrder(null, paymentInfo);
                        }}
                        onPaymentError={(errorMessage) => {
                          setError(errorMessage);
                        }}
                        amount={Math.round((parseFloat(cart.subtotal) + (deliveryInfo.orderType === 'pickup' ? 0 : 10) + parseFloat(cart.tax)) * 100)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Order summary */}
            <div className="md:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
                
                <div className="border-b pb-4 mb-4">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-2">
                      <div>
                        <div className="font-medium">{item.name} × {item.quantity}</div>
                        <div className="text-sm text-gray-500">
                          {item.option ? `${item.option.name}` : ''}
                        </div>
                      </div>
                      <div className="font-medium">${(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between py-2">
                    <div>Subtotal</div>
                    <div>${parseFloat(cart.subtotal).toFixed(2)}</div>
                  </div>
                  
                  {cart.promoCodes && cart.promoCodes.length > 0 ? (
                    <div className="flex justify-between py-2">
                      <div>
                        <span>Promo Codes:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {cart.promoCodes.map(code => (
                            <span key={code} className="text-sm bg-green-100 text-green-800 py-0.5 px-2 rounded-full font-medium">
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                      {cart.discount > 0 && (
                        <div className="text-green-600">-${parseFloat(cart.discount).toFixed(2)}</div>
                      )}
                    </div>
                  ) : null}
                  
                  <div className="flex justify-between py-2">
                    <div>{deliveryInfo.orderType === 'pickup' ? 'Pickup' : 'Delivery'} Fee</div>
                    <div>
                      {cart.promoCodes && cart.promoCodes.includes('DELIVFREE') && deliveryInfo.orderType === 'delivery' 
                        ? '$0.00' 
                        : `$${deliveryInfo.orderType === 'pickup' ? '0.00' : '10.00'}`}
                    </div>
                  </div>
                  
                  <div className="flex justify-between py-2">
                    <div>Tax</div>
                    <div>${parseFloat(cart.tax).toFixed(2)}</div>
                  </div>
                </div>
                
                <div className="flex justify-between py-3 font-bold text-lg border-t">
                  <div>Total</div>
                  <div>${cart.total.toFixed(2)}</div>
                </div>
                
                {error && (
                  <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md">
                    {error}
                  </div>
                )}
                
                <button
                  onClick={handleSubmitOrder}
                  disabled={loading || !paymentMethod || orderSuccess}
                  className={`w-full mt-6 py-3 rounded-md font-medium text-white ${
                    loading || !paymentMethod || orderSuccess
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="mr-2">Processing...</span>
                    </span>
                  ) : orderSuccess ? (
                    'Order Placed!'
                  ) : (
                    `Place Order`
                  )}
                </button>
                
                {orderSuccess && (
                  <div className="mt-4 p-4 bg-green-50 text-green-600 rounded-md text-center">
                    Your order has been successfully placed! You will be redirected to the confirmation page.
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-500 mb-8">
                By placing your order, you agree to our <Link href="/terms" className="text-green-600 hover:underline">Terms & Conditions</Link> and <Link href="/privacy" className="text-green-600 hover:underline">Privacy Policy</Link>.
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
} 