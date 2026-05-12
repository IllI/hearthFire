import { useState, useEffect } from 'react';
import AdminRoute from '../../../components/AdminRoute';
import AdminNavigation from '../../../components/AdminNavigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { EnvelopeIcon as MailIcon, PhoneIcon } from '@heroicons/react/24/outline';

export default function AdminCustomers() {
  return (
    <AdminRoute>
      <CustomersContent />
    </AdminRoute>
  );
}

function CustomersContent() {
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
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
    const fetchCustomers = async () => {
      if (!currentUser && !isDevelopment) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Fetching customers from API...');
        
        let token;
        if (currentUser) {
          token = await currentUser.getIdToken();
        } else if (isDevelopment && devMode) {
          // Use development admin override token
          token = 'admin-override-token-dev';
        } else {
          throw new Error('No authentication token available');
        }
        
        const response = await fetch('/api/admin/customers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch customers');
        }
        
        const data = await response.json();
        setCustomers(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [currentUser, isDevelopment, devMode]);
  
  // Filter customers based on search term and role filter
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.address?.zipCode || '').includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || customer.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });
  
  // Format date for display
  const formatCreatedAt = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp);
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNavigation />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-semibold text-gray-900">Customer Management</h1>
          
          {/* Search and filter controls */}
          <div className="mt-4 flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0 md:space-x-4">
            <div className="w-full md:w-1/2">
              <label htmlFor="search" className="sr-only">Search</label>
              <input
                type="text"
                id="search"
                placeholder="Search customers by name, email, phone or ZIP code"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            
            <div className="w-full md:w-1/3 flex space-x-4">
              <div className="w-full">
                <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  id="role-filter"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="all">All Roles</option>
                  <option value="customer">Customers</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Customers table */}
          <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-md">
            {loading ? (
              <div className="text-center py-12">
                <div className="spinner"></div>
                <p className="mt-2 text-sm text-gray-500">Loading customers...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-red-500 mb-2">Error: {error}</div>
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
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">No customers found matching your criteria.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stats
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-800 font-semibold text-lg">
                              {customer.name ? customer.name.charAt(0).toUpperCase() : '?'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {customer.name || 'Unnamed Customer'}
                            </div>
                            <div className="text-sm text-gray-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {customer.role || 'customer'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <MailIcon className="h-4 w-4 mr-1 text-gray-500" />
                          {customer.email || 'No email'}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center mt-1">
                          <PhoneIcon className="h-4 w-4 mr-1 text-gray-500" />
                          {customer.phone || 'No phone'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.address ? (
                          <div className="text-sm text-gray-900">
                            {customer.address.city}, {customer.address.state} {customer.address.zipCode}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No address information</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <span className="font-semibold">{customer.orders || 0}</span> orders
                        </div>
                        <div className="text-sm text-gray-500">
                          ${customer.totalSpent?.toFixed(2) || '0.00'} total spent
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCreatedAt(customer.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link 
                          href={`/admin/customers/${customer.id}`} 
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      
      {/* Development mode helper */}
      {isDevelopment && (
        <div className="fixed bottom-0 right-0 p-4 bg-white border-t border-l border-gray-200 shadow-lg rounded-tl-lg">
          <div className="text-sm">
            <div className="font-semibold">Dev Mode: {devMode ? 'Enabled' : 'Disabled'}</div>
            <button
              className={`mt-1 px-2 py-1 text-xs rounded ${devMode ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
              onClick={() => {
                localStorage.setItem('dev-admin-override', devMode ? 'false' : 'true');
                setDevMode(!devMode);
              }}
            >
              {devMode ? 'Disable Dev Mode' : 'Enable Dev Mode'}
            </button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .spinner {
          border: 3px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          border-top: 3px solid #4f46e5;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 