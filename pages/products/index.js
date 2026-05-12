import { useCart } from '../../contexts/CartContext';
import { useEffect, useState, useMemo } from 'react';
import ProductCard from '../../components/ProductCard';
import SlidingCartModal from '../../components/SlidingCartModal';
import StickyNavbar from '../../components/StickyNavbar';
import ZipcodeCheckModal from '../../components/ZipcodeCheckModal';
import { useAuth } from '../../contexts/AuthContext';

export default function Products() {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [imagesLoaded, setImagesLoaded] = useState({});
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zipCheckModalOpen, setZipCheckModalOpen] = useState(false);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  
  // Check if we should show the ZIP code modal
  useEffect(() => {
    // Only run this on the client side
    if (typeof window === 'undefined') return;
    
    // Don't try to access sessionStorage/localStorage during SSR
    try {
      // Check if user has seen the modal before in this session
      const hasSeenModal = sessionStorage.getItem('hasSeenZipModal') === 'true';
      
      // Check if there's a valid ZIP code already stored
      const hasValidZipCode = localStorage.getItem('validZipCode');
      
      // Only show the modal for new/non-logged-in users who haven't seen it
      if (!user && !hasSeenModal && !hasValidZipCode) {
        // Slight delay to make sure the modal appears after page loads
        const timer = setTimeout(() => {
          setZipCheckModalOpen(true);
          
          // Mark as seen in session storage
          sessionStorage.setItem('hasSeenZipModal', 'true');
        }, 500);
        
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error('Error accessing storage:', error);
    }
  }, [user]);
  
  // Handle closing the ZIP check modal
  const handleCloseZipModal = () => {
    setZipCheckModalOpen(false);
  };
  
  // Fetch products via API endpoint instead of directly from Firestore
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        console.log('Fetching products via API...');
        
        // Use the API endpoint that fetches from admin SDK
        const response = await fetch('/api/products');
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const productsData = await response.json();
        
        // Process the products data similar to before
        const processedProducts = productsData.map(product => {
          return {
            ...product,
            // Ensure price is a number
            price: parseFloat(product.price || 0),
            // Ensure quantity is a number for inventory display
            quantity: parseInt(product.quantity || 0),
            // Ensure stock is a number for inventory display
            stock: parseInt(product.stock || 0),
          };
        });

        // Sort products: featured first, then alphabetically by name
        const sortedProducts = processedProducts.sort((a, b) => {
          // Check if products are featured
          const aFeatured = a.featured === true;
          const bFeatured = b.featured === true;
          
          // Featured items come first
          if (aFeatured && !bFeatured) return -1;
          if (!aFeatured && bFeatured) return 1;
          
          // If featured status is the same, sort alphabetically by name
          return a.name.localeCompare(b.name);
        });
        
        console.log(`Loaded ${sortedProducts.length} products from API`);
        setProducts(sortedProducts);
        
        // Extract unique categories from products
        const categories = new Set();
        sortedProducts.forEach(product => {
          if (product.category) {
            categories.add(product.category);
          }
        });
        setAvailableCategories(Array.from(categories).sort());
        
      } catch (error) {
        console.error("Error fetching products:", error);
        setError("Failed to load products. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);
  
  // Handle search input changes
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle category filter selection
  const toggleCategoryFilter = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(cat => cat !== category)
        : [...prev, category]
    );
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
  };
  
  // Filter products based on search term and selected categories
  const filteredProducts = useMemo(() => {
    // First filter out sold out products
    const inStockProducts = products.filter(product => {
      // Support both stock and quantity fields for backward compatibility
      const inventoryCount = product.quantity !== undefined ? product.quantity : (product.stock || 0);
      return inventoryCount > 0; // Only include products with inventory greater than 0
    });
    
    // Then apply search and category filters
    if (!searchTerm && selectedCategories.length === 0) {
      return inStockProducts;
    }
    
    return inStockProducts.filter(product => {
      // Search term filter
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Category filter
      const matchesCategory = selectedCategories.length === 0 || 
        selectedCategories.includes(product.category);
      
      // Both filters must match
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategories]);

  const handleImageLoad = (productId) => {
    setImagesLoaded(prev => ({
      ...prev,
      [productId]: true
    }));
  };

  const handleImageError = (e, product) => {
    // Prevent infinite loop by checking if we're already trying to load a fallback
    const currentSrc = e.target.src;
    console.error(`Image failed to load for ${product.name}: ${currentSrc}`);
    
    // Clear the error handler to prevent future loops
    e.target.onerror = null;
    
    // If we're not already using the fallback, switch to it
    if (!currentSrc.includes('/api/fallback-placeholder')) {
      e.target.src = `/api/fallback-placeholder?name=${encodeURIComponent(product.name)}`;
    } else {
      // As a last resort, use an inline SVG data URL that's guaranteed to work
      e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23cccccc'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='%23666666'%3E${product.name}%3C/text%3E%3C/svg%3E`;
    }
  };

  return (
    <>
      {/* Zipcode Check Modal */}
      <ZipcodeCheckModal 
        isOpen={zipCheckModalOpen}
        onClose={handleCloseZipModal}
      />
      
      {/* Sticky Navbar that appears when scrolling */}
      <StickyNavbar />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h2 className="text-3xl font-bold text-green-700 mb-4 md:mb-0">Our Produce</h2>
          
          {/* Search bar */}
          <div className="w-full md:w-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full md:w-80 pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <div className="absolute left-3 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Category filters */}
        {availableCategories.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2">Filter by Category:</h3>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategoryFilter(category)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    selectedCategories.includes(category)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  {category.replace(/-/g, ' ')}
                </button>
              ))}
              {(searchTerm || selectedCategories.length > 0) && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Products display */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
            <p className="mt-2 text-gray-600">Loading products...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">
            <p>{error}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-4 text-lg text-gray-600">No products match your search.</p>
            <button 
              onClick={clearFilters}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 text-gray-600">
              Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
              {(searchTerm || selectedCategories.length > 0) ? ' matching your filters' : ''}
              <p className="text-sm mt-1 text-gray-500">Only in-stock products are displayed.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  setCartModalOpen={setCartModalOpen}
                />
              ))}
            </div>
          </>
        )}
        
        {/* Sliding Cart Modal */}
        <SlidingCartModal 
          isOpen={cartModalOpen} 
          onClose={() => setCartModalOpen(false)} 
        />
      </div>
    </>
  );
} 