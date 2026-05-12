// Add this before any imports to ensure it's executed first
if (typeof window !== 'undefined') {
  // Ensure NEXT_PUBLIC_DATA_MODE is available globally
  window.NEXT_PUBLIC_DATA_MODE = window.NEXT_PUBLIC_DATA_MODE || 'production';
}

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminRoute from '../../components/AdminRoute';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import AdminSalesChart from '../../components/AdminSalesChart';
import AdminNavigation from '../../components/AdminNavigation';
import { ShoppingBagIcon, ShoppingCartIcon, UsersIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { formatOrderDate } from '../../utils/formatters';
import getConfig from 'next/config';
import AdminDashboardAdapter from '../../components/AdminDashboardAdapter';

// StatsCard component for displaying stats
function StatsCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
          {icon}
        </div>
        <div className="ml-5">
          <p className="text-sm font-medium text-gray-500 truncate">
            {title}
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

// Add formatDate function
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  
  let date;
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
  }
  
  return date.toLocaleDateString();
}

export default function AdminDashboard({ dataModeFromServer }) {
  return (
    <AdminRoute>
      <AdminDashboardAdapter dataModeFromServer={dataModeFromServer} />
    </AdminRoute>
  );
}

// Make DashboardContent available for the adapter
export function DashboardContent({ dataModeFromServer, dataModeFromClient }) {
  const { userData, currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Add a development mode state
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [isMockData, setIsMockData] = useState(false);
  const router = useRouter();
  
  // Helper to create default mock orders for development mode
  const createDefaultMockOrders = () => {
    console.log('Creating default mock orders for development fallback');
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    return [
      {
        id: 'mock-order-1',
        orderId: 'ORD-2023-001',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        total: 24.99,
        status: 'delivered',
        createdAt: {
          seconds: Math.floor(yesterday.getTime() / 1000),
          toDate: () => yesterday
        }
      },
      {
        id: 'mock-order-2',
        orderId: 'ORD-2023-002',
        customerName: 'Jane Smith',
        customerEmail: 'jane@example.com',
        total: 32.50,
        status: 'processing',
        createdAt: {
          seconds: Math.floor(now.getTime() / 1000),
          toDate: () => now
        }
      },
      {
        id: 'mock-order-3',
        orderId: 'ORD-2023-003',
        customerName: 'Bob Johnson',
        customerEmail: 'bob@example.com',
        total: 16.31,
        status: 'pending',
        createdAt: {
          seconds: Math.floor(now.getTime() / 1000) - 43200,
          toDate: () => new Date(now.getTime() - 43200 * 1000)
        }
      }
    ];
  };

  useEffect(() => {
    // Check if we're in development mode
    const isDevMode = typeof window !== 'undefined' ? 
      (window.NODE_ENV === 'development' || process.env.NODE_ENV === 'development') : 
      false;
    setIsDevelopment(isDevMode);
    
    // Check for using mock data - use the value from server or client or fallback
    const dataMode = dataModeFromServer || dataModeFromClient || 'production';
    const isMockDataMode = dataMode === 'mock';
    console.log('Data mode:', dataMode, 'isMockDataMode:', isMockDataMode);
    setIsMockData(isMockDataMode);
    
    // Check for development admin override in local storage
    if (isDevMode && typeof window !== 'undefined') {
      const devAdminOverride = localStorage.getItem('dev-admin-override') === 'true';
      setDevMode(devAdminOverride);
    }
    
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get the user's ID token or use a dev token in development mode
        let token;
        
        if (isDevMode && devMode) {
          console.log('Using admin-override token for development mode');
          token = 'admin-override-token';
        } else if (currentUser) {
          try {
            token = await currentUser.getIdToken();
            console.log('Retrieved real Firebase token');
          } catch (tokenError) {
            console.error('Failed to get Firebase token:', tokenError);
            
            if (isDevMode) {
              console.log('Falling back to dev token in development mode');
              token = 'dev-token';
            } else {
              throw tokenError;
            }
          }
        } else if (isDevMode) {
          console.log('No user but in development mode, using dev token');
          token = 'dev-token';
        } else {
          throw new Error('Authentication required');
        }
        
        // Log the type of token being used (for debugging)
        console.log('Using token type:', typeof token === 'string' 
          ? (token.startsWith('admin-override') ? 'admin-override' : 'standard') 
          : 'unknown');
        
        // First, try to fetch the admin stats
        let statsData = null;
        try {
          console.log('Fetching stats...');
          const statsResponse = await fetch('/api/admin/stats', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (!statsResponse.ok) {
            const errorText = await statsResponse.text();
            console.error('Stats response error:', errorText);
            throw new Error(`Failed to fetch stats: ${statsResponse.status} - ${errorText}`);
          }
          
          try {
            statsData = await statsResponse.json();
            console.log('Stats data received:', statsData);
            setStats(statsData);
          } catch (jsonError) {
            console.error('Error parsing stats JSON:', jsonError);
            throw new Error(`Failed to parse stats data: ${jsonError.message}`);
          }
        } catch (statsError) {
          console.error('Error fetching stats:', statsError);
          // Don't set the error state yet, try to fetch orders
          
          // In development mode, create some mock stats
          if (isDevMode) {
            console.log('Creating mock stats for development mode due to error');
            statsData = {
              products: 6,
              orders: 3,
              customers: 1,
              revenue: 73.80
            };
            setStats(statsData);
          }
        }
        
        // Fetch recent orders from admin/orders endpoint with separate error handling
        try {
          console.log('Fetching orders...');
          // Try the admin specific endpoint first
          const ordersResponse = await fetch('/api/admin/orders', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          let ordersData = [];
          
          if (ordersResponse.ok) {
            try {
              ordersData = await ordersResponse.json();
              console.log(`Orders data received from admin endpoint: ${ordersData.length} orders`);
              
              // Print the first order for debugging if available
              if (ordersData.length > 0) {
                const firstOrder = ordersData[0];
                console.log('Sample order data:', {
                  id: firstOrder.id,
                  orderId: firstOrder.orderId,
                  timestamp: firstOrder.createdAt,
                  timestampType: firstOrder.createdAt ? typeof firstOrder.createdAt : 'undefined'
                });
              } else {
                console.log('No orders returned from admin endpoint');
              }
            } catch (jsonError) {
              console.error('Error parsing orders JSON:', jsonError);
              throw new Error(`Failed to parse orders data: ${jsonError.message}`);
            }
          } else {
            console.warn('Admin orders endpoint failed, falling back to regular endpoint');
            // Fall back to regular orders endpoint
            try {
              const fallbackResponse = await fetch('/api/orders', {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });
              
              if (!fallbackResponse.ok) {
                const errorText = await fallbackResponse.text();
                console.error('Fallback orders response error:', errorText);
                throw new Error(`Failed to fetch orders: ${fallbackResponse.status} - ${errorText}`);
              }
              
              try {
                ordersData = await fallbackResponse.json();
                console.log('Orders data received from fallback endpoint:', ordersData.length);
              } catch (jsonError) {
                console.error('Error parsing fallback orders JSON:', jsonError);
                throw new Error(`Failed to parse fallback orders data: ${jsonError.message}`);
              }
            } catch (fallbackError) {
              console.error('Fallback orders endpoint error:', fallbackError);
              
              // In development mode, create default mock orders if needed
              if (isDevMode) {
                console.log('Creating mock orders due to fallback error');
                ordersData = createDefaultMockOrders();
              } else {
                throw fallbackError;
              }
            }
          }
          
          // If we got no orders and in development mode, use mock orders
          if (ordersData.length === 0 && isDevMode) {
            console.log('No orders found, using mock orders in dev mode');
            ordersData = createDefaultMockOrders();
          }
          
          console.log('Sorting orders by date...');
          
          // Sort by created date (newest first) and take only the first 5
          const sortedOrders = ordersData
            .filter(order => order && (order.createdAt || order.deliveryInfo?.date))
            .sort((a, b) => {
              // Enhanced function to handle different timestamp formats
              const getDate = (timestamp) => {
                try {
                  if (!timestamp) return new Date(0);
                  
                  // Case 1: Firestore timestamp with toDate method
                  if (timestamp && typeof timestamp.toDate === 'function') {
                    return timestamp.toDate();
                  } 
                  // Case 2: Firestore timestamp with seconds
                  else if (timestamp && timestamp.seconds !== undefined) {
                    return new Date(timestamp.seconds * 1000);
                  } 
                  // Case 3: ISO string
                  else if (typeof timestamp === 'string') {
                    return new Date(timestamp);
                  }
                  // Case 4: Already a Date object
                  else if (timestamp instanceof Date) {
                    return timestamp;
                  }
                  return new Date(0); // fallback
                } catch (err) {
                  console.error('Error parsing date:', err);
                  return new Date(0);
                }
              };
              
              // Try to get createdAt timestamp, fall back to delivery date if needed
              const aTimestamp = a.createdAt || (a.deliveryInfo ? a.deliveryInfo.date : null);
              const bTimestamp = b.createdAt || (b.deliveryInfo ? b.deliveryInfo.date : null);
              
              const dateA = getDate(aTimestamp);
              const dateB = getDate(bTimestamp);
              
              // Newest first
              return dateB - dateA;
            })
            .slice(0, 5);
          
          console.log(`After sorting, got ${sortedOrders.length} recent orders`);
            
          setRecentOrders(sortedOrders);
          
          // If we didn't get stats data earlier but did get orders,
          // create some stats from the orders
          if (!statsData && ordersData.length > 0 && isDevMode) {
            console.log('Generating mock stats from orders data');
            
            const userIds = new Set();
            let totalRevenue = 0;
            
            ordersData.forEach(order => {
              if (order.userId) userIds.add(order.userId);
              if (order.total && typeof order.total === 'number') {
                totalRevenue += order.total;
              } else if (order.total && typeof order.total === 'string') {
                const parsedTotal = parseFloat(order.total);
                if (!isNaN(parsedTotal)) {
                  totalRevenue += parsedTotal;
                }
              }
            });
            
            const mockStats = {
              products: 6, // Use a reasonable default
              orders: ordersData.length,
              customers: userIds.size || 1,
              revenue: parseFloat(totalRevenue.toFixed(2))
            };
            
            console.log('Generated mock stats:', mockStats);
            setStats(mockStats);
          }
        } catch (ordersError) {
          console.error('Error fetching orders:', ordersError);
          
          // In development mode, create some mock orders if needed
          if (isDevMode && recentOrders.length === 0) {
            console.log('Creating default mock orders for development mode due to error');
            const mockOrders = createDefaultMockOrders();
            setRecentOrders(mockOrders);
            
            // Also create mock stats if needed
            if (!statsData) {
              const mockStats = {
                products: 6,
                orders: 3,
                customers: 3,
                revenue: 73.80
              };
              setStats(mockStats);
            }
          } else if (!isDevMode) {
            // In production, set the error
            setError('Error loading orders: ' + ordersError.message);
          }
        }
        
      } catch (err) {
        console.error('Error fetching admin dashboard data:', err);
        setError(err.message);
        
        // In development mode, ensure we have something to display
        if (isDevMode) {
          if (!stats) {
            setStats({
              products: 3,
              orders: 3,
              customers: 1,
              revenue: 73.80
            });
          }
          
          if (recentOrders.length === 0) {
            setRecentOrders(createDefaultMockOrders());
          }
        }
      } finally {
        setLoading(false);
      }
    };
    
    // In dev mode, we can fetch data without a currentUser
    if ((currentUser || (isDevMode && devMode))) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [currentUser, devMode, isDevelopment, dataModeFromServer, dataModeFromClient]);

  // Show loading state while fetching data
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-primary-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Show development mode notice if relevant  
  if (isDevelopment) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Development Mode Notice */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-blue-700 font-medium">Development Mode</p>
              <p className="text-blue-700 text-sm">
                {devMode 
                  ? isMockData 
                    ? "Admin mode is enabled with mock data. For real data, run 'npm run use-real-data'"
                    : "Admin mode is enabled with real data. For mock data, run 'npm run use-mock-data'" 
                  : "Enable admin mode in dev-tools to view the dashboard."}
              </p>
              {!devMode && (
                <button
                  onClick={() => { 
                    localStorage.setItem('dev-admin-override', 'true'); 
                    setDevMode(true); 
                  }}
                  className="mt-2 px-4 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Enable Admin Mode
                </button>
              )}
            </div>
          </div>
        </div>
        
        {(!devMode && !currentUser) ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
            <p className="mb-4">You need to enable admin mode to view the dashboard in development.</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => location.href = '/dev-tools'}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to Dev Tools
              </button>
            </div>
          </div>
        ) : (
          <AdminDashboardContent 
            stats={stats} 
            recentOrders={recentOrders} 
            loading={loading}
            isMockData={isMockData}
            isDevelopment={isDevelopment}
          />
        )}
      </div>
    );
  }

  // Show error state if there was an error
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
        <h3 className="font-medium mb-2">Error loading dashboard data</h3>
        <p className="text-sm">{error}</p>
        <p className="text-sm mt-2">Please try refreshing the page or contact support if the problem persists.</p>
      </div>
    );
  }

  // Standard production view
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminDashboardContent 
        stats={stats} 
        recentOrders={recentOrders} 
        loading={loading}
        isMockData={isMockData}
        isDevelopment={isDevelopment}
      />
    </div>
  );
}

