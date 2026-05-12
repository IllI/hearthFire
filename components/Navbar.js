import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../services/authService';
import { useState } from 'react';
import { FaInstagram, FaFacebook } from 'react-icons/fa';

export default function Navbar() {
  const { currentUser, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const handleLogout = async () => {
    await logoutUser();
    // Close menu after logout
    setIsMenuOpen(false);
  };
  
  return (
    <nav className="bg-green-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <span className="font-bold text-xl">Hearthfire Farm</span>
            </Link>
            
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link href="/products" className="px-3 py-2 rounded-md hover:bg-green-700">
                Products
              </Link>
              <Link href="/about" className="px-3 py-2 rounded-md hover:bg-green-700">
                About Us
              </Link>
              <Link href="/delivery" className="px-3 py-2 rounded-md hover:bg-green-700">
                Delivery
              </Link>
            </div>
          </div>
          
          <div className="hidden md:flex md:items-center md:space-x-4">
            {/* Social Media Icons */}
            <div className="flex items-center space-x-3 mr-4">
              <a
                href="https://instagram.com/hearthfire_farmandnursery"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-200 transition-colors"
                aria-label="Follow us on Instagram"
              >
                <FaInstagram className="h-5 w-5" />
              </a>
              <a
                href="https://facebook.com/hearthfirefarm"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-200 transition-colors"
                aria-label="Follow us on Facebook"
              >
                <FaFacebook className="h-5 w-5" />
              </a>
            </div>

            {currentUser ? (
              <>
                <Link href="/cart" className="px-3 py-2 rounded-md hover:bg-green-700">
                  Cart
                </Link>
                
                <div className="relative ml-3">
                  <div>
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center text-sm rounded-full focus:outline-none"
                    >
                      <span className="px-3 py-2 rounded-md hover:bg-green-700">
                        {currentUser.displayName || 'My Account'}
                      </span>
                    </button>
                  </div>
                  
                  {isMenuOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-10">
                      <Link 
                        href="/profile" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Profile
                      </Link>
                      <Link 
                        href="/orders" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        My Orders
                      </Link>
                      
                      {isAdmin && (
                        <Link 
                          href="/admin" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Admin Dashboard
                        </Link>
                      )}
                      
                      <button 
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="px-3 py-2 rounded-md hover:bg-green-700">
                  Log in
                </Link>
                <Link 
                  href="/register" 
                  className="px-3 py-2 bg-white text-green-600 rounded-md hover:bg-gray-100"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md hover:bg-green-700 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {/* Icon for menu */}
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {/* Social Media Icons - Mobile */}
            <div className="flex items-center space-x-4 px-3 py-2">
              <a
                href="https://instagram.com/hearthfire_farmandnursery"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-200 transition-colors flex items-center"
                aria-label="Follow us on Instagram"
                onClick={() => setIsMenuOpen(false)}
              >
                <FaInstagram className="h-5 w-5" />
                <span className="ml-2">Instagram</span>
              </a>
              <a
                href="https://facebook.com/hearthfirefarm"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-200 transition-colors flex items-center"
                aria-label="Follow us on Facebook"
                onClick={() => setIsMenuOpen(false)}
              >
                <FaFacebook className="h-5 w-5" />
                <span className="ml-2">Facebook</span>
              </a>
            </div>

            <Link 
              href="/products" 
              className="block px-3 py-2 rounded-md hover:bg-green-700"
              onClick={() => setIsMenuOpen(false)}
            >
              Products
            </Link>
            <Link 
              href="/about" 
              className="block px-3 py-2 rounded-md hover:bg-green-700"
              onClick={() => setIsMenuOpen(false)}
            >
              About Us
            </Link>
            <Link 
              href="/delivery" 
              className="block px-3 py-2 rounded-md hover:bg-green-700"
              onClick={() => setIsMenuOpen(false)}
            >
              Delivery
            </Link>
            
            {currentUser ? (
              <>
                <Link 
                  href="/cart" 
                  className="block px-3 py-2 rounded-md hover:bg-green-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Cart
                </Link>
                <Link 
                  href="/profile" 
                  className="block px-3 py-2 rounded-md hover:bg-green-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link 
                  href="/orders" 
                  className="block px-3 py-2 rounded-md hover:bg-green-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  My Orders
                </Link>
                
                {isAdmin && (
                  <Link 
                    href="/admin" 
                    className="block px-3 py-2 rounded-md hover:bg-green-700"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                )}
                
                <button 
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 rounded-md hover:bg-green-700"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="block px-3 py-2 rounded-md hover:bg-green-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Log in
                </Link>
                <Link 
                  href="/register" 
                  className="block px-3 py-2 bg-white text-green-600 rounded-md hover:bg-gray-100"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
} 