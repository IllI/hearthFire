import { useState, useEffect, useRef } from 'react';

/**
 * Address autocomplete component using Google Places API
 * @param {Object} props Component props
 * @param {string} props.value Initial value for the input
 * @param {Function} props.onChange Function called when address is selected or changed
 * @param {string} props.placeholder Placeholder text for the input 
 * @param {string} props.className Additional CSS classes for the input
 * @param {Object} props.inputProps Additional props to pass to the input element
 */
const AddressAutocomplete = ({ 
  value = '', 
  onChange, 
  placeholder = 'Enter an address', 
  className = '',
  inputProps = {}
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  
  useEffect(() => {
    // Update input value if the prop changes
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);
  
  // Load Google Maps Places API script
  useEffect(() => {
    // Global callback function for Google Maps API to call when loaded
    const callbackName = 'googleMapsApiLoaded';
    window[callbackName] = () => {
      setIsLoaded(true);
      console.log('Google Maps API loaded successfully');
    };

    // Check if API is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      console.log('Google Maps API already loaded');
      setIsLoaded(true);
      return;
    }
    
    // Check if script is already being loaded
    const existingScript = document.getElementById('google-maps-places-script');
    if (existingScript) {
      console.log('Google Maps script already loading');
      return; // Script is already loading, the callback will handle it
    }
    
    // Load the script
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        throw new Error('Google Maps API key is missing');
      }
      
      const script = document.createElement('script');
      script.id = 'google-maps-places-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}&loading=async`;
      script.async = true;
      script.defer = true;
      
      script.onerror = (error) => {
        console.error('Error loading Google Maps script:', error);
        setLoadError('Failed to load address lookup service');
      };
      
      document.head.appendChild(script);
      
      // Listen for specific Google Maps errors
      const originalConsoleError = console.error;
      console.error = (...args) => {
        // Check for Places API authorization errors
        if (args[0] && typeof args[0] === 'string' && 
            (args[0].includes('ApiNotActivatedMapError') || 
             args[0].includes('not authorized to use this API'))) {
          setApiError('Places API not enabled for this API key');
        }
        originalConsoleError.apply(console, args);
      };
      
      return () => {
        // Clean up callback and console override
        delete window[callbackName];
        console.error = originalConsoleError;
      };
    } catch (error) {
      console.error('Error setting up Google Maps script:', error);
      setLoadError(error.message);
    }
  }, []);
  
  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current || loadError || apiError) return;
    
    try {
      // Initialize autocomplete
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['address_components', 'formatted_address', 'geometry']
        }
      );
      
      // Add event listener for place selection
      const placeChangedListener = autocompleteRef.current.addListener('place_changed', () => {
        try {
          const place = autocompleteRef.current.getPlace();
          
          if (!place || !place.geometry) {
            // User entered the name of a place but didn't select from the dropdown
            // Just use what they typed as the value
            setInputValue(inputRef.current.value);
            if (onChange) onChange(inputRef.current.value);
            return;
          }
          
          // Get the formatted address
          const formattedAddress = place.formatted_address;
          setInputValue(formattedAddress);
          
          // Get address components and construct a structured address object
          const addressComponents = place.address_components || [];
          const addressObject = {
            formatted: formattedAddress,
            coordinates: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            },
            street_number: '',
            street: '',
            city: '',
            state: '',
            zip: '',
            country: ''
          };
          
          // Map address components to addressObject fields
          for (const component of addressComponents) {
            const type = component.types[0];
            
            if (type === 'street_number') {
              addressObject.street_number = component.long_name;
            } else if (type === 'route') {
              addressObject.street = component.long_name;
            } else if (type === 'locality') {
              addressObject.city = component.long_name;
            } else if (type === 'administrative_area_level_1') {
              addressObject.state = component.short_name;
            } else if (type === 'postal_code') {
              addressObject.zip = component.long_name;
            } else if (type === 'country') {
              addressObject.country = component.short_name;
            }
          }
          
          // Combine street number and street
          if (addressObject.street_number && addressObject.street) {
            addressObject.street_address = `${addressObject.street_number} ${addressObject.street}`;
          } else {
            addressObject.street_address = addressObject.street;
          }
          
          // Call onChange with the formatted address and structured address object
          if (onChange) {
            onChange(formattedAddress, addressObject);
          }
        } catch (placeError) {
          console.error('Error processing selected place:', placeError);
          
          // Check for API authorization errors
          if (placeError.message && placeError.message.includes('not authorized')) {
            setApiError('Google Places API not enabled for this API key');
          }
          
          // Still use the raw input value
          setInputValue(inputRef.current.value);
          if (onChange) onChange(inputRef.current.value);
        }
      });
      
      return () => {
        // Clean up the event listener
        if (window.google && window.google.maps && autocompleteRef.current) {
          window.google.maps.event.removeListener(placeChangedListener);
          autocompleteRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing Places Autocomplete:', error);
      
      // Check for API authorization errors
      if (error.message && (
          error.message.includes('ApiNotActivatedMapError') || 
          error.message.includes('not authorized'))) {
        setApiError('Places API not enabled for this API key');
      } else {
        setLoadError('Failed to initialize address lookup');
      }
    }
  }, [isLoaded, onChange, loadError, apiError]);
  
  // Handle input changes
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    // If there's an API error or not loaded, still call onChange with raw value
    if ((apiError || loadError) && onChange) {
      onChange(e.target.value);
    }
  };
  
  return (
    <div className="address-autocomplete">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`w-full p-2 border rounded ${className}`}
        disabled={!isLoaded && !apiError && !loadError}
        {...inputProps}
      />
      {!isLoaded && !apiError && !loadError && (
        <div className="text-sm text-gray-500 mt-1">Loading address lookup...</div>
      )}
      {loadError && (
        <div className="text-sm text-red-500 mt-1">
          {loadError}. Please enter address manually.
        </div>
      )}
      {apiError && (
        <div className="text-sm text-amber-600 mt-1">
          <span className="font-medium">Developer Setup Required:</span> {apiError}. 
          <br/>
          <span className="text-xs">Enable the Places API in the Google Cloud Console. Address field will work as regular input.</span>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete; 