import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminRoute from '../../../components/AdminRoute';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { formatTimeSlot, formatOrderDate, formatPhoneNumber } from '../../../utils/formatters';

export default function AdminOrderDetail() {
  return (
    <AdminRoute>
      <OrderDetailContent />
    </AdminRoute>
  );
}

function OrderDetailContent() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  
  useEffect(() => {
    if (!id || !currentUser) return;
    
    async function fetchOrder() {
      try {
        const token = await currentUser.getIdToken();
        
        const response = await fetch(`/api/orders/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch order');
        }
        
        const data = await response.json();
        console.log('Received order data:', data); 
        console.log('Order has deliveryInfo?', !!data.deliveryInfo);
        console.log('Order has items?', !!data.items);
        console.log('All order keys:', Object.keys(data));
        
        if (data.deliveryInfo) {
          console.log('DeliveryInfo keys:', Object.keys(data.deliveryInfo));
          console.log('DeliveryInfo content:', data.deliveryInfo);
        }
        
        if (data.items) {
          console.log('Items array length:', data.items.length);
          console.log('First item (if exists):', data.items[0]);
        }
        
        // Add default values for missing fields to prevent UI errors
        const normalizedOrder = {
          // Basic order data
          id: data.id || '',
          orderId: data.orderId || '',
          status: data.status || 'pending',
          paymentStatus: data.paymentStatus || 'pending',
          
          // Customer information
          userId: data.userId || '',
          customerName: data.customerName || 'N/A',
          customerEmail: data.customerEmail || 'N/A',
          customerPhone: data.customerPhone || 'N/A',
          
          // Financial data
          subtotal: data.subtotal || 0,
          tax: data.tax || 0,
          deliveryFee: data.deliveryFee || 0,
          total: data.total || 0,
          paymentMethod: data.paymentMethod || 'cash',
          
          // Timestamps
          createdAt: data.createdAt || { seconds: Date.now() / 1000, nanoseconds: 0 },
          
          // Items array
          items: Array.isArray(data.items) ? data.items : [],
          
          // Delivery information
          deliveryInfo: data.deliveryInfo || {
            date: null,
            timeSlot: 'N/A',
            address: { street: 'N/A', city: '', state: '', zip: '' },
            instructions: ''
          },
          
          // Additional fields from the original data
          ...data
        };
        
        setOrder(normalizedOrder);
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Failed to load order details. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrder();
  }, [id, currentUser]);
  
  const updateOrderStatus = async (newStatus) => {
    try {
      if (!currentUser) return;
      
      setStatusUpdating(true);
      const token = await currentUser.getIdToken();
      
      const response = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update order status');
      }
      
      const updatedOrder = await response.json();
      setOrder(updatedOrder);
      
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
    } finally {
      setStatusUpdating(false);
    }
  };
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }
  
  if (error || !order) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 p-4 rounded-md text-red-700">
          {error || 'Order not found'}
        </div>
        <div className="mt-4">
          <Link href="/admin/orders" className="text-green-600 hover:text-green-800">
            &larr; Back to Orders
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/admin/orders" className="text-green-600 hover:text-green-800">
          &larr; Back to Orders
        </Link>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
        <div className="border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Order #{order.orderId}</h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {order.createdAt ? formatOrderDate(order.createdAt) : 'N/A'}
              </div>
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                ${order.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                  order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'}`}>
                {order.status}
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {/* Customer Info Section */}
          <div className="mt-8">
            <h4 className="text-lg font-semibold">Customer Information</h4>
            <div className="mt-4 border rounded p-4">
              <div className="text-gray-700 space-y-1">
                <p>Name: {order.customerName || 'N/A'}</p>
                <p>Email: {order.customerEmail || 'N/A'}</p>
                <p>Phone: {order.customerPhone || order.deliveryInfo?.phone ? 
                  <a href={`tel:${(order.customerPhone || order.deliveryInfo?.phone).replace(/\D/g, '')}`} className="text-green-600 hover:underline">
                    {formatPhoneNumber(order.customerPhone || order.deliveryInfo?.phone)}
                  </a> : 'N/A'}
                </p>
                {order.userId && <p>Customer ID: {order.userId}</p>}
              </div>
            </div>
          </div>
          
          {/* Payment Information */}
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-2">Payment Information</h2>
            <div className="text-gray-700 space-y-1">
              <p>Method: {order.paymentMethod === 'credit' ? 'Credit Card' : 'Cash on Delivery'}</p>
              <p>Status: <span className="capitalize">{order.paymentStatus}</span></p>
              {order.paymentIntentId && (
                <p>Payment ID: {order.paymentIntentId}</p>
              )}
            </div>
          </div>
          
          {/* Delivery Information */}
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-2">Delivery Information</h2>
            <div className="text-gray-700 space-y-1">
              <p>
                Date: {order.deliveryInfo?.date ? formatOrderDate(order.deliveryInfo.date) : 'N/A'}
              </p>
              <p>Time Slot: {order.deliveryInfo?.timeSlot ? formatTimeSlot(order.deliveryInfo.timeSlot) : 'N/A'}</p>
              <p>
                Address: {order.deliveryInfo?.address ? 
                  `${order.deliveryInfo.address.street || 'N/A'}, 
                   ${order.deliveryInfo.address.city || ''} 
                   ${order.deliveryInfo.address.state || ''} 
                   ${order.deliveryInfo.address.zip || ''}`.trim() : 'N/A'}
              </p>
              {order.deliveryInfo?.instructions && (
                <p>Instructions: {order.deliveryInfo.instructions}</p>
              )}
              
              {/* Google Calendar Event Link */}
              {order.googleCalendarEventUrl && (
                <div className="mt-3">
                  <a 
                    href={order.googleCalendarEventUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    View/Edit Delivery in Google Calendar
                  </a>
                  <p className="text-sm text-gray-500 mt-1">
                    Note: Use this link to mark delivery as completed
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Order Items */}
          <div className="mt-8">
            <h4 className="text-lg font-semibold">Order Items</h4>
            <div className="mt-4 border rounded overflow-x-auto">
              {order.items && order.items.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {item.name || 'Unknown Product'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.productId || 'No ID'}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${formatPrice(item.price || 0)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.quantity || 0} {item.unit || 'unit(s)'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${formatPrice(item.subtotal || (item.price * item.quantity) || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-gray-500 text-center">No items found for this order.</div>
              )}
            </div>
          </div>
          
          {/* Order Totals */}
          <div className="mt-8">
            <h4 className="text-lg font-semibold">Order Totals</h4>
            <div className="mt-4 border rounded p-4">
              <div className="flex justify-between py-2">
                <span>Subtotal:</span>
                <span>${formatPrice(order.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-t">
                <span>{order.orderType === 'pickup' ? 'Pickup' : 'Delivery'} Fee:</span>
                <span>${order.orderType === 'pickup' ? '0.00' : formatPrice(order.deliveryFee || 10)}</span>
              </div>
              <div className="flex justify-between py-2 border-t">
                <span>Tax:</span>
                <span>${formatPrice(order.tax || 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-t font-semibold">
                <span>Total:</span>
                <span>${formatPrice(parseFloat(order.subtotal || 0) + (order.orderType === 'pickup' ? 0 : parseFloat(order.deliveryFee || 10)) + parseFloat(order.tax || 0))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Admin Actions */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Order Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => updateOrderStatus('pending')}
            disabled={statusUpdating || order.status === 'pending'}
            className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 disabled:opacity-50"
          >
            Mark as Pending
          </button>
          <button
            onClick={() => updateOrderStatus('processing')}
            disabled={statusUpdating || order.status === 'processing'}
            className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 disabled:opacity-50"
          >
            Mark as Processing
          </button>
          <button
            onClick={() => updateOrderStatus('shipped')}
            disabled={statusUpdating || order.status === 'shipped'}
            className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-md hover:bg-indigo-200 disabled:opacity-50"
          >
            Mark as Shipped
          </button>
          <button
            onClick={() => updateOrderStatus('delivered')}
            disabled={statusUpdating || order.status === 'delivered'}
            className="px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 disabled:opacity-50"
          >
            Mark as Delivered
          </button>
          <button
            onClick={() => updateOrderStatus('cancelled')}
            disabled={statusUpdating || order.status === 'cancelled'}
            className="px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 disabled:opacity-50"
          >
            Mark as Cancelled
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPrice(value) {
  if (value === undefined || value === null) {
    return '0.00';
  }
  
  // Convert to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return '0.00';
  }
  
  // For our mock data, values are in cents (values like 1995 for $19.95)
  // For real data in database, values might be in dollars (like 19.95)
  // If the value is larger than 100, assume it's in cents and divide by 100
  if (numValue > 100) {
    return (numValue / 100).toFixed(2);
  } else {
    // Otherwise assume it's already in dollars
    return numValue.toFixed(2);
  }
}