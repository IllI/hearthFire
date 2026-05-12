import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// Valid zipcodes - these should match the ones in ZipcodeMap.js
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

// Helper function to format dates for display
const formatDate = (date) => {
  if (!date) return 'Date not available';
  
  // If it's already a string, try to parse it
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  // Format the date as "Day of week, Month Day, Year"
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

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

const OrderLocationMap = ({ 
  mode = 'delivery', // 'delivery' or 'pickup'
  selectedZipcode, 
  pickupLocations = [],
  selectedPickupLocation,
  onPickupLocationSelect,
  height = '400px' 
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonsRef = useRef([]);
  const markersRef = useRef([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const mountedRef = useRef(true);

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
    if (!mapContainerRef.current) return;
    
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
          zoom: 11.5,
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
        
        if (mode === 'delivery') {
          // Load zipcode data for delivery mode
          await loadZipcodeData(mapInstance, googleAPI);
        } else {
          // Load pickup locations for pickup mode
          loadPickupLocations(mapInstance, googleAPI, pickupLocations);
        }
      } catch (err) {
        console.error('Error initializing map:', err);
        if (mountedRef.current) {
          setError(`Error initializing map: ${err.message}`);
          setLoading(false);
        }
      }
    };
    
    initMap();
    
    // Cleanup function
    return () => {
      // Clear any polygons and markers
      clearPolygons();
      clearMarkers();
      
      // Do not explicitly clear the map instance 
      // Let Google Maps handle its own cleanup
      mapInstanceRef.current = null;
    };
  }, [mode, pickupLocations]);
  
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
  
  // Function to clear all markers
  const clearMarkers = () => {
    const markers = markersRef.current;
    
    if (markers.length > 0) {
      markers.forEach(item => {
        if (!item) return;
        
        // Remove listeners
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
        
        // Close info window
        if (item.infoWindow) {
          item.infoWindow.close();
        }
      });
      
      // Clear the array
      markersRef.current = [];
    }
  };
  
  // Function to load zipcode data and create polygons
  const loadZipcodeData = async (mapInstance, googleAPI) => {
    if (!mapInstance || !googleAPI || !mountedRef.current) return;
    
    try {
      console.log("Fetching zipcode GeoJSON data...");
      
      // Clear any existing polygons
      clearPolygons();
      
      // Fetch zipcode data
      const response = await fetch('/api/zipcodes');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch zipcode data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // If component unmounted during fetch, abort
      if (!mountedRef.current) return;
      
      if (!data || !data.features || !Array.isArray(data.features)) {
        throw new Error("Invalid GeoJSON data structure");
      }
      
      console.log(`Processing ${data.features.length} zipcode features`);
      
      // Process the GeoJSON data
      const newPolygons = [];
      let validFeatureCount = 0;
      
      data.features.forEach(feature => {
        try {
          // Get zipcode from properties (handle different possible property names)
          const zipcode = feature.properties.zipcode || 
                        feature.properties.ZCTA5CE10 || 
                        feature.properties.ZIP ||
                        feature.properties.ZIPCODE;
          
          if (!zipcode || !VALID_ZIP_CODES.includes(zipcode)) {
            return; // Skip invalid zipcodes
          }
          
          if (!feature.geometry) {
            console.error(`Invalid geometry for zipcode ${zipcode}`, feature);
            return;
          }
          
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
      
      console.log(`Created ${newPolygons.length} polygon objects from ${validFeatureCount} valid features`);
      
      // Store the polygons in the ref to avoid re-renders
      polygonsRef.current = newPolygons;
      
      // If we didn't create any polygons, something is wrong with the data
      if (newPolygons.length === 0) {
        throw new Error("No valid zipcode polygons could be created. Please check your delivery area data.");
      }
      
      // If a zipcode is selected, zoom to it
      if (selectedZipcode) {
        zoomToZipcode(mapInstance, googleAPI, newPolygons, selectedZipcode);
      }
      
      // Update loading state
      if (mountedRef.current) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading zipcode data:', error);
      if (mountedRef.current) {
        setError(`Failed to load zipcode data: ${error.message}`);
        setLoading(false);
      }
    }
  };
  
  // Function to load pickup locations and create markers
  const loadPickupLocations = (mapInstance, googleAPI, locations) => {
    if (!mapInstance || !googleAPI || !locations || !Array.isArray(locations)) {
      console.warn("Invalid parameters for loadPickupLocations");
      setLoading(false);
      return;
    }
    
    // Clear existing markers
    clearMarkers();
    
    try {
      console.log(`Processing ${locations.length} pickup locations`);
      
      const newMarkers = [];
      const bounds = new googleAPI.maps.LatLngBounds();
      
      locations.forEach(location => {
        if (!location || !location.location || !location.location.coordinates) {
          console.warn('Skipping invalid pickup location', location);
          return;
        }
        
        const { lat, lng } = location.location.coordinates;
        const isSelected = selectedPickupLocation === location.id;
        
        // Create marker
        const marker = new googleAPI.maps.Marker({
          position: { lat, lng },
          map: mapInstance,
          title: location.title,
          animation: isSelected ? googleAPI.maps.Animation.BOUNCE : null,
          icon: {
            path: googleAPI.maps.SymbolPath.CIRCLE,
            fillColor: isSelected ? '#4CAF50' : '#FF9800',
            fillOpacity: 0.9,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 10
          }
        });
        
        // Create info window with location details
        const infoWindow = new googleAPI.maps.InfoWindow({
          content: `
            <div class="pickup-info p-2">
              <h3 class="text-lg font-bold mb-1">${location.title || 'Pickup Location'}</h3>
              <p class="text-sm mb-1">${location.location.address || 'No address provided'}</p>
              <p class="text-sm font-medium">${formatDate(location.date)}</p>
              <p class="text-sm">${location.startTime || ''} ${location.endTime ? '- ' + location.endTime : ''}</p>
              ${location.instructions && location.instructions !== 'No special instructions' 
                ? `<p class="text-sm italic mt-1">${location.instructions}</p>` 
                : ''}
            </div>
          `
        });
        
        // Add click listener
        const clickListener = marker.addListener('click', () => {
          // Close all other info windows
          newMarkers.forEach(m => {
            if (m.infoWindow) m.infoWindow.close();
          });
          
          // Open this info window
          infoWindow.open(mapInstance, marker);
          
          // Call the selection callback
          if (onPickupLocationSelect) {
            onPickupLocationSelect(location.id);
          }
        });
        
        // Add the marker to our tracking array
        newMarkers.push({
          marker,
          infoWindow,
          locationId: location.id,
          listeners: [clickListener]
        });
        
        // Extend bounds to include this location
        bounds.extend({ lat, lng });
      });
      
      // Store the markers
      markersRef.current = newMarkers;
      
      // If we have markers, fit the map to show all of them
      if (newMarkers.length > 0) {
        mapInstance.fitBounds(bounds, 50); // 50px padding
        
        // Prevent excessive zoom when only one marker
        const zoomListener = googleAPI.maps.event.addListenerOnce(mapInstance, 'idle', () => {
          if (mapInstance.getZoom() > 15) {
            mapInstance.setZoom(15);
          }
        });
      }
      
      // If a specific location is selected, center on it
      if (selectedPickupLocation) {
        const selectedMarker = newMarkers.find(m => m.locationId === selectedPickupLocation);
        if (selectedMarker && selectedMarker.marker) {
          mapInstance.setCenter(selectedMarker.marker.getPosition());
          mapInstance.setZoom(14);
          
          // Open the info window
          selectedMarker.infoWindow.open(mapInstance, selectedMarker.marker);
        }
      }
      
      // Update loading state
      setLoading(false);
    } catch (error) {
      console.error('Error loading pickup locations:', error);
      setError(`Failed to load pickup locations: ${error.message}`);
      setLoading(false);
    }
  };
  
  // Function to create a polygon for a zipcode - reused from ZipcodeMap component
  const createPolygonForZipcode = (map, googleAPI, zipcode, isSelected, coordinates, partIndex = 0) => {
    if (!map || !googleAPI || !coordinates) return null;
    
    // Validate the coordinates structure
    if (!coordinates || !Array.isArray(coordinates)) {
      console.error(`Invalid coordinates for zipcode ${zipcode}`, coordinates);
      return null;
    }
    
    try {
      // Create paths for the outer ring and any inner rings (holes)
      const polygonPaths = [];
      
      // Process each ring of coordinates (outer ring + any inner rings/holes)
      for (let ringIndex = 0; ringIndex < coordinates.length; ringIndex++) {
        const ring = coordinates[ringIndex];
        
        if (!Array.isArray(ring) || ring.length < 3) {
          console.warn(`Skipping invalid ring for zipcode ${zipcode} (ringIndex: ${ringIndex})`);
          continue;
        }
        
        // Convert GeoJSON coordinates to Google Maps LatLng objects
        // GeoJSON uses [longitude, latitude] format
        // Google Maps uses {lat: latitude, lng: longitude} format
        const path = ring.map(coord => {
          if (Array.isArray(coord) && coord.length >= 2) {
            return { lat: coord[1], lng: coord[0] };
          } else {
            console.warn(`Invalid coordinate in zipcode ${zipcode}:`, coord);
            return null;
          }
        }).filter(coord => coord !== null);
        
        if (path.length < 3) {
          console.warn(`Skipping ring with insufficient points for zipcode ${zipcode} (ringIndex: ${ringIndex})`);
          continue;
        }
        
        polygonPaths.push(path);
      }
      
      if (polygonPaths.length === 0) {
        console.warn(`No valid polygon paths for zipcode ${zipcode}`);
        return null;
      }
      
      // Create the polygon with the paths
      const polygon = new googleAPI.maps.Polygon({
        paths: polygonPaths,
        strokeColor: isSelected ? '#4CAF50' : '#FF9800',
        strokeOpacity: 1.0,
        strokeWeight: isSelected ? 3 : 2,
        fillColor: isSelected ? '#4CAF50' : '#FF9800',
        fillOpacity: isSelected ? 0.4 : 0.25,
        map: map,
        zIndex: isSelected ? 2 : 1
      });
      
      // Add click listener for the polygon
      const clickListener = polygon.addListener('click', () => {
        // We'd handle zipcode selection here if needed
        console.log(`Clicked on zipcode ${zipcode}`);
      });
      
      // Add a label for the zipcode
      const bounds = new googleAPI.maps.LatLngBounds();
      
      // Calculate center for label
      polygonPaths[0].forEach(point => {
        bounds.extend(point);
      });
      
      const center = bounds.getCenter();
      
      // Create a marker for the label
      const label = new googleAPI.maps.Marker({
        position: center,
        map: map,
        label: {
          text: zipcode,
          color: isSelected ? '#FFFFFF' : '#000000',
          fontSize: '10px',
          fontWeight: isSelected ? 'bold' : 'normal'
        },
        icon: {
          path: googleAPI.maps.SymbolPath.CIRCLE,
          fillColor: isSelected ? '#4CAF50' : 'transparent',
          fillOpacity: isSelected ? 0.7 : 0,
          strokeWeight: 0,
          scale: 0 // Make the icon invisible, we just want the label
        },
        clickable: false,
        zIndex: isSelected ? 3 : 1
      });
      
      // Return the polygon, label, and zipcode info
      return {
        polygon,
        label,
        zipcode,
        partIndex,
        listeners: [clickListener]
      };
    } catch (error) {
      console.error(`Error creating polygon for zipcode ${zipcode}:`, error);
      return null;
    }
  };
  
  // Function to zoom to a selected zipcode
  const zoomToZipcode = (map, googleAPI, polygons, zipcode) => {
    if (!map || !googleAPI || !zipcode) return;
    
    // Find all parts of the selected zipcode
    const selectedParts = polygons.filter(p => p && p.zipcode === zipcode);
    
    if (selectedParts.length > 0) {
      const bounds = new googleAPI.maps.LatLngBounds();
      
      // Add all points from all parts to the bounds
      selectedParts.forEach(part => {
        if (part && part.polygon) {
          part.polygon.getPath().forEach(latLng => {
            bounds.extend(latLng);
          });
        }
      });
      
      // Add more padding around the selected zipcode (increased from 50 to 80)
      map.fitBounds(bounds, 80); // 80 pixels padding
      
      // Set a default minimum zoom level to ensure we're not too zoomed out
      const listener = map.addListener('bounds_changed', () => {
        // Ensure we're not zoomed too far out by setting minimum zoom of 12
        if (map.getZoom() < 12) {
          map.setZoom(12);
        }
        // Set a maximum zoom to avoid getting too close
        else if (map.getZoom() > 14) {
          map.setZoom(14);
        }
        googleAPI.maps.event.removeListener(listener);
      });
    }
  };
  
  // Update when selected zipcode changes
  useEffect(() => {
    if (mode !== 'delivery') return;
    
    const mapInstance = mapInstanceRef.current;
    const polygons = polygonsRef.current;
    
    if (!mapInstance || !window.google || !window.google.maps || polygons.length === 0) {
      return;
    }
    
    // Update styling for all polygons
    polygons.forEach(item => {
      if (item && item.polygon) {
        const isSelected = selectedZipcode === item.zipcode;
        item.polygon.setOptions({
          strokeColor: isSelected ? '#4CAF50' : '#FF9800',
          fillColor: isSelected ? '#4CAF50' : '#FF9800',
          fillOpacity: isSelected ? 0.4 : 0.25,
          strokeWeight: isSelected ? 3 : 2,
        });
        
        // Update label styling
        if (item.label) {
          item.label.setLabel({
            ...item.label.getLabel(),
            color: isSelected ? '#FFFFFF' : '#000000',
            fontWeight: isSelected ? 'bold' : 'normal'
          });
          
          // Update label background
          item.label.setIcon({
            ...item.label.getIcon(),
            fillColor: isSelected ? '#4CAF50' : 'transparent',
            fillOpacity: isSelected ? 0.7 : 0
          });
        }
      }
    });
    
    // If a zipcode is selected, zoom to it
    if (selectedZipcode) {
      zoomToZipcode(mapInstance, window.google, polygons, selectedZipcode);
    }
  }, [selectedZipcode, mode]);
  
  // Update when selected pickup location changes
  useEffect(() => {
    if (mode !== 'pickup') return;
    
    const mapInstance = mapInstanceRef.current;
    const markers = markersRef.current;
    
    if (!mapInstance || !window.google || !window.google.maps || markers.length === 0) {
      return;
    }
    
    // Update styling for all markers
    markers.forEach(item => {
      if (item && item.marker) {
        const isSelected = selectedPickupLocation === item.locationId;
        
        // Update marker appearance
        item.marker.setAnimation(isSelected ? window.google.maps.Animation.BOUNCE : null);
        item.marker.setIcon({
          ...item.marker.getIcon(),
          fillColor: isSelected ? '#4CAF50' : '#FF9800'
        });
        
        // Show info window for selected location
        if (isSelected) {
          item.infoWindow.open(mapInstance, item.marker);
          
          // Center map on selected location
          mapInstance.setCenter(item.marker.getPosition());
          mapInstance.setZoom(14);
        } else {
          item.infoWindow.close();
        }
      }
    });
  }, [selectedPickupLocation, mode]);
  
  return (
    <div className="order-location-map-container">
      <div 
        ref={mapContainerRef} 
        className="order-location-map" 
        style={{ 
          height: height, 
          width: '100%', 
          borderRadius: '8px',
          position: 'relative'
        }}
      >
        {/* Map will be rendered inside this container */}
      </div>
      
      {loading && (
        <div className="map-loader">
          <div className="spinner"></div>
          <p>Loading {mode === 'delivery' ? 'delivery area' : 'pickup locations'} map...</p>
        </div>
      )}
      
      {error && (
        <div className="map-error">
          <p>Sorry, we couldn't load the map.</p>
          <p className="error-details">
            {error.includes('Failed to fetch') || error.includes('503') ? 
              "Our map service is temporarily unavailable. Please check that you don't have extensions blocking API requests." : 
              error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-retry"
          >
            Retry
          </button>
        </div>
      )}
      
      {mode === 'pickup' && !loading && !error && (
        <div className="text-xs text-center mt-2 text-gray-600">
          Click on a pin to see pickup location details
        </div>
      )}
    </div>
  );
};

export default OrderLocationMap; 