// Extract the inner content to a separate component
function AdminDashboardContent({ stats, recentOrders, loading, isMockData, isDevelopment }) {
  // Add state for promotions
  const [promotions, setPromotions] = useState([]);
  const [loadingPromotions, setLoadingPromotions] = useState(true);
  
  // Fetch promotions
  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        setLoadingPromotions(true);
        const response = await fetch('/api/promotions');
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.promotions) {
            // Get only active promotions and limit to 3
            const activePromos = data.promotions
              .filter(promo => promo.active)
              .slice(0, 3);
            setPromotions(activePromos);
          }
        }
      } catch (error) {
        console.error('Error fetching promotions:', error);
      } finally {
        setLoadingPromotions(false);
      }
    };
    
    fetchPromotions();
  }, []);
  
  // formatOrderDate is now imported from utils/formatters, so we removed the local implementation
  
  // Show loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-primary-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      {/* Admin Navigation */}
      <AdminNavigation />
      
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Total Products" 
          value={stats ? stats.products : 0} 
          icon={<ShoppingBagIcon className="h-6 w-6" />} 
        />
        <StatsCard 
          title="Total Orders" 
          value={stats ? stats.orders : 0} 
          icon={<ShoppingCartIcon className="h-6 w-6" />} 
        />
        <StatsCard 
          title="Customers" 
          value={stats ? stats.customers : 0} 
          icon={<UsersIcon className="h-6 w-6" />} 
        />
        <StatsCard 
          title="Revenue" 
          value={stats ? `$${stats.revenue.toFixed(2)}` : '$0.00'} 
          icon={<CurrencyDollarIcon className="h-6 w-6" />} 
        />
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Promotions Management Widget */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50">
            <h2 className="text-lg font-medium text-gray-800">Active Promotions</h2>
            <Link href="/admin/content/promotions" className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">
              Manage All
            </Link>
          </div>
          <div className="p-6">
            {loadingPromotions ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : promotions.length > 0 ? (
              <div className="mb-4 space-y-2">
                {promotions.map(promo => (
                  <div key={promo.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{promo.code}</div>
                      <div className="text-sm text-gray-500">{promo.description}</div>
                    </div>
                    <div>
                      {promo.type === 'fixed' && <span className="text-green-600">${promo.value.toFixed(2)}</span>}
                      {promo.type === 'percentage' && <span className="text-green-600">{promo.value}%</span>}
                      {promo.type === 'shipping' && <span className="text-green-600">Free Delivery</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-gray-500">No active promotions</p>
              </div>
            )}
            
            <Link href="/admin/content/promotions?action=create" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Add New Promotion
            </Link>
          </div>
        </div>
      </div>
      
      {/* Sales Overview */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-800">Sales Overview</h2>
        </div>
        <div className="p-6">
          <AdminSalesChart orders={recentOrders} />
        </div>
      </div>
      
      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-800">Recent Orders</h2>
          <Link href="/admin/orders" className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">
            View All
          </Link>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mr-2"></div>
              <span className="text-gray-500">Loading orders...</span>
            </div>
          ) : (
            <>
              {recentOrders && recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
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
                          Amount
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentOrders.map(order => {
                        let orderIdForRoute;
                        
                        // Case 1: If we have the direct document ID, use it
                        if (order.id) {
                          // If it's already in the format of 'order-X', use it directly
                          if (order.id.startsWith('order-')) {
                            orderIdForRoute = order.id;
                          } 
                          // If it's in the format 'ord-XXX', transform it to 'order-X'
                          else if (order.id.startsWith('ord-')) {
                            const numericPart = order.id.replace('ord-', '').replace(/^0+/, '');
                            orderIdForRoute = `order-${numericPart}`;
                          }
                          else {
                            orderIdForRoute = order.id;
                          }
                        } 
                        // Case 2: For mock orders with IDs like 'ord-001', transform to 'order-1'
                        else if (order.orderId && order.orderId.toLowerCase().startsWith('ord-')) {
                          const numericPart = order.orderId.toLowerCase().replace('ord-', '').replace(/^0+/, '');
                          orderIdForRoute = `order-${numericPart}`;
                        }
                        // Case 3: For orders with IDs like 'ORD-order-123456', extract the document ID part
                        else if (order.orderId && order.orderId.toLowerCase().includes('order-')) {
                          const parts = order.orderId.toLowerCase().split('order-');
                          if (parts.length > 1) {
                            // Extract just the numeric portion for the route
                            const numericPart = parts[1].split(/[^0-9]/)[0];
                            orderIdForRoute = `order-${numericPart}`;
                          } else {
                            orderIdForRoute = 'detail'; // Fallback
                          }
                        }
                        // Default fallback
                        else {
                          orderIdForRoute = 'detail';
                        }
                        
                        console.log(`Order: ${order.orderId || order.id}, Route ID: ${orderIdForRoute}`);
                        
                        return (
                          <tr key={order.id || order.orderId} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Link href={`/admin/orders/${orderIdForRoute}`} className="text-indigo-600 hover:text-indigo-900">
                                {order.orderId || `ORD-${order.id}`}
                              </Link>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{order.customerName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{formatOrderDate(order.createdAt)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">${parseFloat(order.total).toFixed(2)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  order.status === 'delivered' 
                                  ? 'bg-green-100 text-green-800' 
                                  : order.status === 'processing' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : order.status === 'pending' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : order.status === 'cancelled' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No recent orders found</p>
                  {isDevelopment && (
                    <p className="text-gray-400 text-sm mt-2">
                      You're in development mode. Check the API response or mock data configuration.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Export getStaticProps to provide environment variables to the component
export async function getStaticProps() {
  // Get the runtime config in a safe way
  let publicRuntimeConfig = {};
  try {
    const config = getConfig();
    publicRuntimeConfig = config?.publicRuntimeConfig || {};
  } catch (error) {
    console.error('Error getting Next.js config:', error);
  }
  
  // Safe fallback for the data mode
  let dataMode = 'production';
  try {
    dataMode = process.env.NEXT_PUBLIC_DATA_MODE || 
               publicRuntimeConfig?.NEXT_PUBLIC_DATA_MODE || 
               'production';
  } catch (error) {
    console.error('Error accessing environment variables:', error);
  }
  
  // Provide the environment variable as a prop
  return {
    props: {
      dataModeFromServer: dataMode
    },
    // Revalidate the page every hour
    revalidate: 3600
  };
} 