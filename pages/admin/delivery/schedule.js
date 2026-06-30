import { useState, useEffect, useRef } from 'react';
import AdminRoute from '../../../components/AdminRoute';
import { useAuth } from '../../../contexts/AuthContext';
import Link from 'next/link';
import { format, addDays, parse, isValid, isBefore } from 'date-fns';
import AddressAutocomplete from '../../../components/AddressAutocomplete';

function parseScheduleDate(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
    }
  }

  return new Date(value);
}

export default function DeliverySchedule() {
  return (
    <AdminRoute>
      <ScheduleContent />
    </AdminRoute>
  );
}

function ScheduleContent() {
  const { currentUser } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [activeTab, setActiveTab] = useState('delivery'); // 'delivery' or 'pickup'
  const [showPastEvents, setShowPastEvents] = useState(false);
  const modalRef = useRef(null);
  const [syncStatus, setSyncStatus] = useState({ isSyncing: false, message: '' });
  const [calendarStatus, setCalendarStatus] = useState({ isConfigured: false, message: 'Checking configuration...' });
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  
  const [newSchedule, setNewSchedule] = useState({
    date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    type: 'delivery', // Default to delivery
    slots: [
      { time: '9am-12pm', id: 'morning', maxOrders: 2, available: true },
      { time: '1pm-5pm', id: 'afternoon', maxOrders: 3, available: true }
    ],
    zipCodes: [],
    location: '', // For pickup type
    locationDetails: null, // Store detailed address data
    cutoffTime: 12, // Hours before delivery
    note: ''
  });
  
  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsAddingSchedule(false);
      }
    }
    
    if (isAddingSchedule) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddingSchedule]);
  
  useEffect(() => {
    // Fetch delivery schedules
    async function fetchSchedules() {
      try {
        const token = await currentUser.getIdToken();
        
        const response = await fetch('/api/delivery/schedules', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch schedules');
        
        const data = await response.json();
        setSchedules(data);
      } catch (error) {
        console.error('Error fetching schedules:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchSchedules();
  }, [currentUser]);
  
  // Update the checkCalendarStatus function to better handle errors and authentication issues
  useEffect(() => {
    async function checkCalendarStatus() {
      try {
        setCalendarStatus({ isConfigured: false, message: 'Checking configuration...' });
        
        if (!currentUser) return;
        
        try {
          const token = await currentUser.getIdToken();
          const response = await fetch('/api/delivery/calendar/status', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.status === 403) {
            // Handle forbidden/authentication errors more gracefully
            console.log('Calendar integration requires additional permissions');
            setCalendarStatus({
              isConfigured: false,
              message: 'Calendar integration requires admin permissions'
            });
            return;
          }
          
          if (!response.ok) {
            throw new Error(`Failed to check calendar status: ${response.status}`);
          }
          
          const data = await response.json();
          
          setCalendarStatus({
            isConfigured: data.configured,
            message: data.configured 
              ? 'Google Calendar integration is configured and working.' 
              : data.message || 'Google Calendar integration is not fully configured.'
          });
        } catch (error) {
          // Don't log most errors to console in production environments
          if (process.env.NODE_ENV !== 'production') {
            console.error('Error checking calendar status:', error);
          }
          
          setCalendarStatus({
            isConfigured: false,
            message: 'Calendar status unavailable. Settings can be configured below.'
          });
        }
      } catch (error) {
        // This outer try/catch ensures the component doesn't crash
        setCalendarStatus({
          isConfigured: false,
          message: 'Unable to check calendar configuration'
        });
      }
    }
    
    if (currentUser) {
      checkCalendarStatus();
    }
  }, [currentUser]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling when switching between delivery and pickup types
    if (name === 'type') {
      if (value === 'pickup') {
        // When switching to pickup, reset to a single time slot representing the full pickup window
        // For pickup schedules, we don't limit the number of orders (unlimited capacity)
        setNewSchedule(prev => ({
          ...prev,
          type: value,
          slots: [
            { time: '9am-3pm', id: 'pickup-window', maxOrders: 999, available: true }
          ]
        }));
      } else if (value === 'delivery') {
        // When switching to delivery, reset to the default morning/afternoon slots
        setNewSchedule(prev => ({
          ...prev,
          type: value,
          slots: [
            { time: '9am-12pm', id: 'morning', maxOrders: 2, available: true },
            { time: '1pm-5pm', id: 'afternoon', maxOrders: 3, available: true }
          ]
        }));
      }
    } else {
      // For other inputs, update normally
      setNewSchedule(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const handleLocationChange = (formattedAddress, addressObject) => {
    setNewSchedule(prev => ({
      ...prev,
      location: formattedAddress,
      locationDetails: addressObject
    }));
  };
  
  const handleZipCodeChange = (e) => {
    const zipCodes = e.target.value.split(',').map(zip => zip.trim()).filter(Boolean);
    setNewSchedule(prev => ({
      ...prev,
      zipCodes
    }));
  };
  
  const handleSlotChange = (index, field, value) => {
    setNewSchedule(prev => {
      const updatedSlots = [...prev.slots];
      
      if (field === 'available') {
        value = value === 'true';
      } else if (field === 'maxOrders') {
        value = parseInt(value);
      } else if (field === 'time') {
        // If they're setting a time, try to determine if it's a morning or afternoon slot
        // and set the id and default maxOrders accordingly
        if (value.toLowerCase().includes('9am') || value.toLowerCase().includes('morning')) {
          updatedSlots[index].id = 'morning';
          if (updatedSlots[index].maxOrders === 2 || updatedSlots[index].maxOrders === 3) {
            updatedSlots[index].maxOrders = 2; // 3 hours ÷ 1.5 hours = 2 slots
          }
        } else if (value.toLowerCase().includes('1pm') || value.toLowerCase().includes('afternoon')) {
          updatedSlots[index].id = 'afternoon';
          if (updatedSlots[index].maxOrders === 2 || updatedSlots[index].maxOrders === 3) {
            updatedSlots[index].maxOrders = 3; // 4 hours ÷ 1.5 hours = ~3 slots
          }
        } else {
          // For any other time slot, set a neutral ID
          updatedSlots[index].id = value.replace(/[^a-z0-9]/gi, '').toLowerCase();
        }
      }
      
      updatedSlots[index] = {
        ...updatedSlots[index],
        [field]: value
      };
      
      return {
        ...prev,
        slots: updatedSlots
      };
    });
  };
  
  const addSlot = () => {
    setNewSchedule(prev => ({
      ...prev,
      slots: [...prev.slots, { time: '', id: '', maxOrders: 2, available: true }]
    }));
  };
  
  const removeSlot = (index) => {
    setNewSchedule(prev => {
      const updatedSlots = [...prev.slots];
      updatedSlots.splice(index, 1);
      
      return {
        ...prev,
        slots: updatedSlots
      };
    });
  };
  
  // Filter schedules based on type and date
  const filteredSchedules = schedules.filter(schedule => {
    const isCorrectType = schedule.type === activeTab;
    if (!isCorrectType) return false;
    
    if (!showPastEvents) {
      const scheduleDate = parseScheduleDate(schedule.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return !isBefore(scheduleDate, today);
    }
    
    return true;
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const cleanZipCodes = newSchedule.zipCodes.map(zip => String(zip).trim()).filter(Boolean);

      // Basic validation
      if (!newSchedule.date) {
        alert('Please select a delivery date');
        return;
      }
      
      if (newSchedule.slots.length === 0) {
        alert('Please add at least one time slot');
        return;
      }
      
      if (newSchedule.slots.some(slot => !slot.time)) {
        alert('Please provide time for all slots');
        return;
      }
      
      // Type-specific validation
      if (newSchedule.type === 'delivery') {
        if (newSchedule.slots.some(slot => !slot.maxOrders)) {
          alert('Please provide maximum orders for all slots');
          return;
        }
      } else if (newSchedule.type === 'pickup') {
        if (!newSchedule.location.trim()) {
          alert('Please provide a pickup location');
          return;
        }
      }
      
      // Format data for API
      const deliveryDate = parse(newSchedule.date, 'yyyy-MM-dd', new Date());
      
      if (!isValid(deliveryDate)) {
        alert('Please provide a valid delivery date');
        return;
      }
      
      // For pickup schedules, we only need the first time slot that covers the entire pickup window
      const slotsToUse = newSchedule.type === 'pickup' 
        ? [newSchedule.slots[0]] // For pickup, use just the first slot
        : newSchedule.slots;     // For delivery, use all slots
      
      const scheduleData = {
        date: newSchedule.date,
        type: newSchedule.type,
        slots: slotsToUse.map(slot => ({
          ...slot,
          // For pickup schedules, set a high maxOrders to effectively remove the limit
          maxOrders: newSchedule.type === 'pickup' ? 999 : parseInt(slot.maxOrders)
        })),
        cutoffTime: parseInt(newSchedule.cutoffTime),
        note: newSchedule.note
      };
      
      // Add type-specific fields
      if (newSchedule.type === 'delivery') {
        scheduleData.zipCodes = cleanZipCodes;
      } else if (newSchedule.type === 'pickup') {
        scheduleData.location = newSchedule.location;
        // Include location details for pickup schedules
        if (newSchedule.locationDetails) {
          scheduleData.locationDetails = newSchedule.locationDetails;
        }
      }
      
      // Submit to API
      const token = await currentUser.getIdToken();
      
      const response = await fetch('/api/delivery/schedules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to create schedule');
      }
      
      // Reset form and refresh schedules
      setIsAddingSchedule(false);
      resetForm();
      
      // Fetch updated schedules
      const schedulesResponse = await fetch('/api/delivery/schedules', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (schedulesResponse.ok) {
        const updatedSchedules = await schedulesResponse.json();
        setSchedules(updatedSchedules);
      }
      
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert(`Failed to create schedule: ${error.message}`);
    }
  };
  
  const deleteSchedule = async (id) => {
    if (!confirm('Are you sure you want to delete this delivery schedule?')) {
      return;
    }
    
    try {
      const token = await currentUser.getIdToken();
      
      const response = await fetch(`/api/delivery/schedules/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule');
      }
      
      // Remove from local state
      setSchedules(prev => prev.filter(schedule => schedule.id !== id));
      
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert(`Failed to delete schedule: ${error.message}`);
    }
  };
  
  const syncWithCalendar = async () => {
    try {
      setSyncStatus({ isSyncing: true, message: 'Syncing with Google Calendar...' });
      
      const token = await currentUser.getIdToken();
      
      const response = await fetch('/api/admin/calendar/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 403) {
        setSyncStatus({ 
          isSyncing: false, 
          message: 'Calendar sync requires admin permissions' 
        });
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync with calendar');
      }
      
      const result = await response.json();
      
      // Refresh schedules
      const schedulesResponse = await fetch('/api/delivery/schedules', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (schedulesResponse.ok) {
        const updatedSchedules = await schedulesResponse.json();
        setSchedules(updatedSchedules);
      }
      
      setSyncStatus({ 
        isSyncing: false, 
        message: `Successfully synced ${result.added} new schedules and updated ${result.updated} existing schedules.` 
      });
      
      // Clear message after 5 seconds
      setTimeout(() => {
        setSyncStatus({ isSyncing: false, message: '' });
      }, 5000);
      
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error syncing with calendar:', error);
      }
      setSyncStatus({ 
        isSyncing: false, 
        message: `Failed to sync with calendar: ${error.message}` 
      });
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setSyncStatus({ isSyncing: false, message: '' });
      }, 5000);
    }
  };
  
  const syncOrderCounts = async () => {
    try {
      setSyncStatus({ isSyncing: true, message: 'Updating order counts...' });
      
      const token = await currentUser.getIdToken();
      
      const response = await fetch('/api/delivery/schedules?syncOrderCounts=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 403) {
        setSyncStatus({ 
          isSyncing: false, 
          message: 'Updating order counts requires admin permissions' 
        });
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync order counts');
      }
      
      // Refresh schedules with the updated data
      const updatedSchedules = await response.json();
      setSchedules(updatedSchedules);
      
      setSyncStatus({ 
        isSyncing: false, 
        message: 'Successfully updated order counts' 
      });
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSyncStatus({ isSyncing: false, message: '' });
      }, 5000);
      
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating order counts:', error);
      }
      setSyncStatus({ 
        isSyncing: false, 
        message: `Failed to update order counts: ${error.message}` 
      });
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setSyncStatus({ isSyncing: false, message: '' });
      }, 5000);
    }
  };
  
  const resetForm = () => {
    setNewSchedule({
      date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      type: activeTab, // Set type to match current tab
      slots: activeTab === 'pickup' 
        ? [{ time: '9am-3pm', id: 'pickup-window', maxOrders: 999, available: true }]
        : [
            { time: '9am-12pm', id: 'morning', maxOrders: 2, available: true },
            { time: '1pm-5pm', id: 'afternoon', maxOrders: 3, available: true }
          ],
      zipCodes: [],
      location: '',
      locationDetails: null,
      cutoffTime: 12,
      note: ''
    });
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold">Delivery Schedule Management</h1>
        <Link href="/admin" className="text-indigo-600 hover:text-indigo-800 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
      
      {/* Google Calendar Integration Status */}
      <div className="bg-white shadow-md rounded-lg p-4 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Google Calendar Integration</h2>
            <p className="text-sm text-gray-500">
              {calendarStatus.message}
            </p>
          </div>
          <div>
            <button
              onClick={() => setShowCalendarSettings(!showCalendarSettings)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-md text-sm"
            >
              {showCalendarSettings ? 'Hide Settings' : 'Show Settings'}
            </button>
          </div>
        </div>
        
        {/* Calendar Settings Panel */}
        {showCalendarSettings && (
          <div className="mt-4 border-t pt-4">
            <CalendarSettingsPanel 
              currentUser={currentUser} 
              onStatusChange={(status) => setCalendarStatus(status)} 
            />
          </div>
        )}
      </div>

      {/* Display sync status message if exists */}
      {syncStatus.message && (
        <div className={`p-2 mb-4 text-sm rounded ${syncStatus.isSyncing ? 'bg-gray-100' : syncStatus.message.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {syncStatus.message}
        </div>
      )}
      
      {/* Main Content Area */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {/* Tabs and Filters Section */}
        <div className="flex flex-col sm:flex-row justify-between border-b p-4">
          <div className="flex space-x-1 mb-4 sm:mb-0">
            <button
              onClick={() => setActiveTab('delivery')}
              className={`px-4 py-2 rounded-lg ${activeTab === 'delivery' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              Delivery Schedules
            </button>
            <button
              onClick={() => setActiveTab('pickup')}
              className={`px-4 py-2 rounded-lg ${activeTab === 'pickup' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              Pickup Schedules
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={showPastEvents}
                onChange={(e) => setShowPastEvents(e.target.checked)}
                className="mr-2"
              />
              Show Past Events
            </label>
            
            <button
              onClick={() => {
                resetForm();
                setIsAddingSchedule(true);
              }}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Schedule
            </button>
          </div>
        </div>
        
        {/* Schedules List */}
        <div className="p-4">
          {error && <p className="text-red-500 mb-4">{error}</p>}
          
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500 text-lg">No {activeTab} schedules found.</p>
              <button
                onClick={() => {
                  resetForm();
                  setIsAddingSchedule(true);
                }}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Create your first {activeTab} schedule
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSchedules.map(schedule => (
                <div key={schedule.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">
                        {parseScheduleDate(schedule.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Cutoff: {schedule.cutoffTime} hours before {schedule.type}
                      </p>
                      
                      {schedule.type === 'delivery' && (
                        <p className="text-sm text-gray-500">
                          Zip Codes: {schedule.zipCodes.join(', ')}
                        </p>
                      )}
                      
                      {schedule.type === 'pickup' && (
                        <p className="text-sm text-gray-500">
                          Location: {schedule.location}
                        </p>
                      )}
                      
                      {schedule.googleCalendarEventId && (
                        <a 
                          href={`https://calendar.google.com/calendar/event?eid=${btoa(schedule.googleCalendarEventId).replace(/\+/g, '-').replace(/\//g, '_')}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-700 mt-1 inline-block"
                        >
                          Linked to Google Calendar
                        </a>
                      )}
                      
                      {schedule.note && (
                        <p className="text-sm italic mt-2 text-gray-600">{schedule.note}</p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => deleteSchedule(schedule.id)}
                      className="text-red-500 hover:text-red-700"
                      aria-label="Delete schedule"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Time Slots:</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {schedule.slots.map(slot => (
                        <div key={slot.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span>{slot.time || slot.name}</span>
                          <div className="flex items-center">
                            <span className={`px-2 py-1 rounded text-xs ${slot.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {slot.available ? 'Available' : 'Unavailable'}
                            </span>
                            {schedule.type === 'delivery' && (
                              <span className="ml-2 text-sm">
                                {slot.currentOrders}/{slot.maxOrders} orders
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Add Schedule Modal */}
      {isAddingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div 
            ref={modalRef}
            className="bg-white rounded-lg w-full max-w-2xl max-h-[calc(100vh-1rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="p-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Create New {newSchedule.type === 'delivery' ? 'Delivery' : 'Pickup'} Schedule</h2>
              <button 
                onClick={() => setIsAddingSchedule(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Schedule Type
                  </label>
                  <select
                    name="type"
                    value={newSchedule.type}
                    onChange={handleInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  >
                    <option value="delivery">Delivery</option>
                    <option value="pickup">Pickup</option>
                  </select>
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    {newSchedule.type === 'delivery' ? 'Delivery Date' : 'Pickup Date'}
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={newSchedule.date}
                    onChange={handleInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    {newSchedule.type === 'delivery' ? 'Time Slots' : 'Pickup Window'}
                  </label>
                  {newSchedule.slots.map((slot, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_11rem_auto] gap-2 mb-3">
                      <input
                        type="text"
                        placeholder={newSchedule.type === 'delivery' ? "Time (e.g. 9am-12pm)" : "Pickup hours (e.g. 9am-3pm)"}
                        value={slot.time}
                        onChange={(e) => handleSlotChange(index, 'time', e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      />
                      {/* Only show max orders and availability for delivery schedules */}
                      {newSchedule.type === 'delivery' && (
                        <>
                          <input
                            type="number"
                            placeholder="Max Orders"
                            value={slot.maxOrders}
                            onChange={(e) => handleSlotChange(index, 'maxOrders', e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            min="1"
                          />
                          <select
                            value={slot.available.toString()}
                            onChange={(e) => handleSlotChange(index, 'available', e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          >
                            <option value="true">Available</option>
                            <option value="false">Not Available</option>
                          </select>
                        </>
                      )}
                      {/* Only show remove button if it's a delivery schedule or if there's more than one slot */}
                      {(newSchedule.type === 'delivery' || newSchedule.slots.length > 1) && (
                        <button
                          type="button"
                          onClick={() => removeSlot(index)}
                          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full sm:w-auto"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Only show the Add Time Slot button for delivery schedules */}
                  {newSchedule.type === 'delivery' && (
                    <button
                      type="button"
                      onClick={addSlot}
                      className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    >
                      + Add Time Slot
                    </button>
                  )}
                </div>
                
                {newSchedule.type === 'delivery' && (
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Zip Codes (comma separated)
                    </label>
                    <input
                      type="text"
                      name="zipCodesInput"
                      value={newSchedule.zipCodes.join(', ')}
                      onChange={handleZipCodeChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      placeholder="12345, 12346"
                    />
                  </div>
                )}
                
                {newSchedule.type === 'pickup' && (
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Pickup Location
                    </label>
                    <AddressAutocomplete
                      value={newSchedule.location}
                      onChange={handleLocationChange}
                      placeholder="Enter pickup location address"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      inputProps={{
                        "aria-label": "Pickup location address"
                      }}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Type to search and select an address from the dropdown for accurate location data
                    </p>
                  </div>
                )}
                
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Cutoff Time (hours before {newSchedule.type})
                  </label>
                  <input
                    type="number"
                    name="cutoffTime"
                    value={newSchedule.cutoffTime}
                    onChange={handleInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    min="1"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Note (optional)
                  </label>
                  <textarea
                    name="note"
                    value={newSchedule.note}
                    onChange={handleInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    rows="3"
                  ></textarea>
                </div>
                
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSchedule(false);
                      resetForm();
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full sm:w-auto"
                  >
                    Create Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add this component after the main ScheduleContent component
function CalendarSettingsPanel({ currentUser, onStatusChange }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [settings, setSettings] = useState({
    calendarId: '',
    serviceAccountEmail: '',
    privateKey: '',
    enabled: true
  });
  
  useEffect(() => {
    // Fetch current settings
    async function fetchSettings() {
      try {
        setIsLoading(true);
        setError(null);
        
        if (!currentUser) return;
        
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/delivery/calendar/settings', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch calendar settings: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update the form with current settings
        setSettings({
          calendarId: data.calendarId || '',
          serviceAccountEmail: data.serviceAccountEmail || '',
          privateKey: data.privateKey ? '************' : '', // Hide private key
          enabled: data.enabled !== false // Default to true if not set
        });
        
      } catch (error) {
        console.error('Error fetching calendar settings:', error);
        setError(`Error loading settings: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (currentUser) {
      fetchSettings();
    }
  }, [currentUser]);
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = await currentUser.getIdToken();
      
      // Only send the private key if it has been changed (not the asterisks)
      const dataToSend = {
        ...settings,
        privateKey: settings.privateKey === '************' ? undefined : settings.privateKey
      };
      
      const response = await fetch('/api/delivery/calendar/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }
      
      const data = await response.json();
      setSuccess('Settings saved successfully');
      
      // Update parent component with new status
      if (onStatusChange) {
        onStatusChange({
          isConfigured: data.configured,
          message: data.configured 
            ? 'Google Calendar integration is configured and working.' 
            : 'Google Calendar integration is not fully configured.'
        });
      }
      
    } catch (error) {
      console.error('Error saving calendar settings:', error);
      setError(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div>
      {isLoading && <p className="text-blue-500">Loading...</p>}
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {success && <p className="text-green-500 mb-2">{success}</p>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="enabled" className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              name="enabled"
              checked={settings.enabled}
              onChange={handleInputChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Enable Google Calendar Integration</span>
          </label>
        </div>
        
        <div>
          <label htmlFor="calendarId" className="block text-sm font-medium text-gray-700">
            Calendar ID
          </label>
          <input
            type="text"
            id="calendarId"
            name="calendarId"
            value={settings.calendarId}
            onChange={handleInputChange}
            placeholder="example@group.calendar.google.com"
            className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
          />
          <p className="mt-1 text-xs text-gray-500">
            The ID of your Google Calendar (found in calendar settings)
          </p>
        </div>
        
        <div>
          <label htmlFor="serviceAccountEmail" className="block text-sm font-medium text-gray-700">
            Service Account Email
          </label>
          <input
            type="text"
            id="serviceAccountEmail"
            name="serviceAccountEmail"
            value={settings.serviceAccountEmail}
            onChange={handleInputChange}
            placeholder="service-account@project.iam.gserviceaccount.com"
            className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
          />
          <p className="mt-1 text-xs text-gray-500">
            The email address of your Google Cloud service account
          </p>
        </div>
        
        <div>
          <label htmlFor="privateKey" className="block text-sm font-medium text-gray-700">
            Private Key
          </label>
          <textarea
            id="privateKey"
            name="privateKey"
            value={settings.privateKey}
            onChange={handleInputChange}
            rows={5}
            placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
            className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
          />
          <p className="mt-1 text-xs text-gray-500">
            The private key from your service account JSON file. Keep this secure!
          </p>
        </div>
        
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className={`${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
            } w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2`}
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
