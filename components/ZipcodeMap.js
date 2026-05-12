import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// This array should match the VALID_ZIP_CODES from cart.js
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

// Create a Google Maps loader that can be used globally
const loadGoogleMapsScript = (() => {
  let promise = null;

  return () => {
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        // Create script tag manually
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => resolve(window.google);
        script.onerror = (error) => reject(error);
        
        document.head.appendChild(script);
      });
    }
    
    return promise;
  };
})();

// Define the component using named function for better debugging
const ZipcodeMap = forwardRef(function ZipcodeMap(props, ref) {
  const { selectedZipcode, height = '400px', pickupLocations, selectedLocation, onLocationClick } = props;
  
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonsRef = useRef([]);
  const markersRef = useRef([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [useStaticMap, setUseStaticMap] = useState(false);
  const mountedRef = useRef(true);

  // Log props for debugging
  useEffect(() => {
    console.log('ZipcodeMap props:', {
      selectedZipcode,
      height,
      hasPickupLocations: pickupLocations ? pickupLocations.length > 0 : false,
      hasSelectedLocation: !!selectedLocation,
      hasClickHandler: !!onLocationClick
    });
  }, [selectedZipcode, height, pickupLocations, selectedLocation, onLocationClick]);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    // Method to zoom to a specific location
    zoomToLocation: (location) => {
      if (!mapInstanceRef.current || !window.google || !window.google.maps) return;
      
      try {
        const google = window.google;
        const lat = parseFloat(location.lat);
        const lng = parseFloat(location.lng);
        
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          console.warn('Invalid coordinates for zoom:', location);
          return;
        }
        
        // Create a point for the location
        const position = new google.maps.LatLng(lat, lng);
        
        // Set center and zoom
        mapInstanceRef.current.setCenter(position);
        mapInstanceRef.current.setZoom(14); // Close enough to see detail
        
        // Find the marker for this location and make it bounce
        const marker = markersRef.current.find(item => 
          item.location && 
          ((item.location.id === location.id) || 
           (item.location.lat === lat && item.location.lng === lng))
        );
        
        if (marker && marker.marker) {
          // Ensure animation is set
          marker.marker.setAnimation(google.maps.Animation.BOUNCE);
          
          // Stop the animation after 3 seconds
          setTimeout(() => {
            if (marker.marker) {
              marker.marker.setAnimation(null);
            }
          }, 3000);
        }
      } catch (err) {
        console.error('Error zooming to location:', err);
      }
    }
  }));

  // Check if we're in development mode
  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development');
    
    // Set mounted flag
    mountedRef.current = true;
    
    // Cleanup function to set mounted flag to false
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  // Initialize the map
  useEffect(() => {
    if (!mapContainerRef.current) {
      console.error('Map container ref is not available');
      return;
    }
    
    // Check if Google Maps API key is available
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API key is missing');
      setError('Google Maps API key is missing');
      setLoading(false);
      setUseStaticMap(true);
      return;
    }
    
    console.log('Initializing map with container:', mapContainerRef.current);
    
    let mapInstance = null;
    let googleAPI = null;
    
    // Mark component as loading
    setLoading(true);
    
    const initMap = async () => {
      try {
        // Load the Google Maps script
        googleAPI = await loadGoogleMapsScript();
        
        // If component unmounted during script load, abort
        if (!mountedRef.current) return;
        
        console.log("Google Maps API loaded, initializing map");
        
        // Create map centered on Atlanta
        const mapOptions = {
          center: { lat: 33.749, lng: -84.388 },
          zoom: 9.5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeId: 'roadmap',
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        };
        
        // Create the map instance
        mapInstance = new googleAPI.maps.Map(mapContainerRef.current, mapOptions);
        mapInstanceRef.current = mapInstance;
        
        // Load GeoJSON data for zipcodes
        await loadZipcodeData(mapInstance, googleAPI);
        
        // Add pickup location markers if available
        if (pickupLocations && pickupLocations.length > 0) {
          addPickupMarkers(mapInstance, googleAPI, pickupLocations);
        }
        
        // Set loading to false when map is ready
        if (mountedRef.current) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error initializing map:', err);
        if (mountedRef.current) {
          setError(`Error initializing map: ${err.message}`);
          setLoading(false);
          // Only use static map if we have a genuine error 
          if (err.message.includes('API key') || err.message.includes('script error')) {
            setUseStaticMap(true);
          }
        }
      }
    };
    
    initMap();
    
    // Cleanup function
    return () => {
      // Clear any polygons
      clearPolygons();
      
      // Clear any markers
      clearMarkers();
      
      // Do not explicitly clear the map instance 
      // Let Google Maps handle its own cleanup
      mapInstanceRef.current = null;
    };
  }, []);
  
  // Update markers when pickup locations change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !window.google.maps) return;
    
    // Clear existing markers
    clearMarkers();
    
    // Add new markers if pickup locations available
    if (pickupLocations && pickupLocations.length > 0) {
      addPickupMarkers(mapInstanceRef.current, window.google, pickupLocations);
    }
  }, [pickupLocations]);
  
  // Update selected marker when selected location changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !window.google.maps) return;
    
    // Update marker styles based on selection
    updateMarkerStyles(selectedLocation);
    
  }, [selectedLocation]);
  
  // Add a new effect to zoom to the selected zipcode when it changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !selectedZipcode) return;
    
    console.log('Selected zipcode changed to:', selectedZipcode);
    
    // Zoom to the selected zipcode
    zoomToZipcode(mapInstanceRef.current, window.google, polygonsRef.current, selectedZipcode);
    
    // Update the styling of polygons
    polygonsRef.current.forEach(item => {
      if (!item || !item.polygon) return;
      
      const isSelected = item.zipcode === selectedZipcode;
      
      // Apply selected styling
      item.polygon.setOptions({
        fillColor: isSelected ? '#4CAF50' : '#3388ff',
        fillOpacity: isSelected ? 0.6 : 0.2,
        strokeColor: isSelected ? '#388E3C' : '#3388ff',
        strokeWeight: isSelected ? 2 : 1
      });
    });
  }, [selectedZipcode]);
  
  // Function to clear all markers
  const clearMarkers = () => {
    const markers = markersRef.current;
    
    if (markers.length > 0) {
      markers.forEach(item => {
        if (!item) return;
        
        // Remove listeners first
        if (item.listeners) {
          item.listeners.forEach(listener => {
            if (listener && window.google && window.google.maps) {
              window.google.maps.event.removeListener(listener);
            }
          });
        }
        
        // Remove marker from map
        if (item.marker) {
          item.marker.setMap(null);
        }
      });
      
      // Clear the array
      markersRef.current = [];
    }
  };
  
  // Function to add pickup location markers
  const addPickupMarkers = (mapInstance, googleAPI, locations) => {
    if (!mapInstance || !googleAPI || !locations || !Array.isArray(locations)) return;
    
    try {
      const newMarkers = [];
      
      locations.forEach(location => {
        try {
          if (!location || !location.lat || !location.lng) return;
          
          const lat = parseFloat(location.lat);
          const lng = parseFloat(location.lng);
          
          if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return;
          
          const isSelected = selectedLocation && 
                           (selectedLocation.id === location.id || 
                           (selectedLocation.lat === location.lat && 
                            selectedLocation.lng === location.lng));
          
          const marker = new googleAPI.maps.Marker({
            position: { lat, lng },
            map: mapInstance,
            title: location.name || 'Pickup Location',
            animation: isSelected ? googleAPI.maps.Animation.BOUNCE : null,
            icon: {
              path: googleAPI.maps.SymbolPath.CIRCLE,
              scale: isSelected ? 12 : 8,
              fillColor: isSelected ? '#1d4ed8' : '#2563eb',
              fillOpacity: 0.9,
              strokeColor: 'white',
              strokeWeight: 2
            }
          });
          
          // Add click listener
          const clickListener = marker.addListener('click', () => {
            if (onLocationClick) {
              onLocationClick(location);
            }
          });
          
          newMarkers.push({
            marker,
            location,
            listeners: [clickListener]
          });
          
        } catch (err) {
          console.error('Error creating marker for location:', err);
        }
      });
      
      // Store markers in ref
      markersRef.current = newMarkers;
      
    } catch (err) {
      console.error('Error adding pickup markers:', err);
    }
  };
  
  // Function to update marker styles based on selection
  const updateMarkerStyles = (selectedLoc) => {
    if (!window.google || !window.google.maps) return;
    
    try {
      markersRef.current.forEach(item => {
        if (!item || !item.marker || !item.location) return;
        
        const isSelected = selectedLoc && 
                         (selectedLoc.id === item.location.id || 
                         (selectedLoc.lat === item.location.lat && 
                          selectedLoc.lng === item.location.lng));
        
        // Update animation
        item.marker.setAnimation(isSelected ? 
                               window.google.maps.Animation.BOUNCE : 
                               null);
        
        // Update icon
        item.marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 12 : 8,
          fillColor: isSelected ? '#1d4ed8' : '#2563eb',
          fillOpacity: 0.9,
          strokeColor: 'white',
          strokeWeight: 2
        });
      });
    } catch (err) {
      console.error('Error updating marker styles:', err);
    }
  };
  
  // Function to clear all polygons
  const clearPolygons = () => {
    const polygons = polygonsRef.current;
    
    if (polygons.length > 0) {
      polygons.forEach(item => {
        if (!item) return;
        
        // Remove listeners first
        if (item.listeners) {
          item.listeners.forEach(listener => {
            if (listener && window.google && window.google.maps) {
              window.google.maps.event.removeListener(listener);
            }
          });
        }
        
        // Remove polygon from map
        if (item.polygon) {
          item.polygon.setMap(null);
        }
        
        // Remove label from map
        if (item.label) {
          item.label.setMap(null);
        }
      });
      
      // Clear the array
      polygonsRef.current = [];
    }
  };
  
  // Function to create polygon for zipcode
  const createPolygonForZipcode = (mapInstance, googleAPI, zipcode, isSelected, coordinates, index) => {
    // Convert GeoJSON coordinates to Google Maps LatLng objects
    try {
      // GeoJSON coordinates are in [lng, lat] format, Google Maps needs [lat, lng]
      const paths = [];
      
      // For Polygon, coordinates is an array of arrays of coordinates (one for outer ring, rest for holes)
      coordinates.forEach(ring => {
        const path = [];
        ring.forEach(coord => {
          path.push({
            lat: coord[1], 
            lng: coord[0]
          });
        });
        paths.push(path);
      });
      
      // Use the first path as the outline, the rest are holes
      const polygonOptions = {
        paths,
        strokeColor: isSelected ? '#047857' : '#16a34a',
        strokeOpacity: isSelected ? 1.0 : 0.8,
        strokeWeight: isSelected ? 2 : 1,
        fillColor: isSelected ? '#10b981' : '#4ade80',
        fillOpacity: isSelected ? 0.3 : 0.2,
        map: mapInstance,
        zIndex: isSelected ? 2 : 1
      };
      
      // Create the polygon
      const polygon = new googleAPI.maps.Polygon(polygonOptions);
      
      // Create a label for the zipcode near its center
      const bounds = new googleAPI.maps.LatLngBounds();
      
      // Only use the first path (the outer ring) for centering
      paths[0].forEach(point => {
        bounds.extend(point);
      });
      
      const center = bounds.getCenter();
      
      // Create a marker for the zipcode label, but only show on hover or if selected
      const label = new googleAPI.maps.Marker({
        position: center,
        map: mapInstance,
        label: {
          text: zipcode,
          color: '#ffffff',
          fontSize: '10px',
          fontWeight: 'bold'
        },
        icon: {
          path: googleAPI.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#16a34a',
          fillOpacity: 0.7,
          strokeColor: '#ffffff',
          strokeWeight: 1,
        },
        opacity: isSelected ? 1 : 0, // Only show if selected initially
        zIndex: 3
      });
      
      // Add mouse events for interactive UI
      const listeners = [];
      
      // Mouse enter: show label, highlight polygon
      const mouseoverListener = polygon.addListener('mouseover', () => {
        polygon.setOptions({
          strokeWeight: 2,
          strokeColor: '#047857',
          fillOpacity: 0.3,
          zIndex: 2
        });
        
        // Show the label
        label.setOpacity(1);
      });
      
      // Mouse leave: hide label if not selected, reset polygon style
      const mouseoutListener = polygon.addListener('mouseout', () => {
        if (!isSelected) {
          polygon.setOptions({
            strokeWeight: 1,
            strokeColor: '#16a34a',
            fillOpacity: 0.2,
            zIndex: 1
          });
          
          // Hide the label if not selected
          label.setOpacity(0);
        }
      });
      
      listeners.push(mouseoverListener, mouseoutListener);
      
      // Return information about the created polygon
      return {
        polygon,
        label,
        zipcode,
        isSelected,
        listeners,
        center: center,
        polygonIndex: index
      };
    } catch (error) {
      console.error(`Error creating polygon for zipcode ${zipcode}:`, error);
      return null;
    }
  };
  
  // Function to zoom to a specific zipcode
  const zoomToZipcode = (mapInstance, googleAPI, polygons, zipcode) => {
    // Find all polygons with the given zipcode
    const matchingPolygons = polygons.filter(item => item && item.zipcode === zipcode);
    
    if (matchingPolygons.length > 0) {
      // Create bounds that encompass all matching polygons
      const bounds = new googleAPI.maps.LatLngBounds();
      
      // Add all polygon paths to the bounds
      matchingPolygons.forEach(item => {
        if (item.center) {
          bounds.extend(item.center);
        }
      });
      
      // Zoom the map to show all the matching polygons
      mapInstance.fitBounds(bounds);
      
      // Ensure we're not zoomed in too far
      const listener = googleAPI.maps.event.addListenerOnce(mapInstance, 'idle', () => {
        if (mapInstance.getZoom() > 14) {
          mapInstance.setZoom(14);
        }
      });
      
      return listener;
    }
    
    return null;
  };
  
  // Function to load zipcode data and create polygons
  const loadZipcodeData = async (mapInstance, googleAPI) => {
    if (!mapInstance || !googleAPI || !mountedRef.current) return;
    
    try {
      console.log("Fetching zipcode GeoJSON data...");
      
      // Clear any existing polygons
      clearPolygons();
      
      // Add cache-busting parameter to prevent browser caching
      const timestamp = new Date().getTime();
      
      // Fetch zipcode data with cache-busting
      const response = await fetch(`/api/zipcodes?_=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch zipcode data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // If component unmounted during fetch, abort
      if (!mountedRef.current) return;
      
      if (!data || !data.features || !Array.isArray(data.features)) {
        throw new Error("Invalid GeoJSON data structure");
      }
      
      console.log(`Received ${data.features.length} zipcode features from API`);
      
      // Process the GeoJSON data
      const newPolygons = [];
      let validFeatureCount = 0;
      
      // Keep track of which zipcodes we've processed
      const processedZipcodes = new Set();
      
      data.features.forEach(feature => {
        try {
          // Get zipcode from properties (handle different possible property names)
          // Ensure zipcode is a string for consistent comparison
          const zipcode = String(
            feature.properties.zipcode || 
            feature.properties.ZCTA5CE10 || 
            feature.properties.ZIP ||
            feature.properties.ZIPCODE || ''
          );
          
          // Skip if we've already processed this zipcode to prevent duplicates
          if (processedZipcodes.has(zipcode)) {
            console.log(`Skipping duplicate zipcode ${zipcode}`);
            return;
          }
          
          // Debug problematic zipcodes
          if (zipcode === '30288' || zipcode === '30294') {
            console.log(`Found zipcode ${zipcode} in map component!`);
          }
          
          if (!zipcode || !VALID_ZIP_CODES.includes(zipcode)) {
            return; // Skip invalid zipcodes
          }
          
          if (!feature.geometry) {
            console.error(`Invalid geometry for zipcode ${zipcode}`, feature);
            return;
          }
          
          // Mark zipcode as processed
          processedZipcodes.add(zipcode);
          
          const isSelected = selectedZipcode === zipcode;
          validFeatureCount++;
          
          // Handle different geometry types (Polygon or MultiPolygon)
          if (feature.geometry.type === 'Polygon') {
            const polygon = createPolygonForZipcode(mapInstance, googleAPI, zipcode, isSelected, feature.geometry.coordinates, 0);
            if (polygon) newPolygons.push(polygon);
          } 
          else if (feature.geometry.type === 'MultiPolygon') {
            // For MultiPolygon, we need to create multiple polygon objects
            feature.geometry.coordinates.forEach((polygonCoords, index) => {
              const polygon = createPolygonForZipcode(mapInstance, googleAPI, zipcode, isSelected, polygonCoords, index);
              if (polygon) newPolygons.push(polygon);
            });
          }
        } catch (err) {
          console.error(`Error processing zipcode feature:`, err);
        }
      });
      
      // Special check for our important zipcodes
      if (!processedZipcodes.has('30288')) {
        console.error('Zipcode 30288 is still missing after processing!');
      }
      if (!processedZipcodes.has('30294')) {
        console.error('Zipcode 30294 is still missing after processing!');
      }
      
      // Store the polygons in the ref to avoid re-renders
      polygonsRef.current = newPolygons;
      
      // If a zipcode is selected, zoom to it
      if (selectedZipcode) {
        zoomToZipcode(mapInstance, googleAPI, newPolygons, selectedZipcode);
      }
      
      console.log(`Created ${newPolygons.length} polygon objects from ${validFeatureCount} valid features`);
      console.log(`Processed zipcodes: ${[...processedZipcodes].join(', ')}`);
      
      // Update loading state
      if (mountedRef.current) {
        setLoading(false);
      }
      
    } catch (error) {
      console.error('Error loading zipcode data:', error);
      if (mountedRef.current) {
        setError(`Failed to load zipcode data: ${error.message}`);
        setLoading(false);
        // Don't set useStaticMap - let the map render even if the zipcode overlay fails
      }
    }
  };

  return (
    <div className="w-full h-full">
      {error && !useStaticMap && (
        <div className="text-red-500 text-sm mb-2">
          {error}
        </div>
      )}

      {useStaticMap ? (
        <div className="relative w-full" style={{ height }}>
          <Image
            src={`https://maps.googleapis.com/maps/api/staticmap?center=33.749,-84.388&zoom=10&size=600x400&maptype=roadmap&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&style=feature:poi|element:labels|visibility:off&style=feature:administrative|element:labels|visibility:off`}
            alt="Delivery Area Map"
            fill
            className="object-cover rounded-md"
            priority
          />
          <div className="absolute bottom-0 left-0 bg-white bg-opacity-80 p-2 text-sm rounded-tr-md">
            <p className="font-medium text-gray-800">Delivery Area</p>
          </div>
        </div>
      ) : (
        <div 
          ref={mapContainerRef} 
          className="w-full rounded-md overflow-hidden" 
          style={{ height }}
        />
      )}

      {loading && !useStaticMap && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
          <p>Loading delivery area map...</p>
        </div>
      )}
    </div>
  );
});

// Add a display name for better debugging
ZipcodeMap.displayName = 'ZipcodeMap';

export default ZipcodeMap; 