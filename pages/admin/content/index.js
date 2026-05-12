import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AdminRoute from '../../../components/AdminRoute';
import AdminNavigation from '../../../components/AdminNavigation';
import Head from 'next/head';

// Card component for content section
function ContentCard({ title, description, lastUpdated, editLink, previewLink }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        
        {lastUpdated && (
          <p className="text-sm text-gray-500 mb-4">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </p>
        )}
        
        <div className="flex space-x-4">
          <Link 
            href={editLink} 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Edit Content
          </Link>
          <Link 
            href={previewLink} 
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            target="_blank"
          >
            View Page
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ContentManagement() {
  return (
    <AdminRoute>
      <ContentManagementContent />
    </AdminRoute>
  );
}

function ContentManagementContent() {
  const [contentPages, setContentPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch content page metadata
  useEffect(() => {
    async function fetchContentPages() {
      try {
        setLoading(true);
        const response = await fetch('/api/content');
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.pages) {
            setContentPages(data.pages);
          }
        }
      } catch (err) {
        console.error('Error fetching content pages:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchContentPages();
  }, []);

  return (
    <>
      <Head>
        <title>Content Management - Admin Dashboard</title>
      </Head>
      
      <AdminNavigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Content Management</h1>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ContentCard 
              title="Home Page" 
              description="Edit the main content sections, hero image, and promotional content displayed on the home page."
              lastUpdated={contentPages.find(p => p.id === 'home')?.lastUpdated}
              editLink="/admin/content/home"
              previewLink="/"
            />
            
            <ContentCard 
              title="About Page" 
              description="Manage the about page content, mission statement, and company information."
              lastUpdated={contentPages.find(p => p.id === 'about')?.lastUpdated}
              editLink="/admin/content/about"
              previewLink="/about"
            />
            
            <ContentCard 
              title="Promotional Codes" 
              description="Manage promotional codes for discounts, free shipping, and other special offers."
              lastUpdated={contentPages.find(p => p.id === 'promotions')?.lastUpdated}
              editLink="/admin/content/promotions"
              previewLink="/cart"
            />
          </div>
        )}
      </div>
    </>
  );
} 