import React, { useState, useEffect } from 'react';

/**
 * Component to display a list of pickup locations
 * @param {Array} locations Array of pickup location objects
 * @param {string} selectedLocation ID of the currently selected location
 * @param {Function} onLocationSelect Callback function when a location is selected
 * @param {string} selectedDate Currently selected date (ISO string)
 * @param {Function} onDateSelect Callback function when a date is selected
 */
const PickupLocationsList = ({ 
  locations = [], 
  selectedLocation, 
  onLocationSelect,
  selectedDate,
  onDateSelect
}) => {
  const [groupedLocations, setGroupedLocations] = useState({});
  const [availableDates, setAvailableDates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // When locations change, group them by date for easy access
  useEffect(() => {
    if (!locations || locations.length === 0) return;
    
    setIsLoading(true);
    
    try {
      console.log(`PickupLocationsList: Processing ${locations.length} pickup locations`);
      
      // Group locations by date
      const grouped = {};
      const dates = new Set();
      
      for (const location of locations) {
        if (!location.date) continue;
        
        let dateStr;
        try {
          if (typeof location.date === 'string') {
            dateStr = location.date.split('T')[0];
          } else if (location.date instanceof Date) {
            dateStr = location.date.toISOString().split('T')[0];
          } else {
            const dateObj = new Date(location.date);
            dateStr = dateObj.toISOString().split('T')[0];
          }
        } catch (error) {
          console.error('Error formatting date:', error);
          continue;
        }
        
        dates.add(dateStr);
        
        if (!grouped[dateStr]) {
          grouped[dateStr] = [];
        }
        
        grouped[dateStr].push(location);
      }
      
      console.log('PickupLocationsList: Available dates:', [...dates]);
      setGroupedLocations(grouped);
      
      // Sort dates chronologically
      let sortedDates = [...dates].sort();
      console.log(`PickupLocationsList: Final dates for dropdown:`, sortedDates);
      setAvailableDates(sortedDates);
      
      // Auto-select first date if no date is currently selected
      if (!selectedDate && sortedDates.length > 0) {
        console.log(`Auto-selecting first available date: ${sortedDates[0]}`);
        onDateSelect(sortedDates[0]);
      } else if (selectedDate && !dates.has(selectedDate)) {
        // If currently selected date is no longer valid, select first available
        if (sortedDates.length > 0) {
          console.log(`Selected date ${selectedDate} no longer valid, selecting: ${sortedDates[0]}`);
          onDateSelect(sortedDates[0]);
        }
      }
      
    } catch (error) {
      console.error('PickupLocationsList: Error processing pickup locations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [locations, onDateSelect, selectedDate]);
  
  // Format date for display (e.g., "Wednesday, April 3, 2024")
  const formatDate = (dateStr) => {
    try {
      // Parse the date properly to avoid timezone issues
      // First ensure we have a clean YYYY-MM-DD format
      const cleanDateStr = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
      
      console.log(`Debugging date display - Original input:`, dateStr);
      console.log(`Debugging date display - Cleaned date string:`, cleanDateStr);
      
      // Split the date components
      const [year, month, day] = cleanDateStr.split('-').map(Number);
      console.log(`Debugging date display - Date components:`, { year, month, day });
      
      // Create a date with the UTC components, then format it
      // This avoids timezone shifting issues
      const date = new Date(Date.UTC(year, month - 1, day));
      
      console.log(`Formatting date: ${cleanDateStr} -> UTC created as: ${date.toISOString()}`);
      
      // Format the date using explicit year, month, day to avoid timezone conversions
      const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const formattedDate = `${weekday}, ${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
      
      console.log(`Debugging date display - Final formatted date:`, formattedDate);
      
      return formattedDate;
    } catch (error) {
      console.error('Error formatting date:', error, 'input was:', dateStr);
      return dateStr;
    }
  };
  
  // Handle date selection
  const handleDateChange = (e) => {
    const newDate = e.target.value;
    console.log(`Date selected from dropdown: ${newDate}`);
    onDateSelect(newDate);
  };
  
  // Handle location selection
  const handleLocationSelect = (locationId) => {
    console.log(`Location selected: ${locationId}`);
    onLocationSelect(locationId);
  };
  
  if (isLoading) {
    return (
      <div className="pickup-locations-list p-4 bg-gray-50 rounded-md">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!locations || locations.length === 0) {
    return (
      <div className="pickup-locations-list p-4 bg-gray-50 rounded-md">
        <p className="text-center text-gray-500">No pickup locations available.</p>
      </div>
    );
  }
  
  return (
    <div className="pickup-locations-list">
      <h3 className="text-lg font-medium mb-4">Select Pickup Location & Time</h3>
      
      {/* Date selector - DYNAMIC APPROACH */}
      <div className="mb-4">
        <label htmlFor="pickup-date" className="block text-sm font-medium text-gray-700 mb-1">
          Pickup Date
        </label>
        <select 
          id="pickup-date"
          value={selectedDate || ''}
          onChange={handleDateChange}
          className="w-full p-2 border rounded-md bg-white"
        >
          <option value="">Select a date</option>
          {availableDates.map(date => (
            <option key={date} value={date}>
              {formatDate(date)} - Pickup Availability
            </option>
          ))}
        </select>
      </div>
      
      {/* Locations for selected date */}
      {selectedDate && groupedLocations[selectedDate] && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Available Pickup Locations
          </label>
          
          {groupedLocations[selectedDate].map(location => (
            <div 
              key={location.id}
              className={`
                p-3 border rounded-md cursor-pointer transition-colors
                ${selectedLocation === location.id 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-300 hover:border-green-400 hover:bg-green-50/50'}
              `}
              onClick={() => handleLocationSelect(location.id)}
            >
              <h4 className="font-medium text-gray-900">{location.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{location.location.address}</p>
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm font-medium text-green-600">
                  {location.startTime} - {location.endTime}
                </p>
                {selectedLocation === location.id && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Selected
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {selectedDate && (!groupedLocations[selectedDate] || groupedLocations[selectedDate].length === 0) && (
        <p className="text-center text-amber-600 p-3 bg-amber-50 rounded-md">
          No pickup locations available for this date. Please select another date.
        </p>
      )}
    </div>
  );
};

export default PickupLocationsList; 