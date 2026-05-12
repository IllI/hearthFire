import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../../../contexts/CartContext';
import Layout from '../../../components/Layout';
import Link from 'next/link';
import { format } from 'date-fns';
import styles from '../../../styles/OrderConfirmation.module.css';
import { formatTimeSlot, formatDeliveryDate, formatPhoneNumber } from '../../../utils/formatters';

// Add a consistent date formatter function that handles timezone issues
const formatDateWithoutTimezone = (dateStr) => {
  if (!dateStr) return 'N/A';
  
  try {
    // Clean the date string to YYYY-MM-DD format
    const cleanDateStr = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
    console.log('Order confirmation - Processing date:', cleanDateStr);
    
    // Extract date components
    const [year, month, day] = cleanDateStr.split('-').map(Number);
    console.log('Order confirmation - Date components:', { year, month, day });
    
    // Create date using UTC to avoid timezone issues
    const date = new Date(Date.UTC(year, month - 1, day));
    console.log('Order confirmation - Created UTC date:', date.toISOString());
    
    // Format using fixed UTC methods
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const formattedDate = `${weekday}, ${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
    console.log('Order confirmation - Final formatted date:', formattedDate);
    
    return formattedDate;
  } catch (error) {
    console.error('Error formatting date in order confirmation:', error);
    return dateStr || 'N/A';
  }
};

export default function OrderConfirmation() {
  const { currentUser } = useAuth();
  const { clearCart } = useCart();
  const router = useRouter();
  const { id } = router.query;
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasCleared, setHasCleared] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  
  // Fetch order data only when router is ready and we have an ID
  useEffect(() => {
    // Only execute this effect when the router is ready and we haven't already fetched
    if (!router.isReady || hasFetched) {
      return;
    }

    // If no ID in URL, try to get from localStorage as fallback
    const orderId = id || localStorage.getItem('lastOrderId');
    
    if (!orderId) {
      console.error('No order ID available in URL or localStorage');
      setError('Order ID not found. Please check your order history.');
      setLoading(false);
      setHasFetched(true);
      return;
    }
    
    console.log(`Loading order confirmation for order: ${orderId}`);
    
    async function fetchOrder() {
      try {
        let token = 'dev-token';
        
        // Try to get a real token if the user is logged in
        if (currentUser) {
          try {
            token = await currentUser.getIdToken();
          } catch (tokenErr) {
            console.warn('Failed to get user token, using dev token:', tokenErr);
          }
        }
        
        const response = await fetch(`/api/orders/${orderId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch order');
        }
        
        const data = await response.json();
        setOrder(data);
        
        // Store the last successful order ID in case we need it
        try {
          localStorage.setItem('lastOrderId', data.id || orderId);
          localStorage.setItem('lastOrderTime', new Date().toISOString());
          
          // Also store order type and orderId for better context
          if (data.orderType) {
            localStorage.setItem('lastOrderType', data.orderType);
          }
          
          // Store minimal order details for future reference
          try {
            const minimalOrderData = {
              id: data.id || orderId,
              orderType: data.orderType || 'unknown',
              timestamp: new Date().toISOString(),
              items: Array.isArray(data.items) ? data.items.length : 0
            };
            localStorage.setItem('lastOrderDetails', JSON.stringify(minimalOrderData));
          } catch (jsonError) {
            console.warn('Could not store order details in localStorage:', jsonError);
          }
        } catch (storageError) {
          console.warn('Could not store order info in localStorage:', storageError);
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Failed to load order details. Please try again later.');
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    }
    
    fetchOrder();
  }, [id, currentUser, router.isReady, hasFetched]);
  
  // Separate useEffect for clearing the cart to avoid re-fetching
  useEffect(() => {
    if (order && !hasCleared) {
      // Clear cart after successfully loading the order confirmation page
      clearCart();
      setHasCleared(true);
    }
  }, [order, clearCart, hasCleared]);
  
  if (loading) {
    return (
      <Layout title="Order Confirmation">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
          <p className="text-center mt-4">Loading your order confirmation...</p>
        </div>
      </Layout>
    );
  }
  
  if (error || !order) {
    return (
      <Layout title="Order Confirmation">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-red-50 p-4 rounded-md">
            <h1 className="text-xl font-bold text-red-800">Error</h1>
            <p className="text-red-700">{error || 'Order not found'}</p>
            <div className="mt-4">
              <Link href="/account/orders" className="text-green-600 hover:text-green-800">
                View your orders
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Order Confirmation">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {!order ? (
          <div className="bg-red-50 p-4 rounded-md">
            <h1 className="text-xl font-bold text-red-800">Error</h1>
            <p className="text-red-700">Order information could not be loaded</p>
            <div className="mt-4">
              <Link href="/account/orders" className="text-green-600 hover:text-green-800">
                View your orders
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-green-50 p-6 rounded-lg mb-8">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-medium text-green-800">Order Placed Successfully!</h1>
                  <p className="text-green-700">Thank you for your order. Your order number is: <strong>{order.orderId}</strong></p>
                  
                  {!currentUser && (
                    <p className="mt-2 text-sm text-green-700">
                      <strong>Note:</strong> As a guest user, you can only view this order confirmation now. 
                      <Link href="/signup" className="underline ml-1">Create an account</Link> to access your order history anytime.
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
              <div className="border-b px-6 py-4">
                <h2 className="text-lg font-medium">Order Details</h2>
              </div>
              
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className={`${styles.detailSection}`}>
                    <h3>{order.orderType === 'pickup' ? 'Pickup Details' : 'Delivery Details'}</h3>
                    <div className={styles.detailContent}>
                      {order.orderType === 'pickup' && order.pickupInfo ? (
                        // Pickup information
                        <>
                          {order.pickupInfo.date ? (
                            <>
                              Date: {formatDateWithoutTimezone(order.pickupInfo.date)}<br />
                            </>
                          ) : (
                            <>
                              Date: N/A<br />
                            </>
                          )}
                          Time: {order.pickupInfo?.time || '9:00 AM - 2:00 PM'}<br />
                          Location: {order.pickupInfo.locationName || 'N/A'}<br />
                          Address: {order.pickupInfo.address || 'N/A'}<br />
                          Phone: {order.customerPhone ? (
                            <a href={`tel:${(order.customerPhone).replace(/\D/g, '')}`} className="text-green-600 hover:underline">
                              {formatPhoneNumber(order.customerPhone)}
                            </a>
                          ) : 'N/A'}<br />
                          {order.pickupInfo.instructions && (
                            <>Instructions: {order.pickupInfo.instructions}<br /></>
                          )}
                        </>
                      ) : order.deliveryInfo ? (
                        // Delivery information
                        <>
                          {order.deliveryInfo.date ? (
                            <>
                              Date: {formatDeliveryDate(order.deliveryInfo.date)}<br />
                            </>
                          ) : (
                            <>
                              Date: N/A<br />
                            </>
                          )}
                          Time: {formatTimeSlot(order.deliveryInfo?.timeSlot)}<br />
                          Address: {order.deliveryInfo?.address ? (
                            `${order.deliveryInfo.address.street || ''}, 
                            ${order.deliveryInfo.address.city || ''}, 
                            ${order.deliveryInfo.address.state || ''} 
                            ${order.deliveryInfo.address.zip || ''}`
                          ) : (
                            'N/A'
                          )}<br />
                          Phone: {order.customerPhone || order.deliveryInfo?.phone ? (
                            <a href={`tel:${(order.customerPhone || order.deliveryInfo?.phone).replace(/\D/g, '')}`} className="text-green-600 hover:underline">
                              {formatPhoneNumber(order.customerPhone || order.deliveryInfo?.phone)}
                            </a>
                          ) : 'N/A'}<br />
                          {order.deliveryInfo.instructions && (
                            <>Instructions: {order.deliveryInfo.instructions}<br /></>
                          )}
                        </>
                      ) : (
                        `No ${order.orderType === 'pickup' ? 'pickup' : 'delivery'} information available`
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">Payment Information</h3>
                    <p className="text-gray-700">
                      Method: {order.paymentMethod === 'credit' ? 'Credit Card (Pay at Delivery)' : order.paymentMethod === 'cash' ? 'Cash on Delivery' : 'Not specified'}<br />
                      Status: <span className="capitalize">{order.paymentStatus || 'pending'}</span>
                    </p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Order Items</h3>
                  <div className="border rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{item.name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">${parseFloat(item.price).toFixed(2)}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">{item.quantity}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">${parseFloat(item.subtotal).toFixed(2)}</div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                              No items found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between mb-2">
                    <span>Subtotal</span>
                    <span>${parseFloat(order.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>{order.orderType === 'pickup' ? 'Pickup' : 'Delivery'} Fee</span>
                    <span>${order.orderType === 'pickup' ? '0.00' : parseFloat(order.deliveryFee || 10).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>Tax</span>
                    <span>${parseFloat(order.tax || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>${(parseFloat(order.subtotal || 0) + (order.orderType === 'pickup' ? 0 : parseFloat(order.deliveryFee || 10)) + parseFloat(order.tax || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <Link
                href="/products"
                className={`${styles.continueShoppingButton} bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded shadow-md transition-all duration-200 flex items-center justify-center`}
              >
                Continue Shopping
              </Link>
              
              {currentUser ? (
                <Link
                  href="/account/orders"
                  className={`${styles.viewOrdersButton} bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded shadow-md border border-gray-300 transition-all duration-200 flex items-center justify-center`}
                >
                  View My Orders
                </Link>
              ) : (
                <div className="bg-blue-50 p-4 mt-4 rounded-md w-full">
                  <p className="text-blue-800">
                    <strong>Note:</strong> As a guest user, this order confirmation is only viewable now. 
                    To access your order history in the future, please <Link href="/login" className="text-blue-600 hover:text-blue-800 underline transition-colors duration-200">create an account</Link>.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
} 