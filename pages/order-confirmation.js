import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import Head from 'next/head';

export default function OrderConfirmation() {
  const router = useRouter();
  const { orderId } = router.query;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only fetch if we have an orderId
    if (orderId) {
      fetchOrder(orderId);
    }
  }, [orderId]);

  const fetchOrder = async (id) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }
      
      const data = await response.json();
      console.log('Fetched order:', data);
      setOrder(data.order);
      setError(null);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Could not load order details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      // Clean the date string to YYYY-MM-DD format
      const cleanDateStr = typeof dateString === 'string' ? dateString.split('T')[0] : dateString;
      console.log('Order confirmation page - Processing date:', cleanDateStr);
      
      // Extract date components
      const [year, month, day] = cleanDateStr.split('-').map(Number);
      console.log('Order confirmation page - Date components:', { year, month, day });
      
      // Create date using UTC to avoid timezone issues
      const date = new Date(Date.UTC(year, month - 1, day));
      console.log('Order confirmation page - Created UTC date:', date.toISOString());
      
      // Format using fixed UTC methods
      const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const formattedDate = `${weekday}, ${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
      console.log('Order confirmation page - Final formatted date:', formattedDate);
      
      return formattedDate;
    } catch (error) {
      console.error('Error formatting date in order confirmation page:', error);
      return dateString || 'N/A';
    }
  };

  return (
    <Layout>
      <Head>
        <title>Order Confirmation - Hearthfire Farm</title>
        <meta name="description" content="Your order has been confirmed" />
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          {loading ? (
            <div className="text-center py-8">
              <div className="spinner mx-auto mb-4"></div>
              <p>Loading order details...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4 text-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">Error Loading Order</p>
              <p className="text-gray-600">{error}</p>
              <button 
                onClick={() => fetchOrder(orderId)}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Try Again
              </button>
            </div>
          ) : order ? (
            <>
              <div className="text-center mb-8">
                <div className="text-green-600 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
                <p className="text-lg text-gray-600">Thank you for your order.</p>
                <p className="text-gray-600 mt-2">Order #{order.id}</p>
              </div>

              <div className="border-t border-b py-4 mb-6">
                <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span>
                        {item.name} × {item.quantity}
                        {item.option && <span className="text-sm text-gray-500 ml-1">({item.option.name})</span>}
                      </span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between mb-1">
                    <span>Subtotal</span>
                    <span>${order.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>{order.orderType === 'pickup' ? 'Pickup Fee' : 'Delivery Fee'}</span>
                    <span>${order.orderType === 'pickup' ? '0.00' : '10.00'}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Tax</span>
                    <span>${order.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2">
                    <span>Total</span>
                    <span>${(parseFloat(order.subtotal) + (order.orderType === 'pickup' ? 0 : 10) + parseFloat(order.tax)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Order Type Specific Information */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">
                  {order.orderType === 'pickup' ? 'Pickup Information' : 'Delivery Information'}
                </h2>
                
                {order.orderType === 'pickup' ? (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="mb-2">
                      <span className="font-medium">Pickup Location:</span>{' '}
                      {order.pickup?.locationName || 'Not specified'}
                    </div>
                    <div className="mb-2">
                      <span className="font-medium">Address:</span>{' '}
                      {order.pickup?.address || 'Not specified'}
                    </div>
                    <div className="mb-2">
                      <span className="font-medium">Date:</span>{' '}
                      {order.pickup?.date ? formatDate(order.pickup.date) : 'Not specified'}
                    </div>
                    {order.pickup?.instructions && (
                      <div className="mb-2">
                        <span className="font-medium">Instructions:</span>{' '}
                        {order.pickup.instructions}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="mb-2">
                      <span className="font-medium">Delivery Address:</span>{' '}
                      {order.delivery?.address ? (
                        `${order.delivery.address.street}, ${order.delivery.address.city}, ${order.delivery.address.state} ${order.delivery.address.zip}`
                      ) : 'Not specified'}
                    </div>
                    <div className="mb-2">
                      <span className="font-medium">Delivery Date:</span>{' '}
                      {order.delivery?.date ? formatDate(order.delivery.date) : 'Not specified'}
                    </div>
                    <div className="mb-2">
                      <span className="font-medium">Delivery Time:</span>{' '}
                      {order.delivery?.timeSlot || 'Not specified'}
                    </div>
                    {order.delivery?.instructions && (
                      <div className="mb-2">
                        <span className="font-medium">Delivery Instructions:</span>{' '}
                        {order.delivery.instructions}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="mb-2">
                    <span className="font-medium">Name:</span> {order.customer?.name}
                  </div>
                  <div className="mb-2">
                    <span className="font-medium">Email:</span> {order.customer?.email}
                  </div>
                  {order.customer?.phone && (
                    <div className="mb-2">
                      <span className="font-medium">Phone:</span> {order.customer.phone}
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="mb-2">
                    <span className="font-medium">Payment Method:</span>{' '}
                    {order.paymentMethod === 'cash' 
                      ? `Cash on ${order.orderType === 'pickup' ? 'Pickup' : 'Delivery'}` 
                      : 'Credit Card'}
                  </div>
                  <div className="mb-2">
                    <span className="font-medium">Payment Status:</span>{' '}
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      order.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center mt-8">
                <p className="text-gray-600 mb-4">
                  We'll send a confirmation email to {order.customer?.email} with your order details.
                </p>
                <Link href="/products" className="inline-block bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700">
                  Continue Shopping
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-lg text-gray-600">No order found with ID: {orderId}</p>
              <Link href="/" className="mt-4 inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                Return Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 