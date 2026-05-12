import Link from 'next/link';
import { useRouter } from 'next/router';

export default function AdminNavigation() {
  const router = useRouter();
  
  // Determine which link is active based on the current path
  const isActive = (path) => {
    if (path === '/admin' && router.pathname === '/admin') {
      return true;
    }
    if (path !== '/admin' && router.pathname.startsWith(path)) {
      return true;
    }
    return false;
  };

  // Navigation items array with all admin sections
  const navItems = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Orders', href: '/admin/orders' },
    { label: 'Products', href: '/admin/products' },
    { label: 'Customers', href: '/admin/customers' },
    { label: 'Content', href: '/admin/content' },
    { label: 'Delivery Schedule', href: '/admin/delivery/schedule' },
  ];

  return (
    <div className="bg-white shadow-md rounded-lg mb-6">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h1 className="text-lg font-medium text-gray-900">Admin Dashboard</h1>
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Back to Store
        </Link>
      </div>
      <div className="border-t border-gray-200">
        <nav className="flex overflow-x-auto">
          {navItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href} 
              className={`px-6 py-3 text-sm font-medium ${
                isActive(item.href) 
                  ? 'border-b-2 border-indigo-500 text-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
} 