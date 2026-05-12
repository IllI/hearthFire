import { useState, useEffect } from 'react';
import AdminRoute from '../../../components/AdminRoute';
import AdminNavigation from '../../../components/AdminNavigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { formatOrderDate, formatPhoneNumber } from '../../../utils/formatters';

export default function AdminOrders() {
  return (
    <AdminRoute>
      <OrdersContent />
    </AdminRoute>
  );
}

function OrdersContent() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusUpdating, setStatusUpdating] = useState({});
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [devMode, setDevMode] = useState(false);
  
  useEffect(() => {
    // Check if we're in development mode
    const isDevMode = process.env.NODE_ENV === 'development';
    setIsDevelopment(isDevMode);
    
    // Check for development admin override in local storage
    if (isDevMode && typeof window !== 'undefined') {
      const devAdminOverride = localStorage.getItem('dev-admin-override') === 'true';
      setDevMode(devAdminOverride);
    }
  }, []);
  
  useEffect(() => {
    const fetchOrders = async () => {
      if (!currentUser && !isDevelopment) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Fetching orders from API...');
        
        let token;
        
        // Use admin-override-token in development mode if devMode is enabled
        if (isDevelopment && devMode) {
          console.log('Using admin-override token for development mode');
          token = 'admin-override-token';
        } else if (currentUser) {
          token = await currentUser.getIdToken();
        } else if (isDevelopment) {
          console.log('No user but in development mode, using dev token');
          token = 'dev-token';
        } else {
          throw new Error('Authentication required');
        }
        
        console.log('Using token type:', token.startsWith('admin-override') ? 'admin-override' : 'standard');
        
        const response = await fetch('/api/admin/orders', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log('API Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch orders: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Retrieved ${data.length} orders from API`);
        
        // Sort orders by date (newest first)
        const sortedOrders = data.sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
        
        setOrders(sortedOrders);
        setError(null);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [currentUser, isDevelopment, devMode]);
  
  const updateOrderStatus = async (orderId, newStatus) => {
    if (!currentUser) return;
    
    // Mark this order as updating
    setStatusUpdating(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const token = await currentUser.getIdToken();
      
      const response = await fetch(`/api/orders/${orderId}`, {
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
      
      // Update the order in our local state
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
    } finally {
      // Remove updating status
      setStatusUpdating(prev => ({ ...prev, [orderId]: false }));
    }
  };
  
  // Helper to transform order ID for consistent routing
  const getOrderIdForRoute = (order) => {
    // Case 1: If we have the direct document ID, use it
    if (order.id) {
      // If it's already in the format of 'order-X', use it directly
      if (order.id.startsWith('order-')) {
        return order.id;
      } 
      // If it's in the format 'ord-XXX', transform it to 'order-X'
      else if (order.id.startsWith('ord-')) {
        const numericPart = order.id.replace('ord-', '').replace(/^0+/, '');
        return `order-${numericPart}`;
      }
      else {
        return order.id;
      }
    } 
    // Case 2: For mock orders with IDs like 'ord-001', transform to 'order-1'
    else if (order.orderId && order.orderId.toLowerCase().startsWith('ord-')) {
      const numericPart = order.orderId.toLowerCase().replace('ord-', '').replace(/^0+/, '');
      return `order-${numericPart}`;
    }
    // Case 3: For orders with IDs like 'ORD-order-123456', extract the document ID part
    else if (order.orderId && order.orderId.toLowerCase().includes('order-')) {
      const parts = order.orderId.toLowerCase().split('order-');
      if (parts.length > 1) {
        // Extract just the numeric portion for the route
        const numericPart = parts[1].split(/[^0-9]/)[0];
        return `order-${numericPart}`;
      } else {
        return 'detail'; // Fallback
      }
    }
    // Default fallback
    else {
      return 'detail';
    }
  };
  
  const filteredOrders = orders.filter(order => {
    // Apply search term filter
    const searchMatches = 
      searchTerm === '' || 
      (order.orderId && order.orderId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customerName && order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customerEmail && order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customerPhone && order.customerPhone.includes(searchTerm)) ||
      (order.deliveryInfo?.phone && order.deliveryInfo.phone.includes(searchTerm));
    
    // Apply status filter
    const statusMatches = 
      statusFilter === 'all' || 
      (order.status && order.status.toLowerCase() === statusFilter);
    
    return searchMatches && statusMatches;
  });
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Orders Management</h1>
      
      <AdminNavigation />
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mt-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-white shadow-md rounded-lg overflow-hidden mt-8">
            <div className="flex flex-col md:flex-row justify-between p-6 border-b">
              <div className="mb-4 md:mb-0">
                <h2 className="text-lg font-medium text-gray-800">All Orders</h2>
                <p className="text-sm text-gray-600">{orders.length} orders found</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Search orders..."
                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <select
                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
            
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map(order => {
                  const orderIdForRoute = getOrderIdForRoute(order);
                  
                  return (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.orderId || order.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.customerName}</div>
                      <div className="text-sm text-gray-500">{order.customerEmail}</div>
                      <div className="text-sm text-gray-500">
                        {order.customerPhone || order.deliveryInfo?.phone ? (
                          <a href={`tel:${(order.customerPhone || order.deliveryInfo?.phone).replace(/\D/g, '')}`} className="text-green-600 hover:underline">
                            {formatPhoneNumber(order.customerPhone || order.deliveryInfo?.phone)}
                          </a>
                        ) : 'No phone'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatOrderDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">${typeof order.total === 'number' ? order.total.toFixed(2) : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${order.paymentStatus === 'completed' ? 'bg-green-100 text-green-800' : 
                          order.paymentStatus === 'processing' ? 'bg-blue-100 text-blue-800' : 
                          'bg-yellow-100 text-yellow-800'}`}>
                        {order.paymentStatus || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className="text-sm rounded-md border-gray-300 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link href={`/admin/orders/${orderIdForRoute}`} className="text-indigo-600 hover:text-indigo-900">
                        View Details
                      </Link>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Add the DevHelper component */}
      <DevHelper />
    </div>
  );
}

function DevHelper() {
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [devMode, setDevMode] = useState(false);
  
  useEffect(() => {
    // Only show in development mode
    setIsDevelopment(process.env.NODE_ENV === 'development');
    
    // Check current state
    if (typeof window !== 'undefined') {
      const currentDevMode = localStorage.getItem('dev-admin-override') === 'true';
      setDevMode(currentDevMode);
    }
  }, []);
  
  const toggleDevMode = () => {
    const newDevMode = !devMode;
    localStorage.setItem('dev-admin-override', newDevMode ? 'true' : 'false');
    setDevMode(newDevMode);
    // Reload the page to apply changes
    window.location.reload();
  };
  
  if (!isDevelopment) return null;
  
  return (
    <div className="mt-8 p-4 bg-gray-100 rounded-md">
      <h3 className="text-lg font-medium">Development Helper</h3>
      <div className="mt-2 flex items-center">
        <span className="mr-2">Admin Override Mode:</span>
        <button
          onClick={toggleDevMode}
          className={`px-3 py-1 rounded-md ${
            devMode ? 'bg-green-500 text-white' : 'bg-gray-300'
          }`}
        >
          {devMode ? 'Enabled' : 'Disabled'}
        </button>
        {devMode && (
          <span className="ml-2 text-sm text-green-600">
            Using admin-override-token for API requests
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-600">
        This tool helps bypass authentication in development mode.
      </p>
    </div>
  );
} 