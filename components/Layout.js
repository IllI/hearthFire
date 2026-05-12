import Link from 'next/link';
import { useState } from 'react';
import { ShoppingCartIcon, CalendarIcon, UserIcon, Cog6ToothIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { FaInstagram, FaFacebook } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

export default function Layout({ children }) {
  const { isAuthenticated, isAdmin, userData, logout } = useAuth();
  const { cart } = useCart();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [email, setEmail] = useState('');
  
  const itemCount = cart?.items?.reduce((total, item) => total + item.quantity, 0) || 0;
  
  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleSubscribe = (e) => {
    e.preventDefault();
    // TODO: Implement newsletter subscription
    setEmail('');
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-green-700">
                Hearthfire Farm
              </Link>
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                <Link href="/products" className="text-gray-700 hover:text-green-700">
                  Our Produce
                </Link>
                <Link href="/schedule" className="text-gray-700 hover:text-green-700">
                  Delivery Schedule
                </Link>
                <Link href="/about" className="text-gray-700 hover:text-green-700">
                  Our Farm
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="text-green-700 hover:text-green-800 font-semibold">
                    Admin Dashboard
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/cart" className="p-1 text-gray-400 hover:text-green-700 relative">
                <ShoppingCartIcon className="h-6 w-6" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Link>
              <Link href="/account/orders" className="hidden sm:block p-1 text-gray-400 hover:text-green-700">
                <CalendarIcon className="h-6 w-6" />
              </Link>
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`p-1 ${isAuthenticated ? 'text-green-600' : 'text-gray-400'} hover:text-green-700 focus:outline-none`}
                >
                  <UserIcon className="h-6 w-6" />
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    {isAuthenticated ? (
                      <>
                        <div className="px-4 py-2 text-sm text-gray-700 border-b">
                          Signed in as<br />
                          <span className="font-medium">{userData?.name || userData?.email}</span>
                        </div>
                        
                        <Link href="/profile" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Your Profile
                        </Link>
                        
                        <Link href="/account/orders" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Your Orders
                        </Link>
                        
                        {isAdmin && (
                          <Link href="/admin" 
                            className="block px-4 py-2 text-sm text-green-700 hover:bg-gray-100"
                            onClick={() => setShowUserMenu(false)}
                          >
                            Admin Dashboard
                          </Link>
                        )}
                        
                        {process.env.NODE_ENV === 'development' && (
                          <Link href="/dev-tools" 
                            className="block px-4 py-2 text-sm text-purple-700 hover:bg-gray-100"
                            onClick={() => setShowUserMenu(false)}
                          >
                            Developer Tools
                          </Link>
                        )}
                        
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href="/login" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Sign In
                        </Link>
                        <Link href="/register" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Register
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {isAdmin && (
                <Link href="/admin" className="p-1 text-green-600 hover:text-green-800">
                  <Cog6ToothIcon className="h-6 w-6" />
                </Link>
              )}
              
              {/* Mobile menu button */}
              <button 
                className="md:hidden p-1 text-gray-500 hover:text-green-700 transition-colors focus:outline-none"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                {showMobileMenu ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile navigation menu */}
        {showMobileMenu && (
          <div className="md:hidden bg-white shadow-md absolute w-full z-50">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link 
                href="/products"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-700 hover:bg-gray-50"
                onClick={() => setShowMobileMenu(false)}
              >
                Our Produce
              </Link>
              <Link 
                href="/schedule"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-700 hover:bg-gray-50"
                onClick={() => setShowMobileMenu(false)}
              >
                Delivery Schedule
              </Link>
              <Link 
                href="/about"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-700 hover:bg-gray-50"
                onClick={() => setShowMobileMenu(false)}
              >
                Our Farm
              </Link>
              <Link 
                href="/account/orders"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-700 hover:bg-gray-50"
                onClick={() => setShowMobileMenu(false)}
              >
                Your Orders
              </Link>
              {isAdmin && (
                <Link 
                  href="/admin"
                  className="block px-3 py-2 rounded-md text-base font-medium text-green-700 hover:text-green-800 hover:bg-gray-50"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Admin Dashboard
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
      <main>{children}</main>
      <footer className="bg-white mt-12 py-8 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:justify-between">
            <div className="mb-8 md:mb-0">
              <h3 className="text-sm font-semibold text-gray-500 tracking-wider uppercase">About Us</h3>
              <p className="mt-2 text-base text-gray-600 max-w-md">
                Hearthfire Farm delivers fresh, organic produce directly from our farm to your doorstep.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 tracking-wider uppercase">Navigation</h3>
                <ul className="mt-4 space-y-2">
                  <li><Link href="/products" className="text-base text-gray-600 hover:text-green-700">Products</Link></li>
                  <li><Link href="/schedule" className="text-base text-gray-600 hover:text-green-700">Schedule</Link></li>
                  <li><Link href="/about" className="text-base text-gray-600 hover:text-green-700">About</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 tracking-wider uppercase">Account</h3>
                <ul className="mt-4 space-y-2">
                  <li><Link href="/login" className="text-base text-gray-600 hover:text-green-700">Sign In</Link></li>
                  <li><Link href="/register" className="text-base text-gray-600 hover:text-green-700">Register</Link></li>
                  <li><Link href="/account/orders" className="text-base text-gray-600 hover:text-green-700">Orders</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 tracking-wider uppercase">Let's Connect</h3>
                <div className="mt-4">
                  <form onSubmit={handleSubscribe} className="space-y-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your Email Address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      Subscribe
                    </button>
                  </form>
                  <div className="mt-4 flex space-x-4">
                    <a
                      href="https://www.instagram.com/hearthfire__farmandnursery"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-green-700"
                      aria-label="Follow us on Instagram"
                    >
                      <FaInstagram className="h-6 w-6" />
                    </a>
                    <a
                      href="https://facebook.com/hearthfirefarm"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-green-700"
                      aria-label="Follow us on Facebook"
                    >
                      <FaFacebook className="h-6 w-6" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 pt-8 md:flex md:items-center md:justify-between">
            <div className="mt-8 md:mt-0 md:order-1">
              <p className="text-base text-gray-400">&copy; 2023 Hearthfire Farm. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 