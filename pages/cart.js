import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '../contexts/CartContext';
import { format } from 'date-fns';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import Head from 'next/head';
import Script from 'next/script';
import ZipcodeMap from '../components/ZipcodeMap';
import OrderLocationMap from '../components/OrderLocationMap';
import PickupLocationsList from '../components/PickupLocationsList';
import { formatTimeSlot, formatDeliveryDate } from '../utils/formatters';

// List of valid delivery zip codes
const VALID_ZIP_CODES = [
  "30002", "30021", "30030", "30032", "30033", "30034", "30035", "30038",
  "30072", "30079", "30080", "30083", "30084", "30088", "30094", "30228", 
  "30236", "30238", "30250", "30253", "30260", "30273", "30274", "30281", 
  "30288", "30294", "30296", "30297", "30303", "30305", "30306", "30307", 
  "30308", "30309", "30310", "30311", "30312", "30313", "30314", "30315", 
  "30316", "30317", "30318", "30319", "30322", "30324", "30326", "30327", 
  "30328", "30329", "30332", "30334", "30337", "30338", "30339", "30340", 
  "30341", "30342", "30344", "30345", "30346", "30354", "30360", "30363"
];

export default function Cart() {
  const { cart, deliveryInfo, addToCart, removeFromCart, updateQuantity, updateDeliveryInfo, applyPromoCode, checkCartPersistence } = useCart();
  const [deliverySchedules, setDeliverySchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zipCode, setZipCode] = useState(deliveryInfo.address.zip || '');
  const [zipCodeValid, setZipCodeValid] = useState(false);
  const [zipCodeChecked, setZipCodeChecked] = useState(false);
  const [osmScriptLoaded, setOsmScriptLoaded] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSearchError, setAddressSearchError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const streetInputRef = useRef(null);
  const suggestionListRef = useRef(null);
  const [streetInputValue, setStreetInputValue] = useState(deliveryInfo.address.street || '');
  const router = useRouter();
  
  // Local validation function to avoid import issues
  const validatePhoneInput = (phone) => {
    if (!phone) {
      return { isValid: false, error: 'Phone number is required' };
    }
    
    // Convert to string and remove all non-digits
    const cleaned = ('' + phone).replace(/\D/g, '');
    
    // Check length requirement
    if (cleaned.length !== 10) {
      return { 
        isValid: false, 
        error: cleaned.length < 10 
          ? 'Phone number must have 10 digits' 
          : 'Phone number cannot exceed 10 digits' 
      };
    }
    
    // Check for valid area code (can't start with 0 or 1)
    const areaCode = cleaned.substring(0, 3);
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
      return { isValid: false, error: 'Area code cannot start with 0 or 1' };
    }
    
    // Check for valid exchange code (second set of 3 digits)
    const exchangeCode = cleaned.substring(3, 6);
    if (exchangeCode.startsWith('0') || exchangeCode.startsWith('1')) {
      return { isValid: false, error: 'Exchange code cannot start with 0 or 1' };
    }
    
    return { isValid: true };
  };
  
  // New state variables for pickup/delivery toggle
  const [orderType, setOrderType] = useState('delivery'); // 'delivery' or 'pickup'
  const [pickupLocations, setPickupLocations] = useState([]);
  const [selectedPickupLocation, setSelectedPickupLocation] = useState(null);
  const [selectedPickupDate, setSelectedPickupDate] = useState(null);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState(null);
  
  // New state variable for promo code
  const [promoCode, setPromoCode] = useState('');
  const [promoCodeStatus, setPromoCodeStatus] = useState({ success: false, message: '' });
  
  // Check cart persistence on page load
  useEffect(() => {
    const persistenceStatus = checkCartPersistence();
    console.log('Cart persistence status on page load:', persistenceStatus);
    
    // Force localStorage sync if cart looks empty but storage has items
    if (cart.items.length === 0 && persistenceStatus.cartSize > 0) {
      console.warn('Cart appears empty but storage has items - syncing from localStorage');
      try {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          if (parsedCart.items && parsedCart.items.length > 0) {
            // Reload the page to force context to reinitialize
            window.location.reload();
          }
        }
      } catch (e) {
        console.error('Error trying to force cart sync:', e);
      }
    }
  }, []);
  
  // Check if we should return to checkout (must run after cart state loads)
  useEffect(() => {
    // Prevent redirect loops by checking for a recent redirect
    const lastRedirectTime = parseInt(sessionStorage.getItem('last_redirect_time') || '0');
    const currentTime = Date.now();
    const isRecentRedirect = (currentTime - lastRedirectTime) < 2000; // Within 2 seconds
    
    if (isRecentRedirect) {
      console.log('Detected recent redirect on cart page, breaking potential loop');
      // Clear redirect tracking to start fresh
      sessionStorage.removeItem('checkout_return_url');
      sessionStorage.removeItem('last_redirect_time');
      return;
    }
    
    // Get the saved checkout URL if it exists
    const checkoutReturnUrl = sessionStorage.getItem('checkout_return_url');
    
    if (checkoutReturnUrl && cart.items && cart.items.length > 0) {
      console.log('Found checkout return URL:', checkoutReturnUrl);
      
      // Extract the query parameters
      let returnWithParams = checkoutReturnUrl;
      
      try {
        // Make sure we preserve the query parameters from the original checkout URL
        const checkoutUrl = new URL(checkoutReturnUrl);
        const params = checkoutUrl.searchParams;
        
        // Only return to checkout if this is a different page (not already on checkout)
        if (!window.location.pathname.includes('/checkout')) {
          console.log('Returning to checkout with params:', params.toString());
          
          // Record the redirect to prevent loops
          sessionStorage.setItem('last_redirect_time', Date.now().toString());
          
          // Give it a moment to make sure cart state is fully loaded
          setTimeout(() => {
            // Clear the stored URL to prevent loops
            sessionStorage.removeItem('checkout_return_url');
            // Navigate back to checkout with the original params
            router.push(returnWithParams);
          }, 500);
        } else {
          // Already on checkout, just clear the stored URL
          sessionStorage.removeItem('checkout_return_url');
        }
      } catch (e) {
        console.error('Error parsing checkout return URL:', e);
        sessionStorage.removeItem('checkout_return_url');
      }
    }
  }, [cart.items, router]);
  
  // Handle component initialization
  useEffect(() => {
    // Try to load cart from localStorage
    if (typeof window !== 'undefined') {
      // Check if there's a validated ZIP code in localStorage
      const savedZipCode = localStorage.getItem('validZipCode');
      if (savedZipCode && VALID_ZIP_CODES.includes(savedZipCode)) {
        setZipCode(savedZipCode);
        setZipCodeValid(true);
        setZipCodeChecked(true);
        
        // Also update delivery info with the valid ZIP code
        updateDeliveryInfo({
          address: {
            ...deliveryInfo.address,
            zip: savedZipCode
          }
        });
        
        // No need to load OSM scripts since we already have a valid ZIP
        setOsmScriptLoaded(true);
      }
    }
  }, []);
  
  // Reset error state when zip code changes
  useEffect(() => {
    if (zipCodeValid) {
      setAddressSearchError(null);
    }
  }, [zipCodeValid]);

  // Initialize OSM address search when scripts are loaded
  useEffect(() => {
    if (!osmScriptLoaded || !zipCodeValid) return;
    
    console.log('OpenStreetMap libraries loaded successfully');
    
    // Click outside handler to close suggestions
    const handleClickOutside = (event) => {
      if (
        streetInputRef.current && 
        !streetInputRef.current.contains(event.target) && 
        suggestionListRef.current && 
        !suggestionListRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [osmScriptLoaded, zipCodeValid]);
  
  // Handle address lookup with OpenStreetMap (Nominatim)
  const searchAddress = async (query) => {
    if (!query || query.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    setAddressLoading(true);
    
    try {
      // Format query for better results
      // Add ZIP code to the query if it exists
      const formattedQuery = zipCode 
        ? `${query}, ${zipCode}, USA` 
        : `${query}, USA`;
      
      // Base URL and parameters
      const baseUrl = 'https://nominatim.openstreetmap.org/search';
      const params = new URLSearchParams({
        format: 'json',
        q: formattedQuery,
        addressdetails: 1,
        limit: 5,
        countrycodes: 'us'
      });
      
      // Only add viewbox if we have a valid ZIP (for Atlanta area)
      if (zipCode === '30354') {
        params.append('viewbox', '-84.7,33.5,-83.9,34.3');
        // Make bounded optional to get more results
        // params.append('bounded', '1');
      }
      
      console.log('Nominatim search URL:', `${baseUrl}?${params.toString()}`);
      
      const response = await fetch(`${baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Network response error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Nominatim search results:', data);
      
      if (data && data.length > 0) {
        setAddressSuggestions(data);
      } else {
        console.log('No address suggestions found');
        setAddressSuggestions([]);
      }
    } catch (error) {
      console.error('Error searching for addresses:', error);
      setAddressSuggestions([]);
    } finally {
      setAddressLoading(false);
    }
  };
  
  // Debounce function for address search
  const useDebounce = (func, delay) => {
    const debounceRef = useRef(null);
    
    return (...args) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => func(...args), delay);
    };
  };
  
  // Create debounced search function
  const debouncedSearch = useDebounce(searchAddress, 500);
  
  // Handle selection from the dropdown
  const handleSelectAddress = (address) => {
    console.log('Selected address:', address);
    
    // Extract address components from the Nominatim response
    const components = address.address || {};
    
    // Extract zip code from the selected address
    const selectedZipCode = components.postcode || '';
    
    // Create a complete street address
    let streetAddress = '';
    
    // Add house number if available
    if (components.house_number) {
      streetAddress += components.house_number;
    }
    
    // Add street/road
    if (components.road) {
      if (streetAddress) {
        streetAddress += ` ${components.road}`;
      } else {
        streetAddress = components.road;
      }
    }
    
    // If we don't have a street address yet, use the name or other components
    if (!streetAddress && components.building) {
      streetAddress = components.building;
    } else if (!streetAddress && address.display_name) {
      // Extract first part of display name as fallback
      const parts = address.display_name.split(',');
      streetAddress = parts[0].trim();
    }

    // Check if the selected address has a different ZIP code
    if (selectedZipCode && selectedZipCode !== zipCode) {
      console.log(`ZIP code changed from ${zipCode} to ${selectedZipCode}`);
      
      // Validate if the new ZIP code is in our delivery area
      const isValidZip = VALID_ZIP_CODES.includes(selectedZipCode);
      
      // Update the ZIP code state
      setZipCode(selectedZipCode);
      setZipCodeValid(isValidZip);
      setZipCodeChecked(true);
      
      // Show appropriate message
      if (!isValidZip) {
        // We'll display an error message for invalid zip codes
        setError(`We don't currently deliver to ${selectedZipCode}. Please select a different address in our delivery area.`);
      } else {
        setError(null);
      }
    }

    // Update the street input value state
    setStreetInputValue(streetAddress);

    // Update delivery information state
    updateDeliveryInfo({
      address: {
        ...deliveryInfo.address,
        street: streetAddress,
        city: components.city || components.town || components.village || components.municipality || components.county || 'Atlanta',
        state: components.state || 'GA',
        zip: selectedZipCode || zipCode // Use the selected ZIP code or keep the existing one
      }
    });

    // Close suggestions
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };
  
  // For handling changes directly to the input field
  const handleStreetInputChange = (e) => {
    const value = e.target.value;
    setStreetInputValue(value);
    
    if (value.trim().length >= 3 && zipCodeValid) {
      setShowSuggestions(true);
      debouncedSearch(value);
    } else {
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
    
    // Update delivery info when street is edited
    if (value) {
      updateDeliveryInfo({
        address: {
          ...deliveryInfo.address,
          street: value
        }
      });
    }
  };
  
  useEffect(() => {
    // Fetch available delivery schedules
    async function fetchDeliverySchedules() {
      try {
        setLoading(true);
        const response = await fetch('/api/delivery/schedules');
        
        if (!response.ok) {
          console.error('Failed to fetch delivery schedules:', response.statusText);
          throw new Error(`Failed to fetch delivery schedules: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Received delivery schedules data:', data);
        console.log('First schedule sample:', data.length > 0 ? 
          JSON.stringify({
            id: data[0].id,
            date: data[0].date,
            slots: data[0].slots ? 
              data[0].slots.map(s => ({id: s.id, available: s.available, currentOrders: s.currentOrders, maxOrders: s.maxOrders})) : 
              'No slots'
          }) : 'No schedules');
        
        // Validate the data structure
        if (!Array.isArray(data)) {
          console.error('Invalid delivery schedules data format:', data);
          throw new Error('Invalid delivery schedules data format');
        }
        
        // Filter out past dates and dates with no available slots
        const now = new Date();
        
        const availableSchedules = data.filter(schedule => {
          // Skip invalid schedules
          if (!schedule || !schedule.date) {
            console.warn('Skipping invalid schedule:', schedule);
            return false;
          }
          
          // Parse the date and verify it's valid
          let scheduleDate;
          if (schedule.date._seconds) {
            // Handle Firestore timestamp format
            console.log(`Parsing Firestore timestamp for schedule: ${schedule.id}`);
            scheduleDate = new Date(schedule.date._seconds * 1000);
          } else {
            // Try regular date parsing
            scheduleDate = new Date(schedule.date);
          }
          
          if (isNaN(scheduleDate.getTime())) {
            console.warn('Invalid date in schedule:', schedule);
            return false;
          }
          
          console.log(`Checking schedule date: ${scheduleDate.toDateString()}`);
          
          // Only filter out past dates
          if (scheduleDate <= now) {
            console.log(`Filtering out past date: ${scheduleDate.toDateString()}`);
            return false;
          }
          
          // Check if slots array exists and contains at least one available slot
          if (!schedule.slots || !Array.isArray(schedule.slots) || schedule.slots.length === 0) {
            console.warn('Schedule has no slots:', schedule);
            return false;
          }
          
          const hasAvailableSlots = schedule.slots.some(slot => 
            slot && slot.available && (!slot.maxOrders || slot.currentOrders < slot.maxOrders)
          );
          
          if (!hasAvailableSlots) {
            console.log(`Filtering out schedule with no available slots: ${scheduleDate.toDateString()}`);
          }
          
          return hasAvailableSlots;
        });
        
        console.log(`Filtered ${data.length} schedules down to ${availableSchedules.length} available schedules`);
        
        // Sort schedules by date in chronological order
        const sortedSchedules = [...availableSchedules].sort((a, b) => {
          const dateA = a.date._seconds 
            ? new Date(a.date._seconds * 1000) 
            : new Date(a.date);
          const dateB = b.date._seconds 
            ? new Date(b.date._seconds * 1000) 
            : new Date(b.date);
          return dateA - dateB;
        });
        
        // Deduplicate schedules with the same date to avoid duplicate entries in the dropdown
        const uniqueDates = new Map();
        const uniqueSchedules = [];
        
        for (const schedule of sortedSchedules) {
          // Get a normalized date string for comparison (YYYY-MM-DD)
          let dateObj;
          if (schedule.date._seconds) {
            dateObj = new Date(schedule.date._seconds * 1000);
          } else if (typeof schedule.date === 'string') {
            dateObj = new Date(schedule.date);
          } else {
            dateObj = new Date(schedule.date);
          }
          
          const dateKey = dateObj.toISOString().split('T')[0];
          
          // If we haven't seen this date yet, add it to our unique collection
          if (!uniqueDates.has(dateKey)) {
            uniqueDates.set(dateKey, true);
            uniqueSchedules.push(schedule);
          }
        }
        
        console.log(`Deduplicated from ${sortedSchedules.length} to ${uniqueSchedules.length} unique dates`);
        
        // Filter by schedule type to match the current order type
        const orderTypeFilteredSchedules = uniqueSchedules.filter(schedule => {
          // Only show delivery schedules for delivery orders and pickup schedules for pickup orders
          if (orderType === 'delivery') {
            return !schedule.type || schedule.type === 'delivery';
          } else if (orderType === 'pickup') {
            return schedule.type === 'pickup';
          }
          return true; // Fallback for any other case
        });
        
        console.log(`Filtered by orderType (${orderType}): ${uniqueSchedules.length} -> ${orderTypeFilteredSchedules.length}`);
        setDeliverySchedules(orderTypeFilteredSchedules);
        
        if (orderTypeFilteredSchedules.length === 0) {
          setError(`No ${orderType} dates available at this time. Please check back later.`);
        } else {
          setError(null);
        }
      } catch (error) {
        console.error('Error loading delivery schedules:', error);
        setError('Failed to load delivery options. Please try again later or contact us for assistance.');
        setDeliverySchedules([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDeliverySchedules();
  }, []);
  
  // Update delivery info when street input value changes
  useEffect(() => {
    // Don't update if the value is empty (to prevent clearing on initialization)
    if (streetInputValue !== deliveryInfo.address.street && streetInputValue) {
      updateDeliveryInfo({
        address: {
          ...deliveryInfo.address,
          street: streetInputValue
        }
      });
    }
  }, [streetInputValue]);
  
  const handleQuantityChange = (id, newQuantity) => {
    updateQuantity(id, parseInt(newQuantity));
  };
  
  const handleDeliveryDateChange = (e) => {
    const scheduleId = e.target.value;
    
    if (!scheduleId) {
      updateDeliveryInfo({
        date: '',
        timeSlot: '',
        scheduleId: ''
      });
      return;
    }
    
    const selectedSchedule = deliverySchedules.find(s => s.id === scheduleId);
    if (!selectedSchedule) return;
    
    // Handle different date formats consistently
    let formattedDate;
    
    if (selectedSchedule.date._seconds) {
      // Handle Firestore timestamp
      const date = new Date(selectedSchedule.date._seconds * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    } else if (typeof selectedSchedule.date === 'string') {
      // For string dates like "2025-03-14", ensure we only keep the date part
      formattedDate = selectedSchedule.date.split('T')[0];
    } else {
      // Fallback - get YYYY-MM-DD format without time component
      const date = new Date(selectedSchedule.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    }
    
    console.log(`Selected date ${selectedSchedule.date} formatted as ${formattedDate}`);
    
    updateDeliveryInfo({
      date: formattedDate,
      timeSlot: '',
      scheduleId
    });
  };
  
  const handleTimeSlotChange = (e) => {
    const timeSlotId = e.target.value;
    
    // Find the selected time slot from available time slots
    const selectedTimeSlot = getAvailableTimeSlots().find(slot => slot.id === timeSlotId);
    
    // Update delivery info with time slot ID and name
    updateDeliveryInfo({
      timeSlot: timeSlotId,
      timeSlotName: selectedTimeSlot ? `${selectedTimeSlot.name} (${selectedTimeSlot.time})` : undefined
    });
  };
  
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    updateDeliveryInfo({
      address: {
        ...deliveryInfo.address,
        [name]: value
      }
    });
  };
  
  const handleInstructionsChange = (e) => {
    updateDeliveryInfo({
      instructions: e.target.value
    });
  };
  
  const handleZipCodeChange = (e) => {
    setZipCode(e.target.value);
    setZipCodeChecked(false);
  };
  
  const checkZipCode = () => {
    const isValid = VALID_ZIP_CODES.includes(zipCode);
    setZipCodeValid(isValid);
    setZipCodeChecked(true);
    
    // Update zip code in delivery info if valid
    if (isValid) {
      updateDeliveryInfo({
        address: {
          ...deliveryInfo.address,
          zip: zipCode
        }
      });
      
      // Set OSM scripts as loaded since we don't need to load any external scripts
      setOsmScriptLoaded(true);
    }
  };
  
  // Effect to fetch pickup locations when order type changes to pickup
  useEffect(() => {
    if (orderType === 'pickup') {
      fetchPickupLocations();
    }
  }, [orderType]);
  
  // Function to fetch pickup locations from API
  const fetchPickupLocations = async () => {
    if (orderType !== 'pickup') return;
    
    setPickupLoading(true);
    
    try {
      console.log('Fetching pickup locations from API...');
      
      // Force a fresh fetch to ensure we get the latest data
      const response = await fetch(`/api/pickup/locations?forceReload=true`);
      
      if (!response.ok) {
        throw new Error(`Error fetching pickup locations: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.pickupLocations) {
        console.error('API returned unsuccessful response:', data);
        throw new Error('Failed to load pickup locations');
      }
      
      console.log(`Received ${data.pickupLocations.length} pickup locations`);
      
      // Create a map of dates to locations for easier lookup
      const dateToLocations = {};
      const uniqueDates = new Set();
      
      // Process all available locations
      data.pickupLocations.forEach(location => {
        if (!location.date) return;
        
        let dateStr;
        if (typeof location.date === 'string') {
          dateStr = location.date.split('T')[0]; // Get YYYY-MM-DD part
        } else if (location.date instanceof Date) {
          dateStr = location.date.toISOString().split('T')[0];
        } else {
          const dateObj = new Date(location.date);
          dateStr = dateObj.toISOString().split('T')[0];
        }
        
        uniqueDates.add(dateStr);
        
        if (!dateToLocations[dateStr]) {
          dateToLocations[dateStr] = [];
        }
        
        dateToLocations[dateStr].push(location);
      });
      
      // Log all unique dates found
      console.log('Available pickup dates:', Array.from(uniqueDates).join(', '));
      
      // Store the locations for the component to use
      setPickupLocations(data.pickupLocations);
      setPickupLoading(false);
      
      // If we already have a selected location, make sure it's still valid
      if (selectedPickupLocation) {
        const locationStillExists = data.pickupLocations.some(
          loc => loc.id === selectedPickupLocation
        );
        
        if (!locationStillExists) {
          console.log('Selected location no longer exists, resetting selection');
          setSelectedPickupLocation('');
          updateDeliveryInfo({
            ...deliveryInfo,
            pickupLocationId: '',
            pickupDate: ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching pickup locations:', error);
      setPickupError(`Failed to load pickup locations: ${error.message}`);
      setPickupLoading(false);
    }
  };
  
  // Handle order type toggle
  const handleOrderTypeChange = (type) => {
    setOrderType(type);
    
    // Reset any previous selections when switching types
    if (type === 'delivery') {
      // Reset pickup selections
      setSelectedPickupLocation(null);
      setSelectedPickupDate(null);
    } else {
      // Reset delivery selections if needed
      // We keep zipcode validation since it's useful for both
    }
  };
  
  // Handle pickup date selection
  const handlePickupDateSelect = (date) => {
    console.log('Selected pickup date:', date, 'Type:', typeof date);
    
    // Ensure we store the date in a consistent format (YYYY-MM-DD)
    let formattedDate;
    
    // First ensure we have just the date part without time components
    if (typeof date === 'string') {
      // If it's a string, handle different formats - ensure we only keep YYYY-MM-DD part
      formattedDate = date.includes('T') ? date.split('T')[0] : date;
    } else if (date instanceof Date) {
      // For Date objects, use UTC methods to avoid timezone issues
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    } else {
      // For any other format, try to convert to Date then format using UTC
      try {
        const dateObj = new Date(date);
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      } catch (error) {
        console.error('Error formatting date:', error);
        formattedDate = date; // Use as-is if can't format
      }
    }
    
    console.log('Final formatted pickup date:', formattedDate);
    
    setSelectedPickupDate(formattedDate);
    setSelectedPickupLocation(null); // Reset location when date changes
  };
  
  // Handle pickup location selection
  const handlePickupLocationSelect = (locationId) => {
    setSelectedPickupLocation(locationId);
  };
  
  // Get the selected pickup location object
  const getSelectedPickupLocation = () => {
    if (!selectedPickupLocation || !pickupLocations || pickupLocations.length === 0) {
      return null;
    }
    
    return pickupLocations.find(location => location.id === selectedPickupLocation);
  };
  
  // Check if pickup information is complete
  const isPickupInfoComplete = () => {
    return !!selectedPickupLocation && !!selectedPickupDate;
  };
  
  // Modified handleProceedToCheckout to handle both delivery and pickup
  const handleProceedToCheckout = (e) => {
    // Prevent any default form submission behavior
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    console.log('handleProceedToCheckout called, order type:', orderType);
    
    // Validate phone number first (required for both delivery and pickup)
    const phoneValidation = validatePhoneInput(deliveryInfo.phone);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error);
      return;
    }
    
    if (orderType === 'delivery') {
      // Existing delivery validation
      if (!zipCodeValid) {
        setError('Please enter a valid delivery zip code');
        return;
      }
      
      if (!deliveryInfo.date || !deliveryInfo.timeSlot) {
        setError('Please select a delivery date and time');
        return;
      }
      
      if (!deliveryInfo.address.street || !deliveryInfo.address.city || !deliveryInfo.address.state) {
        setError('Please complete your delivery address');
        return;
      }
    } else {
      // Pickup validation
      if (!isPickupInfoComplete()) {
        setError('Please select a pickup location and date');
        return;
      }
      console.log('Pickup info complete - location:', selectedPickupLocation, 'date:', selectedPickupDate);
    }
    
    // Clear any previous errors
    setError(null);
    
    // Prepare order info for checkout
    const selectedPickupLocationObj = getSelectedPickupLocation();
    console.log('Selected pickup location:', selectedPickupLocationObj);
    
    // Ensure the pickup date is properly formatted
    let formattedPickupDate = selectedPickupDate;
    if (selectedPickupDate) {
      try {
        // Ensure we have a clean date format
        const cleanDateStr = typeof selectedPickupDate === 'string' ? 
          selectedPickupDate.split('T')[0] : selectedPickupDate;
        
        console.log('Cart - Preparing date for checkout:', cleanDateStr);
        
        // Extract date components and rebuild with UTC to avoid timezone issues
        const [year, month, day] = cleanDateStr.split('-').map(Number);
        console.log('Cart - Date components for checkout:', { year, month, day });
        
        // Store as ISO string for consistency
        formattedPickupDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        console.log('Cart - Final formatted date for checkout:', formattedPickupDate);
      } catch (error) {
        console.error('Error formatting pickup date for checkout:', error);
        // Use the original value if there's an error
        formattedPickupDate = selectedPickupDate;
      }
    }

    try {
      const pickupInfo = orderType === 'pickup' ? {
        locationId: selectedPickupLocation,
        locationName: selectedPickupLocationObj?.title || '',
        address: selectedPickupLocationObj?.location?.address || '',
        date: formattedPickupDate, // Use the carefully formatted date
        // Store the exact time information from the pickup location
        time: selectedPickupLocationObj?.timeString || selectedPickupLocationObj?.startTime && selectedPickupLocationObj?.endTime 
          ? `${selectedPickupLocationObj.startTime} - ${selectedPickupLocationObj.endTime}`
          : '9:00 AM - 2:00 PM',
        // Store raw date/time information for precise time extraction
        rawStartDateTime: selectedPickupLocationObj?.rawStartDateTime || null,
        rawEndDateTime: selectedPickupLocationObj?.rawEndDateTime || null,
        instructions: deliveryInfo.instructions || ''
      } : null;
      
      console.log('Sending pickup info to checkout:', pickupInfo);
      
      // Update cart context with delivery or pickup info
      updateDeliveryInfo({
        ...deliveryInfo,
        orderType: orderType,
        pickupInfo: pickupInfo
      });
      
      console.log('Navigating to checkout page...');
      
      // Check for existing query parameters to preserve
      let queryParams = { t: Date.now() };
      
      // Clear any previous checkout URL to prevent loops
      sessionStorage.removeItem('checkout_return_url');
      
      // Mark this as an intentional navigation, not a recovery redirect
      sessionStorage.removeItem('last_redirect_time');
      
      // Use setTimeout to ensure context is updated before navigation
      setTimeout(() => {
        // Navigate to checkout using router with our combined query parameters
        router.push({
          pathname: '/checkout',
          query: queryParams
        });
      }, 200);
    } catch (error) {
      console.error('Error updating delivery info:', error);
      setError('An error occurred. Please try again.');
    }
  };
  
  // Inside the Cart component, add a new helper function to count available time slots
  const countAvailableTimeSlotsForSelectedDate = () => {
    if (!deliveryInfo.scheduleId) return 0;
    const availableSlots = getAvailableTimeSlots();
    return availableSlots.length;
  };

  // Modify the getAvailableTimeSlots function to handle the new behavior
  const getAvailableTimeSlots = () => {
    if (!deliveryInfo.scheduleId) return [];
    
    const selectedSchedule = deliverySchedules.find(
      s => s.id === deliveryInfo.scheduleId
    );
    
    if (!selectedSchedule) return [];
    
    // Only include slots that are marked as available AND have not reached capacity
    const availableSlots = selectedSchedule.slots.filter(slot => {
      const isAvailable = slot.available === true;
      const hasCapacity = slot.currentOrders < slot.maxOrders;
      
      if (!isAvailable) {
        console.log(`Slot ${slot.id} excluded: not available`);
      }
      
      if (!hasCapacity) {
        console.log(`Slot ${slot.id} excluded: at capacity (${slot.currentOrders}/${slot.maxOrders})`);
      }
      
      return isAvailable && hasCapacity;
    });
    
    console.log(`Selected schedule has ${availableSlots.length} available slots out of ${selectedSchedule.slots.length} total`);
    
    // If only one slot is available, automatically select it
    if (availableSlots.length === 1 && !deliveryInfo.timeSlot) {
      console.log('Auto-selecting the only available time slot:', availableSlots[0].id);
      // Use setTimeout to avoid state update during render
      setTimeout(() => {
        updateDeliveryInfo({
          timeSlot: availableSlots[0].id
        });
      }, 0);
    }
    
    return availableSlots;
  };

  // In the handleDateSelect function, add logic to auto-select time slot if there's only one
  const handleDateSelect = (e) => {
    const scheduleId = e.target.value;
    
    if (!scheduleId) {
      // If no date is selected, clear the delivery info
      updateDeliveryInfo({
        date: '',
        timeSlot: '',
        scheduleId: ''
      });
      return;
    }
    
    console.log('Selected schedule ID:', scheduleId);
    
    // Find the selected schedule
    const selectedSchedule = deliverySchedules.find(s => s.id === scheduleId);
    if (!selectedSchedule) {
      console.error('Selected schedule not found:', scheduleId);
      return;
    }
    
    // Get the date from the selected schedule
    let formattedDate;
    
    if (selectedSchedule.date._seconds) {
      // Handle Firestore timestamp
      const date = new Date(selectedSchedule.date._seconds * 1000);
      formattedDate = date.toISOString().split('T')[0];
    } else if (typeof selectedSchedule.date === 'string') {
      // For string dates, ensure we only keep the date part
      formattedDate = selectedSchedule.date.split('T')[0];
    } else {
      // Fallback for other formats
      const date = new Date(selectedSchedule.date);
      formattedDate = date.toISOString().split('T')[0];
    }
    
    console.log('Selected date from schedule:', formattedDate);
    
    // Update delivery info with the selected date and schedule ID, but clear time slot
    // to allow for auto-selection if there's only one option
    updateDeliveryInfo({
      date: formattedDate,
      scheduleId: scheduleId,
      timeSlot: ''  // Clear time slot to trigger auto-selection if needed
    });
  };
  
  // New function to handle applying a promo code
  const handleApplyPromoCode = async () => {
    // Only apply the entered promo code
    if (!promoCode.trim()) {
      setPromoCodeStatus({ success: false, message: 'Please enter a promo code' });
      return;
    }
    
    // Check if this promo code has already been applied
    if (cart.promoCodes && cart.promoCodes.includes(promoCode.trim().toUpperCase())) {
      setPromoCodeStatus({ success: false, message: 'This promo code has already been applied' });
      return;
    }
    
    setPromoCodeStatus({ success: false, message: 'Validating...' });
    
    try {
      const result = await applyPromoCode(promoCode);
      setPromoCodeStatus(result);
      
      if (result.success) {
        // Clear the input if successful
        setPromoCode('');
      }
    } catch (err) {
      console.error('Error applying promo code:', err);
      setPromoCodeStatus({ 
        success: false, 
        message: 'An error occurred while applying the promo code. Please try again.' 
      });
    }
  };
  
  if (cart.items.length === 0) {
    return (
      <>
        <Head>
          <title>Shopping Cart | Hearthfire Farm</title>
        </Head>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="text-center text-gray-500 my-8">Your cart is empty</p>
            <div className="text-center">
              <Link href="/products" className="inline-block bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition">
                Browse Products
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  const availableTimeSlots = getAvailableTimeSlots();
  
  return (
    <>
      <Head>
        <title>Your Cart | Hearthfire Farm</title>
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Your Cart</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Cart items */}
          <div className="lg:col-span-7">
            {/* Desktop table view */}
            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cart.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 relative flex-shrink-0">
                            {item.image ? (
                              <Image 
                                src={item.image} 
                                alt={item.name}
                                fill
                                className="object-cover rounded-md"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-md bg-gray-200 flex items-center justify-center">
                                <span className="text-xs text-gray-500">No IMG</span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {item.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          ${typeof item.price === 'number' ? item.price.toFixed(2) : '0.00'}
                        </div>
                        <div className="text-sm text-gray-500">per {item.unit || 'item'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input 
                          type="number" 
                          min="1" 
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="w-16 border rounded p-1 text-center"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${typeof item.price === 'number' ? (item.price * item.quantity).toFixed(2) : '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      Subtotal
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${cart.subtotal.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="bg-white shadow-md rounded-lg p-4">
                  <div className="flex items-start space-x-4">
                    {/* Product image */}
                    <div className="h-20 w-20 relative flex-shrink-0">
                      {item.image ? (
                        <Image 
                          src={item.image} 
                          alt={item.name}
                          fill
                          className="object-cover rounded-md"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-md bg-gray-200 flex items-center justify-center">
                          <span className="text-xs text-gray-500">No IMG</span>
                        </div>
                      )}
                    </div>

                    {/* Product details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-gray-900 truncate">
                        {item.name}
                      </h3>
                      <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-gray-500">
                          ${typeof item.price === 'number' ? item.price.toFixed(2) : '0.00'} per {item.unit || 'item'}
                        </div>
                      </div>

                      {/* Quantity and total */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <label htmlFor={`quantity-${item.id}`} className="text-sm text-gray-600">
                            Qty:
                          </label>
                          <input 
                            id={`quantity-${item.id}`}
                            type="number" 
                            min="1" 
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            className="w-16 border rounded p-1 text-center"
                          />
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          Total: ${typeof item.price === 'number' ? (item.price * item.quantity).toFixed(2) : '0.00'}
                        </div>
                      </div>

                      {/* Remove button */}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-sm text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Mobile subtotal */}
              <div className="bg-white shadow-md rounded-lg p-4 mt-4">
                {/* Mobile Promo Code */}
                <div className="mb-4 pb-4 border-b">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Promo Code</h3>
                  <div className="flex">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Enter promo code"
                      className="border rounded-l p-2 flex-1"
                    />
                    <button
                      onClick={handleApplyPromoCode}
                      className="px-4 py-2 rounded-r text-white font-medium bg-green-600 hover:bg-green-700"
                    >
                      Apply
                    </button>
                  </div>
                  
                  {promoCodeStatus.message && (
                    <p className={`mt-2 text-sm ${promoCodeStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                      {promoCodeStatus.message}
                    </p>
                  )}
                  
                  {cart.promoCodes && cart.promoCodes.length > 0 && (
                    <div className="mt-3 text-sm">
                      <div className="font-medium mb-1">Applied Promo Codes:</div>
                      <div className="flex flex-wrap gap-1">
                        {cart.promoCodes.map(code => (
                          <div key={code} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">Subtotal</span>
                  <span className="text-gray-900">${cart.subtotal.toFixed(2)}</span>
                </div>
                
                {cart.discount > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Discount</span>
                    <span className="text-green-600">-${cart.discount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">{orderType === 'delivery' ? 'Delivery Fee' : 'Pickup Fee'}</span>
                  <span className="text-gray-600">
                    {cart.promoCode === 'DELIVFREE' && orderType === 'delivery' 
                      ? '$0.00' 
                      : `$${orderType === 'delivery' ? '10.00' : '0.00'}`}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Tax</span>
                  <span className="text-gray-600">${cart.tax.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center pt-2 mt-2 border-t">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">${cart.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            {/* Map Area - Either Delivery or Pickup Map based on orderType */}
            <div className="mt-6 mb-6 bg-white shadow-md rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">
                  {orderType === 'delivery' ? 'Delivery Area' : 'Pickup Locations'}
                </h3>
                {orderType === 'delivery' && zipCodeValid && (
                  <span className="text-sm text-green-600 font-medium">
                    Delivering to: {zipCode}
                  </span>
                )}
              </div>
              
              {orderType === 'delivery' ? (
                /* Delivery Map */
                <ZipcodeMap 
                  selectedZipcode={zipCodeValid ? zipCode : null} 
                  height="380px" 
                />
              ) : (
                /* Pickup Map */
                <div>
                  <OrderLocationMap
                    mode="pickup"
                    pickupLocations={pickupLocations}
                    selectedPickupLocation={selectedPickupLocation}
                    onPickupLocationSelect={handlePickupLocationSelect}
                    height="380px"
                  />
                  
                  <div className="mt-2">
                    {pickupLoading && (
                      <div className="text-center py-2">
                        <div className="spinner inline-block mr-2"></div>
                        Loading pickup locations...
                      </div>
                    )}
                    
                    {pickupError && (
                      <div className="text-red-500 text-sm mt-2 p-2 bg-red-50 rounded">
                        {pickupError}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-between">
              <Link href="/products" className="text-green-600 hover:text-green-700">
                &larr; Continue Shopping
              </Link>
            </div>
          </div>
          
          {/* Order summary */}
          <div className="lg:col-span-5">
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              
              {/* Order Type Toggle */}
              <div className="mb-6">
                <div className="font-medium text-gray-700 mb-2">Order Type</div>
                <div className="flex space-x-4 border-b pb-4">
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-md transition ${
                      orderType === 'delivery' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => handleOrderTypeChange('delivery')}
                  >
                    Delivery
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-md transition ${
                      orderType === 'pickup' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => handleOrderTypeChange('pickup')}
                  >
                    Pickup
                  </button>
                </div>
              </div>
              
              {/* DELIVERY SECTION */}
              {orderType === 'delivery' && (
                <>
                  <div className="mb-6">
                    <h3 className="text-md font-medium mb-2">Delivery ZIP Code</h3>
                    <div className="flex">
                      <input
                        type="text"
                        value={zipCode}
                        onChange={handleZipCodeChange}
                        placeholder="Enter ZIP code"
                        className="border rounded-l p-2 w-full"
                        maxLength="5"
                        pattern="[0-9]{5}"
                        readOnly={zipCodeValid}
                      />
                      <button
                        onClick={checkZipCode}
                        className="bg-green-600 text-white px-4 py-2 rounded-r hover:bg-green-700"
                        disabled={zipCodeValid}
                      >
                        Check
                      </button>
                    </div>
                    {zipCodeChecked && (
                      <p className={`mt-2 text-sm ${zipCodeValid ? 'text-green-600' : 'text-red-600'}`}>
                        {zipCodeValid 
                          ? "Great! We deliver to your area." 
                          : "Sorry, we don't currently deliver to this ZIP code."}
                      </p>
                    )}
                  </div>
                  
                  {zipCodeValid && (
                    <>
                      <div className="mb-6">
                        <h3 className="text-md font-medium mb-2">Select Delivery Time</h3>
                        
                        {countAvailableTimeSlotsForSelectedDate() === 1 ? (
                          // If only one slot is available, just show it as text
                          <div className="p-2 bg-gray-50 border rounded">
                            {getAvailableTimeSlots()[0] && 
                              formatTimeSlot(getAvailableTimeSlots()[0].id)}
                            <p className="mt-1 text-xs text-gray-500">
                              Only one delivery window available for this date
                            </p>
                          </div>
                        ) : (
                          // Otherwise, show the dropdown
                          <select
                            value={deliveryInfo.timeSlot}
                            onChange={handleTimeSlotChange}
                            className="border rounded p-2 w-full"
                            required
                          >
                            <option value="">Select a time slot</option>
                            {getAvailableTimeSlots().map(slot => (
                              <option key={slot.id} value={slot.id}>
                                {formatTimeSlot(slot.id)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      
                      {deliveryInfo.scheduleId && deliveryInfo.timeSlot && (
                        <>
                          <div className="mb-6">
                            <h3 className="text-md font-medium mb-2">Delivery Address</h3>
                            
                            <div className="mb-4 relative">
                              <label className="block text-sm text-gray-600 mb-1">Street Address</label>
                              <input
                                type="text"
                                name="street"
                                value={streetInputValue}
                                onChange={handleStreetInputChange}
                                className="border rounded p-2 w-full"
                                placeholder="Enter your street address"
                                required
                                ref={streetInputRef}
                              />
                              
                              {/* Address suggestions dropdown */}
                              {showSuggestions && addressSuggestions.length > 0 && (
                                <div 
                                  className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto"
                                  ref={suggestionListRef}
                                >
                                  <ul className="py-1">
                                    {addressSuggestions.map((suggestion) => (
                                      <li 
                                        key={suggestion.place_id} 
                                        onClick={() => handleSelectAddress(suggestion)}
                                        className="px-3 py-2 text-sm hover:bg-green-50 cursor-pointer"
                                      >
                                        <div className="font-medium">{suggestion.display_name.split(',')[0]}</div>
                                        <div className="text-xs text-gray-500">{suggestion.display_name.split(',').slice(1, 4).join(', ')}</div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {showSuggestions && addressSuggestions.length === 0 && !addressLoading && zipCode && (
                                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 p-3">
                                  <p className="text-sm text-gray-700">No address matches found. Try adding more details or use a different format.</p>
                                </div>
                              )}
                            </div>
                            
                            <div className="mb-4">
                              <label className="block text-sm text-gray-600 mb-1">City</label>
                              <input
                                type="text"
                                name="city"
                                value={deliveryInfo.address.city || ''}
                                onChange={handleAddressChange}
                                className="border rounded p-2 w-full"
                                required
                              />
                            </div>
                            
                            <div className="mb-4">
                              <label className="block text-sm text-gray-600 mb-1">Phone Number</label>
                              <input
                                type="tel"
                                name="phone"
                                value={deliveryInfo.phone || ''}
                                onChange={(e) => {
                                  // Allow only numbers and format the phone number
                                  const cleaned = e.target.value.replace(/\D/g, '');
                                  
                                  // Limit to 10 digits
                                  if (cleaned.length > 10) {
                                    return; // Prevent input beyond 10 digits
                                  }
                                  
                                  let formatted = cleaned;
                                  
                                  // Format as user types: (XXX) XXX-XXXX
                                  if (cleaned.length > 0) {
                                    formatted = cleaned.replace(/(\d{0,3})(\d{0,3})(\d{0,4})/, (_, p1, p2, p3) => {
                                      let result = '';
                                      if (p1) result += `(${p1}`;
                                      if (p2) result += `) ${p2}`;
                                      if (p3) result += `-${p3}`;
                                      return result;
                                    });
                                  }
                                  
                                  updateDeliveryInfo({ phone: formatted });
                                }}
                                className={`border rounded p-2 w-full ${deliveryInfo.phone && !validatePhoneInput(deliveryInfo.phone).isValid ? 'border-red-500' : ''}`}
                                placeholder="(123) 456-7890"
                                required
                              />
                              <div className="flex justify-between">
                                <p className="mt-1 text-xs text-gray-500">For delivery updates and questions</p>
                                {deliveryInfo.phone && !validatePhoneInput(deliveryInfo.phone).isValid && 
                                  <p className="mt-1 text-xs text-red-500">{validatePhoneInput(deliveryInfo.phone).error}</p>
                                }
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">State</label>
                                <input
                                  type="text"
                                  name="state"
                                  value={deliveryInfo.address.state || 'GA'}
                                  onChange={handleAddressChange}
                                  placeholder="State"
                                  className="border rounded p-2 w-full"
                                  required
                                  maxLength="2"
                                />
                              </div>
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">ZIP Code</label>
                                <input
                                  type="text"
                                  name="zip"
                                  value={zipCode}
                                  className="border rounded p-2 w-full bg-gray-100"
                                  required
                                  readOnly
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="mb-6">
                            <h3 className="text-md font-medium mb-2">Delivery Instructions (Optional)</h3>
                            <textarea
                              value={deliveryInfo.instructions || ''}
                              onChange={handleInstructionsChange}
                              placeholder="Add any special instructions for delivery"
                              className="border rounded p-2 w-full"
                              rows="3"
                            ></textarea>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
              
              {/* PICKUP SECTION */}
              {orderType === 'pickup' && (
                <>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-3">Pickup Options</h3>
                    
                    {/* Pickup Location Selection - No map in this section */}
                    <PickupLocationsList
                      locations={pickupLocations}
                      selectedLocation={selectedPickupLocation}
                      onLocationSelect={handlePickupLocationSelect}
                      selectedDate={selectedPickupDate}
                      onDateSelect={handlePickupDateSelect}
                    />
                    
                    {/* Phone and Instructions */}
                    {selectedPickupLocation && (
                      <>
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number (for pickup updates)
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={deliveryInfo.phone || ''}
                            onChange={(e) => {
                              // Allow only numbers and format the phone number
                              const cleaned = e.target.value.replace(/\D/g, '');
                              
                              // Limit to 10 digits
                              if (cleaned.length > 10) {
                                return; // Prevent input beyond 10 digits
                              }
                              
                              let formatted = cleaned;
                              
                              // Format as user types: (XXX) XXX-XXXX
                              if (cleaned.length > 0) {
                                formatted = cleaned.replace(/(\d{0,3})(\d{0,3})(\d{0,4})/, (_, p1, p2, p3) => {
                                  let result = '';
                                  if (p1) result += `(${p1}`;
                                  if (p2) result += `) ${p2}`;
                                  if (p3) result += `-${p3}`;
                                  return result;
                                });
                              }
                              
                              updateDeliveryInfo({ phone: formatted });
                            }}
                            className={`border rounded p-2 w-full ${deliveryInfo.phone && !validatePhoneInput(deliveryInfo.phone).isValid ? 'border-red-500' : ''}`}
                            placeholder="(123) 456-7890"
                            required
                          />
                          <div className="flex justify-between">
                            <p className="mt-1 text-xs text-gray-500">For pickup updates and questions</p>
                            {deliveryInfo.phone && !validatePhoneInput(deliveryInfo.phone).isValid && 
                              <p className="mt-1 text-xs text-red-500">{validatePhoneInput(deliveryInfo.phone).error}</p>
                            }
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pickup Instructions (Optional)
                          </label>
                          <textarea
                            name="instructions"
                            value={deliveryInfo.instructions || ''}
                            onChange={handleInstructionsChange}
                            className="w-full p-2 border rounded-md"
                            rows="3"
                            placeholder="Special handling instructions, etc."
                          ></textarea>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
              
              {/* Order Summary and Checkout Button */}
              <div className="mt-8">
                {/* Promo Code Section - Only show if not delivery or if delivery with valid zip */}
                {(orderType !== 'delivery' || zipCodeValid) && (
                  <div className="mb-4 pb-4 border-b">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Promo Code</h3>
                    <div className="flex">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Enter promo code"
                        className="border rounded-l p-2 w-full"
                      />
                      <button
                        onClick={handleApplyPromoCode}
                        className="px-4 py-2 rounded-r text-white font-medium bg-green-600 hover:bg-green-700"
                      >
                        Apply
                      </button>
                    </div>
                    
                    {promoCodeStatus.message && (
                      <p className={`mt-2 text-sm ${promoCodeStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                        {promoCodeStatus.message}
                      </p>
                    )}
                    
                    {cart.promoCodes && cart.promoCodes.length > 0 && (
                      <div className="mt-3 text-sm">
                        <div className="font-medium mb-1">Applied Promo Codes:</div>
                        <div className="flex flex-wrap gap-1">
                          {cart.promoCodes.map(code => (
                            <div key={code} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {code}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between mb-2">
                  <span className="text-lg">Subtotal</span>
                  <span className="text-lg">${cart.subtotal.toFixed(2)}</span>
                </div>
                {cart.discount > 0 && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Discount</span>
                    <span className="text-green-600">-${cart.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">{orderType === 'delivery' ? 'Delivery Fee' : 'Pickup Fee'}</span>
                  <span className="text-gray-600">
                    {cart.promoCode === 'DELIVFREE' && orderType === 'delivery' 
                      ? '$0.00' 
                      : `$${orderType === 'delivery' ? '10.00' : '0.00'}`}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Tax</span>
                  <span className="text-gray-600">${cart.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2 pt-2 border-t">
                  <span className="text-xl font-semibold">Total</span>
                  <span className="text-xl font-semibold">${cart.total.toFixed(2)}</span>
                </div>
              </div>
              
              {error && (
                <p className="mt-2 text-sm text-red-600 font-medium">
                  {error}
                </p>
              )}
              
              <button
                type="button"
                onClick={handleProceedToCheckout}
                disabled={
                  orderType === 'delivery' ? 
                    (!zipCodeValid || !deliveryInfo.date || !deliveryInfo.timeSlot || !deliveryInfo.address.street) : 
                    !isPickupInfoComplete()
                }
                className={`w-full mt-4 py-3 px-4 rounded-md text-white text-lg font-medium
                  ${(orderType === 'delivery' && (!zipCodeValid || !deliveryInfo.date || !deliveryInfo.timeSlot || !deliveryInfo.address.street)) || 
                    (orderType === 'pickup' && !isPickupInfoComplete())
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'}`}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 