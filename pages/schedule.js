import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import Calendar from '../components/Calendar';
import DeliveryMap from '../components/DeliveryMap';
import { format } from 'date-fns';

export default function Schedule() {
  const [deliverySchedules, setDeliverySchedules] = useState([]);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // ZIP code validation states
  const [zipCode, setZipCode] = useState('');
  const [zipCodeValid, setZipCodeValid] = useState(false);
  const [zipCodeChecked, setZipCodeChecked] = useState(false);

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

  const parseCalendarDate = (value) => {
    if (value?._seconds) {
      return new Date(value._seconds * 1000);
    }

    if (typeof value === 'string') {
      const datePart = value.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [year, month, day] = datePart.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
      }
    }

    return new Date(value);
  };
  
  // Reference to the map component for zooming functionality
  const mapRef = useRef(null);

  // Add a function to check if a ZIP code is valid
  const checkZipCode = () => {
    if (zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
      setZipCodeValid(false);
      setZipCodeChecked(true);
      return;
    }
    
    const isValid = VALID_ZIP_CODES.includes(zipCode);
    setZipCodeValid(isValid);
    setZipCodeChecked(true);
  };

  // Handle ZIP code input change
  const handleZipCodeChange = (e) => {
    // Allow only numbers
    const value = e.target.value.replace(/\D/g, '');
    setZipCode(value);
    
    // Reset validation state when ZIP code changes
    if (zipCodeChecked) {
      setZipCodeChecked(false);
    }
  };

  // Fetch delivery schedules and pickup locations
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setLoading(true);
        console.log('Fetching schedule data...');
        
        // Fetch delivery schedules
        const schedulesResponse = await fetch('/api/delivery/schedules');
        if (!schedulesResponse.ok) {
          throw new Error('Failed to fetch delivery schedules');
        }
        const schedulesData = await schedulesResponse.json();
        console.log('Received delivery schedules:', schedulesData);
        
        // Fetch pickup locations
        const locationsResponse = await fetch('/api/pickup/locations');
        if (!locationsResponse.ok) {
          throw new Error('Failed to fetch pickup locations');
        }
        const locationsData = await locationsResponse.json();
        console.log('Received pickup locations:', locationsData);
        
        // Store the raw data
        setDeliverySchedules(schedulesData || []);
        setPickupLocations(locationsData.pickupLocations || []);
        
        // Transform data into unified events for the calendar
        const events = [];
        
        // Add delivery schedules as events
        if (schedulesData && Array.isArray(schedulesData)) {
          schedulesData.forEach(schedule => {
            const scheduleDate = parseCalendarDate(schedule.date);
              
            if (schedule.slots && Array.isArray(schedule.slots)) {
              schedule.slots.forEach(slot => {
                // Only add slots that are available
                if (slot.available && (!slot.maxOrders || slot.currentOrders < slot.maxOrders)) {
                  events.push({
                    id: `delivery-${schedule.id || Math.random().toString(36).substring(2)}-${slot.id || Math.random().toString(36).substring(2)}`,
                    type: 'delivery',
                    date: scheduleDate.toISOString(),
                    title: `Delivery (${slot.name || 'Standard'})`,
                    description: `Delivery window: ${slot.time || 'Standard hours'}`,
                    timeSlot: slot
                  });
                }
              });
            }
          });
        }
        
        // Add pickup locations as events
        if (locationsData.pickupLocations && Array.isArray(locationsData.pickupLocations)) {
          // Default location for Hearthfire Farm
          const HEARTHFIRE_DEFAULT = {
            id: 'hearthfire-farm',
            name: 'Hearthfire Farm',
            address: '363 W Hemphill Rd, Stockbridge, GA 30281',
            lat: 33.5446,
            lng: -84.2341
          };
          
          locationsData.pickupLocations.forEach(location => {
            try {
              const locationDate = parseCalendarDate(location.date);
              
              // Format location data consistently
              const locationCoords = {
                id: location.id || `pickup-${Math.random().toString(36).substring(2, 10)}`,
                name: location.name || location.summary || 'Hearthfire Farm',
                address: location.address || 'Address not provided'
              };
              
              // For Hearthfire-related events without coordinates, use default
              if ((location.name?.includes('Hearthfire') || location.summary?.includes('Hearthfire')) && 
                  (!location.latitude && !location.longitude && !location.lat && !location.lng)) {
                // Use default Hearthfire Farm coordinates
                locationCoords.lat = HEARTHFIRE_DEFAULT.lat;
                locationCoords.lng = HEARTHFIRE_DEFAULT.lng;
                // Also use the default address if none is provided
                if (!locationCoords.address || locationCoords.address === 'Address not provided') {
                  locationCoords.address = HEARTHFIRE_DEFAULT.address;
                }
              } else {
                // Try to use provided coordinates
                const lat = parseFloat(location.latitude || location.lat || 0);
                const lng = parseFloat(location.longitude || location.lng || 0);
                
                if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                  locationCoords.lat = lat;
                  locationCoords.lng = lng;
                } else {
                  // Still use the default, but log a warning
                  console.warn('Using default location for event without coordinates:', location.id);
                  locationCoords.lat = HEARTHFIRE_DEFAULT.lat;
                  locationCoords.lng = HEARTHFIRE_DEFAULT.lng;
                }
              }
                
              events.push({
                id: `pickup-${locationCoords.id}`,
                type: 'pickup',
                date: locationDate.toISOString(),
                title: `Pickup at ${locationCoords.name}`,
                description: location.time || `Pickup location: ${locationCoords.address}`,
                location: locationCoords
              });
            } catch (err) {
              console.error('Error processing pickup location:', err);
            }
          });
        }
        
        console.log(`Created ${events.length} events for calendar:`, events);
        setAllEvents(events);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load schedule data. Please try again later.');
        setLoading(false);
      }
    };

    fetchEventData();
  }, []);

  // Add console logging for debugging
  useEffect(() => {
    if (pickupLocations && pickupLocations.length > 0) {
      console.log('Pickup locations loaded:', pickupLocations.length);
      console.log('Sample location:', pickupLocations[0]);
    } else {
      console.log('No pickup locations loaded yet');
    }
  }, [pickupLocations]);

  // Handle calendar event click
  const handleEventClick = (event) => {
    console.log('Event clicked:', event);
    
    if (!event) {
      console.error('Attempted to handle click for undefined event');
      return;
    }
    
    try {
      // Validate essential properties to prevent errors in the dialog
      const validatedEvent = {
        ...event,
        id: event.id || `temp-${Math.random().toString(36).substring(2)}`,
        title: event.title || 'Event',
        type: event.type || 'unknown',
        date: event.date || new Date().toISOString()
      };
      
      // Make sure location has required properties for pickup events
      if (validatedEvent.type === 'pickup' && validatedEvent.location) {
        // Default location for Hearthfire Farm if needed
        const HEARTHFIRE_DEFAULT = {
          id: 'hearthfire-farm',
          name: 'Hearthfire Farm',
          address: '363 W Hemphill Rd, Stockbridge, GA 30281',
          lat: 33.5446,
          lng: -84.2341
        };
        
        // If it's a Hearthfire location without address, use the default
        const isHearthfire = validatedEvent.location.name?.includes('Hearthfire') || 
                            validatedEvent.title?.includes('Hearthfire');
        const missingAddress = !validatedEvent.location.address || 
                              validatedEvent.location.address === 'Address not provided';
        
        validatedEvent.location = {
          id: validatedEvent.location.id || `loc-${Math.random().toString(36).substring(2)}`,
          name: validatedEvent.location.name || 'Pickup Location',
          address: missingAddress && isHearthfire ? 
                  HEARTHFIRE_DEFAULT.address : 
                  (validatedEvent.location.address || 'Address not provided'),
          lat: parseFloat(validatedEvent.location.lat || 0),
          lng: parseFloat(validatedEvent.location.lng || 0)
        };
      }
      
      setSelectedEvent(validatedEvent);
      
      if (validatedEvent.type === 'pickup' && validatedEvent.location) {
        // Only set selectedLocation if it has valid coordinates
        const lat = parseFloat(validatedEvent.location.lat);
        const lng = parseFloat(validatedEvent.location.lng);
        
        if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
          setSelectedLocation(validatedEvent.location);
          
          // Zoom to the location on the map using the ref
          if (mapRef.current && typeof mapRef.current.zoomToLocation === 'function') {
            mapRef.current.zoomToLocation({
              lat: lat,
              lng: lng
            });
          }
        } else {
          console.warn('Invalid coordinates in location, not highlighting on map:', validatedEvent.location);
        }
      } else if (validatedEvent.type === 'delivery') {
        // Don't clear selected location for delivery events either
      }
      
      setIsDialogOpen(true);
    } catch (err) {
      console.error('Error processing event click:', err);
      // Still show dialog with error message instead of crashing
      setSelectedEvent({
        id: 'error',
        title: 'Error',
        description: 'Could not load event details. Please try again.',
        date: new Date().toISOString()
      });
      setSelectedLocation(null);
      setIsDialogOpen(true);
    }
  };

  // Handle map location click
  const handleLocationClick = (location) => {
    console.log('Location clicked:', location);
    
    if (!location) {
      console.error('Attempted to handle click for undefined location');
      return;
    }
    
    try {
      // Default location for Hearthfire Farm
      const HEARTHFIRE_DEFAULT = {
        id: 'hearthfire-farm',
        name: 'Hearthfire Farm',
        address: '363 W Hemphill Rd, Stockbridge, GA 30281',
        lat: 33.5446,
        lng: -84.2341
      };
      
      // Check if this is a Hearthfire location
      const isHearthfire = location.name?.includes('Hearthfire');
      const missingAddress = !location.address || location.address === 'Address not provided';
      
      // Validate the location object to ensure it has necessary properties
      const validatedLocation = {
        id: location.id || `loc-${Math.random().toString(36).substring(2)}`,
        name: location.name || 'Pickup Location',
        address: isHearthfire && missingAddress ? 
                 HEARTHFIRE_DEFAULT.address : 
                 (location.address || 'Address not provided'),
        lat: parseFloat(location.lat || 0),
        lng: parseFloat(location.lng || 0)
      };
      
      setSelectedLocation(validatedLocation);
      
      // Find all events at this location
      const locationEvents = allEvents.filter(event => 
        event.type === 'pickup' && 
        event.location?.id === validatedLocation.id
      );
      
      if (locationEvents.length > 0) {
        // Create a validated event object
        const bestEvent = locationEvents[0];
        const validatedEvent = {
          ...bestEvent,
          id: bestEvent.id || `temp-${Math.random().toString(36).substring(2)}`,
          title: bestEvent.title || `Pickup at ${validatedLocation.name}`,
          type: 'pickup',
          date: bestEvent.date || new Date().toISOString(),
          location: {
            ...validatedLocation,
            // Ensure the address is properly set
            address: isHearthfire && missingAddress ? 
                     HEARTHFIRE_DEFAULT.address : 
                     (validatedLocation.address || 'Address not provided')
          }
        };
        
        setSelectedEvent(validatedEvent);
        setIsDialogOpen(true);
      } else {
        // Create a generic event for this location
        const genericEvent = {
          id: `pickup-${validatedLocation.id}`,
          title: `Pickup at ${validatedLocation.name}`,
          type: 'pickup',
          date: new Date().toISOString(),
          description: `Pickup location: ${validatedLocation.address}`,
          location: {
            ...validatedLocation,
            // Ensure the address is properly set
            address: isHearthfire && missingAddress ? 
                     HEARTHFIRE_DEFAULT.address : 
                     (validatedLocation.address || 'Address not provided')
          }
        };
        
        setSelectedEvent(genericEvent);
        setIsDialogOpen(true);
      }
    } catch (err) {
      console.error('Error processing location click:', err);
      // Show error dialog
      setSelectedEvent({
        id: 'error',
        title: 'Error',
        description: 'Could not load location details. Please try again.',
        date: new Date().toISOString()
      });
      setIsDialogOpen(true);
    }
  };

  // Function to check if a location is zoomable on the map
  const isLocationZoomable = (location) => {
    return location && 
           location.lat && 
           location.lng && 
           typeof location.lat === 'number' && 
           typeof location.lng === 'number' && 
           !isNaN(location.lat) && 
           !isNaN(location.lng);
  };

  // Ensure mapLocations is correctly populated
  const getMapLocations = () => {
    if (!pickupLocations || pickupLocations.length === 0) {
      // If no pickup locations, return at least one default location
      console.log('Using default Hearthfire Farm location');
      return [
        {
          id: 'hearthfire-farm',
          name: 'Hearthfire Farm',
          address: '363 W Hemphill Rd, Stockbridge, GA 30281',
          lat: 33.5446,
          lng: -84.2341
        }
      ];
    }
    
    // Filter out any invalid locations without coordinates
    const validLocations = pickupLocations.filter(
      loc => loc && loc.lat && loc.lng && !isNaN(parseFloat(loc.lat)) && !isNaN(parseFloat(loc.lng))
    );
    
    console.log(`Found ${validLocations.length} valid pickup locations out of ${pickupLocations.length} total`);
    
    if (validLocations.length === 0) {
      // Fallback if all are invalid
      return [
        {
          id: 'hearthfire-farm',
          name: 'Hearthfire Farm',
          address: '363 W Hemphill Rd, Stockbridge, GA 30281',
          lat: 33.5446,
          lng: -84.2341
        }
      ];
    }
    
    return validLocations;
  };

  // Map locations data generated from events
  const mapLocations = useMemo(() => getMapLocations(), [allEvents]);
  
  // Memoize events by day to avoid recalculation
  const eventsByDay = useMemo(() => {
    const days = {};
    allEvents.forEach(event => {
      const date = new Date(event.date);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!days[dayKey]) {
        days[dayKey] = [];
      }
      days[dayKey].push(event);
    });
    return days;
  }, [allEvents]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4"></div>
        <p className="text-green-700 font-medium">Loading Schedule Information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-red-50 text-red-600 p-6 rounded-lg shadow-sm max-w-md">
          <h2 className="text-xl font-bold mb-3">Unable to Load Schedule</h2>
          <p className="mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Delivery Schedule - Hearthfire Farm</title>
        <meta name="description" content="View our delivery schedule and pickup locations. Find out when we deliver to your area." />
      </Head>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-green-700 mb-4">
            Delivery Schedule & Pickup Locations
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            See when we deliver to your area and find convenient pickup locations.
            Enter your ZIP code to check if we deliver to your address.
          </p>
        </div>
        
        {/* ZIP code checker */}
        <div className="max-w-md mx-auto bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Check Your Delivery ZIP Code</h2>
          <div className="flex space-x-2">
            <input
              type="text"
              value={zipCode}
              onChange={handleZipCodeChange}
              maxLength={5}
              placeholder="Enter ZIP code"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={checkZipCode}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Check
            </button>
          </div>
          
          {zipCodeChecked && (
            <div className={`mt-4 p-3 rounded-md ${zipCodeValid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {zipCodeValid ? (
                <>
                  <span className="font-medium">Good news!</span> We deliver to your area.
                  Please check our calendar below for available dates.
                </>
              ) : (
                <>
                  <span className="font-medium">We're sorry,</span> we don't currently 
                  deliver to your area. Please check our pickup locations below.
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Calendar and Map Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white shadow-md rounded-lg p-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Delivery Calendar</h2>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
              </div>
            ) : (
              <Calendar 
                events={allEvents} 
                onEventClick={handleEventClick} 
                onDayClick={() => setSelectedEvent(null)}
                groupedEvents={eventsByDay}
              />
            )}
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Pickup Locations</h2>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
              </div>
            ) : (
              <div className="h-96">
                <DeliveryMap 
                  locations={mapLocations} 
                  ref={mapRef} 
                  onLocationClick={handleLocationClick}
                  selectedLocation={selectedLocation}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Details Section */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Delivery & Pickup Details</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-green-700">Delivery Information</h3>
              <p className="text-gray-600 mt-2">
                We deliver to select ZIP codes in the Atlanta metro area. Delivery days 
                are typically Thursdays and Fridays, with specific time slots available 
                for each area. Enter your ZIP code above to check availability, then select
                an available day on the calendar to schedule your delivery.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-green-700">Pickup Options</h3>
              <p className="text-gray-600 mt-2">
                If delivery is not available in your area, or you prefer to pick up your 
                order, we offer several pickup locations. Our main pickup location is at
                Hearthfire Farm in Stockbridge. We also participate in local farmers 
                markets and have partnered with community centers for additional pickup points.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-green-700">Ordering Deadlines</h3>
              <p className="text-gray-600 mt-2">
                To ensure the freshest possible produce, please place your order at least 
                48 hours before your preferred delivery or pickup date. This allows us time
                to harvest and prepare your items at their peak freshness.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Event Details Dialog */}
      {isDialogOpen && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full mx-4 md:mx-auto overflow-hidden">
            <div className="px-6 py-4 bg-green-600">
              <h3 className="text-lg font-medium text-white flex justify-between">
                <span>{selectedEvent.title}</span>
                <button 
                  onClick={() => setIsDialogOpen(false)}
                  className="text-white hover:text-gray-200"
                >
                  ×
                </button>
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-500">
                  {format(new Date(selectedEvent.date), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-gray-700 mt-1">
                  {selectedEvent.description}
                </p>
              </div>
              
              {selectedEvent.type === 'pickup' && selectedEvent.location && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-1">Location</h4>
                  <p className="text-gray-700">{selectedEvent.location.name}</p>
                  <p className="text-gray-600 text-sm">{selectedEvent.location.address}</p>
                  
                  {isLocationZoomable(selectedEvent.location) && (
                    <button
                      onClick={() => {
                        if (mapRef.current) {
                          mapRef.current.zoomToLocation(selectedEvent.location);
                          setSelectedLocation(selectedEvent.location);
                        }
                        setIsDialogOpen(false);
                      }}
                      className="mt-2 text-green-600 text-sm hover:text-green-800 focus:outline-none"
                    >
                      Show on map
                    </button>
                  )}
                </div>
              )}
              
              {selectedEvent.type === 'delivery' && selectedEvent.timeSlot && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-1">Delivery Details</h4>
                  <p className="text-gray-700">
                    Window: {selectedEvent.timeSlot.time || 'Standard delivery hours'}
                  </p>
                  {selectedEvent.timeSlot.notes && (
                    <p className="text-gray-600 text-sm mt-1">
                      {selectedEvent.timeSlot.notes}
                    </p>
                  )}
                </div>
              )}
              
              <div className="mt-6">
                <a
                  href={`/products?scheduleId=${selectedEvent.id}`}
                  className="inline-block w-full bg-green-600 text-white px-4 py-2 rounded-md text-center hover:bg-green-700"
                >
                  Order for this {selectedEvent.type === 'pickup' ? 'pickup' : 'delivery'}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
