import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminRoute from '../../../components/AdminRoute';
import AdminNavigation from '../../../components/AdminNavigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { EnvelopeIcon, PhoneIcon, MapPinIcon, CalendarIcon, ShoppingBagIcon, CreditCardIcon } from '@heroicons/react/24/outline';

export default function CustomerDetail() {
  return (
    <AdminRoute>
      <CustomerDetailContent />
    </AdminRoute>
  );
}

function CustomerDetailContent() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    setIsDevelopment(process.env.NODE_ENV === 'development');
    setDevMode(localStorage.getItem('dev-admin-override') === 'true');
  }, []);

  useEffect(() => {
    if (!id) return;
    
    async function fetchCustomerData() {
      setLoading(true);
      setError(null);
      
      try {
        // Get authentication token
        let token = 'admin-override-token';
        if (currentUser) {
          try {
            token = await currentUser.getIdToken();
          } catch (tokenError) {
            console.error('Error getting auth token:', tokenError);
            if (!isDevelopment) {
              setError('Authentication error. Please try logging in again.');
              setLoading(false);
              return;
            }
          }
        } else if (devMode) {
          console.log('Using dev admin override token');
        } else if (!isDevelopment) {
          router.push('/login');
          return;
        }
        
        // Fetch customer data
        const response = await fetch(`/api/admin/customers/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const customerData = await response.json();
        setCustomer(customerData);
        
        // Fetch customer's orders
        const ordersResponse = await fetch(`/api/admin/customers/${id}/orders`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!ordersResponse.ok) {
          console.warn('Could not fetch customer orders:', ordersResponse.status);
          setOrders([]);
        } else {
          const ordersData = await ordersResponse.json();
          setOrders(ordersData);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching customer data:', error);
        setError('Failed to load customer data. ' + error.message);
        setLoading(false);
      }
    }
    
    fetchCustomerData();
  }, [id, currentUser, router, isDevelopment, devMode]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <AdminNavigation />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="spinner"></div>
            <p className="mt-2 text-sm text-gray-500">Loading customer data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <AdminNavigation />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="text-red-500 mb-2">{error}</div>
            <Link href="/admin/customers" className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              ← Back to Customers
            </Link>
            {isDevelopment && !devMode && (
              <button
                className="mt-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                onClick={() => {
                  localStorage.setItem('dev-admin-override', 'true');
                  setDevMode(true);
                }}
              >
                Enable Dev Admin Mode
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-100">
        <AdminNavigation />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-lg text-gray-500">Customer not found</p>
            <Link href="/admin/customers" className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              ← Back to Customers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNavigation />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Customer Details
            </h2>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link href="/admin/customers" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              ← Back to Customers
            </Link>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-800 font-semibold text-2xl">
                  {customer.name ? customer.name.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {customer.name || 'Unnamed Customer'}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Customer ID: {customer.id}
                </p>
                <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {customer.role || 'customer'}
                </span>
                {customer.isGuest && (
                  <span className="inline-flex items-center ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Guest Customer
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <EnvelopeIcon className="h-5 w-5 mr-1 text-gray-400" /> Email
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {customer.email || 'No email provided'}
                </dd>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <PhoneIcon className="h-5 w-5 mr-1 text-gray-400" /> Phone
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {customer.phone || 'No phone provided'}
                </dd>
              </div>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <MapPinIcon className="h-5 w-5 mr-1 text-gray-400" /> Address
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {customer.address ? (
                    <div>
                      <p>{customer.address.street}</p>
                      <p>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</p>
                    </div>
                  ) : (
                    'No address provided'
                  )}
                </dd>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <ShoppingBagIcon className="h-5 w-5 mr-1 text-gray-400" /> Orders
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-semibold mr-4">{customer.orders || 0} orders</span>
                    <span className="text-green-600 font-semibold">${(customer.totalSpent || 0).toFixed(2)} total spent</span>
                  </div>
                  {customer.lastOrderDate && (
                    <p className="text-sm text-gray-500 mt-1">Last order: {formatDate(customer.lastOrderDate)}</p>
                  )}
                </dd>
              </div>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-1 text-gray-400" /> Customer since
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDate(customer.createdAt)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Order History</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              {orders.length} {orders.length === 1 ? 'order' : 'orders'} placed by this customer
            </p>
          </div>
          
          {orders.length === 0 ? (
            <div className="px-4 py-5 sm:p-6 text-center">
              <p className="text-gray-500">No orders found for this customer</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.id.substring(0, 12)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${order.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'}`}>
                          {order.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <CreditCardIcon className="h-4 w-4 mr-1 text-gray-400" />
                          {order.paymentMethod || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/admin/orders/${order.id}`} className="text-indigo-600 hover:text-indigo-900">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 