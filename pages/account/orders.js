import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatTimeSlot, formatOrderDate } from '../../utils/formatters';

export default function AccountOrders() {
  const { currentUser, userData } = useAuth();
  const router = useRouter();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastGuestOrder, setLastGuestOrder] = useState(null);
  
  useEffect(() => {
    // Check if user is a guest but has a recent order in localStorage
    if (!currentUser) {
      try {
        const lastOrderId = localStorage.getItem('lastOrderId');
        const lastOrderTime = localStorage.getItem('lastOrderTime');
        
        if (lastOrderId && lastOrderTime) {
          // Only consider orders from the last 24 hours
          const orderDate = new Date(lastOrderTime);
          const now = new Date();
          const hoursSinceOrder = (now - orderDate) / (1000 * 60 * 60);
          
          if (hoursSinceOrder < 24) {
            setLastGuestOrder({
              id: lastOrderId,
              createdAt: lastOrderTime
            });
          }
        }
      } catch (e) {
        console.warn('Error accessing localStorage:', e);
      }
      
      setLoading(false);
      return;
    }
    
    async function fetchOrders() {
      try {
        setLoading(true);
        const token = await currentUser.getIdToken();
        
        console.log('Fetching orders with token for user:', currentUser.uid);
        
        const response = await fetch('/api/orders', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }
        
        const data = await response.json();
        console.log(`Found ${data.length} orders for the user`);
        setOrders(data);
        
        // Also check localStorage for last order ID (in case it's not in the API response)
        try {
          const lastOrderId = localStorage.getItem('lastOrderId');
          const lastOrderTime = localStorage.getItem('lastOrderTime');
          const storedUserId = localStorage.getItem('orderUserId');
          
          // If we have a last order ID and it's for the current user
          if (lastOrderId && lastOrderTime && storedUserId === currentUser.uid) {
            const lastOrderFound = data.some(order => order.id === lastOrderId);
            
            // If the last order isn't in our fetched orders, add it
            if (!lastOrderFound) {
              console.log(`Last order ${lastOrderId} not found in API response, fetching directly`);
              
              // Try to fetch this order directly
              try {
                const orderResponse = await fetch(`/api/orders/${lastOrderId}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });
                
                if (orderResponse.ok) {
                  const orderData = await orderResponse.json();
                  if (orderData && orderData.id) {
                    console.log(`Successfully fetched order ${lastOrderId} directly`);
                    // Add to orders if not present
                    setOrders(prevOrders => {
                      const exists = prevOrders.some(o => o.id === orderData.id);
                      return exists ? prevOrders : [orderData, ...prevOrders];
                    });
                  }
                }
              } catch (orderError) {
                console.warn(`Error fetching order ${lastOrderId} directly:`, orderError);
              }
            }
          }
        } catch (e) {
          console.warn('Error checking localStorage for last order:', e);
        }
      } catch (err) {
        console.error('Error loading orders:', err);
        setError('Failed to load your orders. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrders();
  }, [currentUser]);
  
  if (loading) {
    return (
      <Layout title="Your Orders">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-8">Your Orders</h1>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        </div>
      </Layout>
    );
  }
  
  if (!currentUser) {
    return (
      <Layout title="Your Orders">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-8">Your Orders</h1>
          
          {lastGuestOrder ? (
            <div className="bg-white shadow-md rounded-lg p-8 mb-8">
              <h2 className="text-xl font-bold mb-4">Recent Guest Order</h2>
              <p className="mb-4">You recently placed an order as a guest. Create an account to track all your orders in one place.</p>
              
              <div className="border p-4 rounded-lg mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Order #{lastGuestOrder.id}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(lastGuestOrder.createdAt), 'MMM d, yyyy, h:mm a')}
                    </p>
                  </div>
                  <Link 
                    href={`/orders/${lastGuestOrder.id}/confirmation`}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded text-sm"
                  >
                    View Order
                  </Link>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <Link 
                  href="/login" 
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
                >
                  Sign In
                </Link>
                <Link 
                  href="/register" 
                  className="bg-white border border-green-600 text-green-600 hover:bg-green-50 py-2 px-4 rounded"
                >
                  Create Account
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow-md rounded-lg p-8 text-center">
              <h2 className="text-xl font-bold mb-4">Sign In to View Your Orders</h2>
              <p className="text-gray-600 mb-6">
                Please sign in or create an account to view your order history.
              </p>
              <div className="flex justify-center space-x-4">
                <Link 
                  href="/login?redirect=account/orders" 
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
                >
                  Sign In
                </Link>
                <Link 
                  href="/register" 
                  className="bg-white border border-green-600 text-green-600 hover:bg-green-50 py-2 px-4 rounded"
                >
                  Create Account
                </Link>
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }
  
  if (error) {
    return (
      <Layout title="Your Orders">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-8">Your Orders</h1>
          <div className="bg-red-50 p-4 rounded-md text-red-800">
            {error}
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Your Orders">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Your Orders</h1>
        
        {orders.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg p-8 text-center">
            <p className="text-lg text-gray-600 mb-6">You don't have any orders yet</p>
            <p className="text-sm text-gray-500 mb-4">
              If you recently placed an order, it might be recorded as a guest order or the system is running in development mode.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Your order data is stored locally during development and might not persist between sessions.
              Check your order confirmation page or try placing another order.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/products" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                Browse Products
              </Link>
              {localStorage.getItem('lastOrderId') && (
                <Link 
                  href={`/orders/${localStorage.getItem('lastOrderId')}/confirmation`}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded"
                >
                  View Last Order
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.orderId || order.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatOrderDate(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${order.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">${parseFloat(order.total).toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link 
                          href={`/orders/${order.id}/confirmation`}
                          className="text-green-600 hover:text-green-900 mr-4"
                        >
                          View
                        </Link>
                        {order.paymentStatus === 'pending' && (
                          <Link 
                            href={`/payment/${order.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Pay
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
} 