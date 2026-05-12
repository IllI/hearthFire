import React from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import AdminRoute from './AdminRoute';

export default function AdminLayout({ children, title = 'Admin Dashboard' }) {
  const { currentUser } = useAuth();

  return (
    <AdminRoute>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <Link href="/admin" className="text-xl font-bold text-green-600">
                    Hearthfire Farm Admin
                  </Link>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link 
                    href="/admin/products" 
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Products
                  </Link>
                  <Link 
                    href="/admin/orders" 
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Orders
                  </Link>
                  <Link 
                    href="/admin/delivery/schedule" 
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Delivery Schedule
                  </Link>
                  <Link 
                    href="/dashboard/inventory" 
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Inventory
                  </Link>
                </div>
              </div>
              <div className="flex items-center">
                <div className="text-sm text-gray-500 mr-4">
                  {currentUser?.email}
                </div>
                <Link 
                  href="/" 
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  View Site
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">{title}</h1>
            {children}
          </div>
        </div>
      </div>
    </AdminRoute>
  );
} 