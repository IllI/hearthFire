import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import dynamic from 'next/dynamic';

// Import the existing ZipcodeMap component with no SSR
const ZipcodeMap = dynamic(() => import('./ZipcodeMap'), { ssr: false });

/**
 * DeliveryMap component that reuses the ZipcodeMap component
 * Now using forwardRef to expose methods to parent components
 */
const DeliveryMap = forwardRef(function DeliveryMap(props, ref) {
  const { pickupLocations = [], selectedLocation, onLocationClick, height = "400px" } = props;
  
  // Map instance reference to access the ZipcodeMap methods
  const zipcodeMapRef = useRef();
  
  // Expose methods to parent components through the ref
  useImperativeHandle(ref, () => ({
    // Method to zoom to a specific location
    zoomToLocation: (location) => {
      if (zipcodeMapRef.current && typeof zipcodeMapRef.current.zoomToLocation === 'function') {
        zipcodeMapRef.current.zoomToLocation(location);
      }
    }
  }));

  return (
    <div className="w-full h-full" style={{ height }}>
      <ZipcodeMap 
        ref={zipcodeMapRef}
        height="100%"
        pickupLocations={pickupLocations}
        selectedLocation={selectedLocation}
        onLocationClick={onLocationClick}
      />
    </div>
  );
});

// Add a display name for better debugging
DeliveryMap.displayName = 'DeliveryMap';

export default DeliveryMap;