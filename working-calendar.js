// Google Calendar integration service for Hearthfire Farms
import { google } from 'googleapis';
import { getFirestore, isMockFirebase } from './firebase-admin';

let client = null;

// Helper function to get calendar settings from Firestore
const getCalendarSettings = async () => {
  try {
    const firestoreAdmin = await getFirestore();
    const settingsDoc = await firestoreAdmin.collection('settings').doc('googleCalendar').get();
    
    if (!settingsDoc.exists) {
      console.log('No Google Calendar settings found in Firestore');
      return null;
    }
    
    const settings = settingsDoc.data();
    
    if (!settings.enabled) {
      console.log('Google Calendar integration is disabled in settings');
      return null;
    }
    
    if (!settings.calendarId || !settings.serviceAccountEmail || !settings.privateKey) {
      console.log('Incomplete Google Calendar settings in Firestore');
      return null;
    }
    
    return settings;
  } catch (error) {
    console.error('Error fetching Google Calendar settings from Firestore:', error);
    return null;
  }
};

// Function to get the Google Calendar client
const getCalendarClient = async () => {
  if (client) return client;
  
  try {
    console.log('Initializing Google Calendar client');
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    let serviceAccountEmail;
    let privateKey;
    let calendarId;
    
    // First try to get settings from Firestore
    const firestoreSettings = await getCalendarSettings();
    
    if (firestoreSettings) {
      console.log('Using Google Calendar settings from Firestore');
      serviceAccountEmail = firestoreSettings.serviceAccountEmail;
      privateKey = firestoreSettings.privateKey;
      calendarId = firestoreSettings.calendarId;
      console.log('Calendar ID from Firestore:', calendarId);
    } else {
      // Fall back to environment variables
      console.log('Falling back to environment variables for Google Calendar settings');
      serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      privateKey = process.env.GOOGLE_PRIVATE_KEY;
      calendarId = process.env.GOOGLE_CALENDAR_ID;
      console.log('Calendar ID from env:', calendarId);
    }
    
    // Check if we have the required credentials
    if (!serviceAccountEmail || !privateKey) {
      console.error('Missing Google service account credentials');
      
      // In development, return a mock client
      if (isDevelopment) {
        console.log('Creating mock Google Calendar client for development');
        return createMockClient();
      }
      
      throw new Error('Missing Google service account credentials');
    }
    
    // Format private key correctly if it's from environment variables
    // Sometimes the key from env vars doesn't have proper newlines
    if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Set up auth with service account
    try {
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      
      // Test the authentication
      await auth.authorize();
      console.log('Google Auth JWT initialized successfully');
      
      // Create calendar client
      const calendar = google.calendar({ version: 'v3', auth });
      
      // If we're using 'primary' as the calendar ID, we need to look up the actual primary calendar
      if (calendarId === 'primary') {
        try {
          console.log('Looking up primary calendar');
          // First, list the calendar list to find the default calendar
          const calendarList = await calendar.calendarList.list();
          const primaryCalendar = calendarList.data.items.find(cal => cal.primary === true);
          
          if (primaryCalendar) {
            calendarId = primaryCalendar.id;
            console.log('Found primary calendar ID:', calendarId);
          } else {
            console.warn('No primary calendar found, keeping "primary" as the ID');
          }
        } catch (error) {
          console.error('Error looking up primary calendar:', error);
          // Keep using 'primary' as the fallback
        }
      }
      
      client = { calendar, calendarId };
      console.log('Google Calendar client initialized successfully');
      return client;
    } catch (authError) {
      console.error('Error initializing Google Auth JWT:', authError);
      throw authError;
    }
  } catch (error) {
    console.error('Error initializing Google Calendar client:', error);
    
    // In development, return a mock client instead of failing
    if (process.env.NODE_ENV === 'development') {
      console.log('Creating mock Google Calendar client for development due to error');
      return createMockClient();
    }
    
    throw error;
  }
};

// Function to create a mock calendar client for development/testing
const createMockClient = () => {
  console.log('Creating mock Google Calendar client');
  
  // Create a simple mock calendar client that returns predictable responses
  return {
    mock: true,
    calendarId: 'mock-calendar-id',
    calendar: {
      events: {
        list: async () => {
          return {
            data: {
              items: [
                {
                  id: 'mock-event-1',
                  summary: 'Hearthfire Farms Delivery Availability',
                  description: 'Mock delivery availability event',
                  start: { dateTime: new Date().toISOString() },
                  end: { dateTime: new Date(Date.now() + 86400000).toISOString() }
                }
              ]
            }
          };
        },
        insert: async (params) => {
          console.log('Mock calendar insert event:', params.requestBody.summary);
          return {
            data: {
              id: `mock-event-${Date.now()}`,
              htmlLink: 'https://calendar.google.com/mock-event',
              ...params.requestBody
            }
          };
        },
        update: async (params) => {
          console.log('Mock calendar update event:', params.eventId);
          return {
            data: {
              id: params.eventId,
              htmlLink: 'https://calendar.google.com/mock-event',
              ...params.requestBody
            }
          };
        },
        delete: async (params) => {
          console.log('Mock calendar delete event:', params.eventId);
          return { data: {} };
        }
      }
    }
  };
};

// Function to list events from Google Calendar
const listEventsInternal = async (timeMin, timeMax) => {
  try {
    const { calendar, calendarId, mock } = await getCalendarClient();
    
    if (mock) {
      console.log('Using mock calendar client for listEvents');
      return (await calendar.events.list()).data.items;
    }
    
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    return response.data.items;
  } catch (error) {
    console.error('Error listing events from Google Calendar:', error);
    throw error;
  }
};

/**
 * List all events from the Hearthfire Farms calendar
 * @param {Object} options - Query options
 * @param {string} options.timeMin - Start time in ISO format (default: now)
 * @param {string} options.timeMax - End time in ISO format (optional)
 * @param {number} options.maxResults - Maximum number of results (default: 100)
 * @returns {Promise<Array>} List of calendar events
 */
export async function listEvents(options = {}) {
  try {
    const { calendar, calendarId, mock } = await getCalendarClient();
    
    if (mock) {
      console.log('Using mock calendar client for listEvents');
      return (await calendar.events.list()).data.items;
    }
    
    const params = {
      calendarId,
      timeMin: options.timeMin || new Date().toISOString(),
      maxResults: options.maxResults || 100,
      singleEvents: true,
      orderBy: 'startTime',
    };
    
    if (options.timeMax) {
      params.timeMax = options.timeMax;
    }
    
    const response = await calendar.events.list(params);
    return response.data.items || [];
  } catch (error) {
    console.error('Error listing calendar events:', error);
    throw new Error('Failed to fetch calendar events');
  }
}

/**
 * Create a new delivery availability event on the calendar
 * @param {Object} scheduleData - Delivery schedule data
 * @returns {Promise<Object>} Created event
 */
export async function createAvailabilityEvent(scheduleData) {
  try {
    const { calendar, calendarId } = await getCalendarClient();
    
    // Format the description with slot information
    const slotsDescription = scheduleData.slots.map(slot => {
      const timeRange = slot.time;
      const capacity = slot.maxOrders;
      const estimatedDeliveryTime = "1.5 hours per delivery";
      return `- ${slot.name} (${timeRange}): Max capacity ${capacity} deliveries\n  Estimated time: ${estimatedDeliveryTime}`;
    }).join('\n');
    
    const description = `Delivery day with the following time slots:\n${slotsDescription}\n\nServing zip codes: ${scheduleData.zipCodes.join(', ')}\n\nNotes:\n- Each delivery takes approximately 1.5 hours\n- Once a time slot reaches its maximum capacity, it will no longer be available for new orders`;
    
    // Create the event
    const event = {
      summary: 'Hearthfire Farms Delivery Availability',
      location: `Zip codes: ${scheduleData.zipCodes.join(', ')}`,
      description,
      start: {
        dateTime: new Date(scheduleData.date).toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        // Default to end of day if not specified
        dateTime: new Date(new Date(scheduleData.date).getTime() + 8 * 60 * 60 * 1000).toISOString(),
        timeZone: 'America/New_York',
      },
    };
    
    const response = await calendar.events.insert({
      calendarId,
      resource: event,
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating availability event:', error);
    throw new Error('Failed to create availability event');
  }
}

/**
 * Create a delivery event for a completed order
 * @param {Object} orderData - Order data
 * @param {Object} deliveryInfo - Delivery information
 * @returns {Promise<Object>} Created event
 */
async function createDeliveryCalendarEvent(orderData) {
  try {
    const { calendar, calendarId } = await getCalendarClient();
    
    if (!calendar) {
      console.error('Failed to initialize Google Calendar client');
      return null;
    }
    
    const { deliveryInfo, orderId } = orderData;
    
    // Format the delivery date and time
    const deliveryDate = new Date(deliveryInfo.date);
    
    // Find the time slot information to set the correct start and end times
    let startTime, endTime;
    if (deliveryInfo.timeSlot === 'morning') {
      // Morning slot (9am - 12pm)
      startTime = new Date(deliveryDate);
      startTime.setHours(9, 0, 0, 0);
      endTime = new Date(deliveryDate);
      endTime.setHours(12, 0, 0, 0);
    } else if (deliveryInfo.timeSlot === 'afternoon') {
      // Afternoon slot (1pm - 5pm)
      startTime = new Date(deliveryDate);
      startTime.setHours(13, 0, 0, 0);
      endTime = new Date(deliveryDate);
      endTime.setHours(17, 0, 0, 0);
    } else {
      // Default to a 2-hour window starting at noon
      startTime = new Date(deliveryDate);
      startTime.setHours(12, 0, 0, 0);
      endTime = new Date(deliveryDate);
      endTime.setHours(14, 0, 0, 0);
    }
    
    // Get time slot name for the event title
    const timeSlotName = deliveryInfo.timeSlot === 'morning' ? 'Morning (9am-12pm)' : 
                       deliveryInfo.timeSlot === 'afternoon' ? 'Afternoon (1pm-5pm)' : 
                       'Custom Time';
    
    const address = module.exports.formatAddress(deliveryInfo.address);
    
    const event = {
      summary: `Delivery #${orderId.substring(6)} - ${timeSlotName}`,
      location: address,
      description: module.exports.formatDeliveryDescription(orderData),
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/Chicago',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Chicago',
      },
      colorId: 1, // Adjust color as needed
    };
    
    console.log('Creating Google Calendar event for delivery');
    const response = await calendar.events.insert({
      calendarId,
      resource: event,
    });
    
    console.log(`Successfully created Google Calendar event: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error('Error creating Google Calendar event:', error.message);
    return null;
  }
}

/**
 * Fetch availability events from Google Calendar and convert to delivery schedules format
 * @param {string} timeMin - Start time in ISO format (default: now)
 * @param {string} timeMax - End time in ISO format (optional)
 * @returns {Promise<Array>} List of delivery schedules
 */
export async function getDeliverySchedulesFromCalendar(timeMin, timeMax) {
  try {
    console.log('Attempting to fetch delivery schedules from Google Calendar');
    
    // Get the calendar client to check if it's properly configured
    const { calendar, calendarId, mock } = await getCalendarClient();
    console.log('Using calendar ID:', calendarId);
    
    if (mock) {
      console.log('Using mock calendar client, returning mock schedules');
      // Create mock schedules directly here
      return createMockSchedules();
    }
    
    try {
      const events = await listEvents({
        timeMin,
        timeMax,
        maxResults: 50
      });
      
      console.log(`Successfully fetched ${events.length} events from Google Calendar`);
      
      // Filter events to include properly spelled "Availability" 
      // But also keep compatibility with potentially existing misspelled events
      const availabilityEvents = events.filter(event => 
        event.summary && (
          event.summary.includes('Delivery Availability') || 
          event.summary.includes('Delivery Availabilty') ||  // Keep for backward compatibility
          event.summary.includes('Hearthfire Farms Delivery')  // Add support for user's format
        )
      );
      
      console.log(`Found ${availabilityEvents.length} delivery availability events`);
      
      // Convert the events to delivery schedules format
      const schedules = availabilityEvents.map(event => {
        const startDate = new Date(event.start.dateTime || event.start.date);
        
        // Create morning and afternoon slots with appropriate capacities
        // Morning slot: 9am-12pm (3 hours) = 2 deliveries at 1.5 hours each
        // Afternoon slot: 1pm-5pm (4 hours) = 3 deliveries at 1.5 hours each (4 ÷ 1.5 = 2.67, rounded to 3)
        const slots = [
          {
            id: 'morning',
            name: 'Morning',
            time: '9am - 12pm',
            available: true,
            maxOrders: 2, // 3 hours ÷ 1.5 hours per delivery = 2 deliveries
            currentOrders: 0,
            durationHours: 3 // Store the slot duration for future route optimization
          },
          {
            id: 'afternoon',
            name: 'Afternoon',
            time: '1pm - 5pm',
            available: true,
            maxOrders: 3, // 4 hours ÷ 1.5 hours per delivery = 2.67, rounded to 3
            currentOrders: 0,
            durationHours: 4 // Store the slot duration for future route optimization
          }
        ];
        
        return {
          id: event.id,
          date: startDate.toISOString(),
          slots,
          zipCodes: ['12345', '23456', '34567'], // Default zip codes
          cutoffTime: '6pm day before',
          googleCalendarEventId: event.id
        };
      });
      
      if (schedules.length === 0) {
        console.log('No delivery schedules found in Google Calendar, using mock data');
        return createMockSchedules();
      }
      
      return schedules;
    } catch (error) {
      console.error('Error fetching events from Google Calendar:', error);
      
      // Create mock schedules as fallback
      console.log('Using mock schedules due to error');
      return createMockSchedules();
    }
  } catch (error) {
    console.error('Error fetching delivery schedules from calendar:', error);
    throw new Error('Failed to fetch delivery schedules from calendar');
  }
}

// Function to create mock delivery schedules for testing/development
function createMockSchedules() {
  console.log('Creating mock delivery schedules');
  
  const now = new Date();
  const futureDate1 = new Date(now);
  futureDate1.setDate(now.getDate() + 7); // 1 week from now
  
  const futureDate2 = new Date(now);
  futureDate2.setDate(now.getDate() + 14); // 2 weeks from now
  
  return [
    {
      id: 'test-schedule-1',
      date: futureDate1.toISOString(),
      slots: [
        {
          id: 'morning',
          name: 'Morning',
          time: '9am - 12pm',
          available: true,
          maxOrders: 2, // 3 hours ÷ 1.5 hours per delivery = 2 deliveries
          currentOrders: 0
        },
        {
          id: 'afternoon',
          name: 'Afternoon',
          time: '1pm - 5pm',
          available: true,
          maxOrders: 3, // 4 hours ÷ 1.5 hours per delivery = 2.67, rounded to 3
          currentOrders: 0
        }
      ],
      zipCodes: ['12345', '23456', '34567'],
      cutoffTime: '6pm day before',
      googleCalendarEventId: 'mock-event-1'
    },
    {
      id: 'test-schedule-2',
      date: futureDate2.toISOString(),
      slots: [
        {
          id: 'morning',
          name: 'Morning',
          time: '9am - 12pm',
          available: true,
          maxOrders: 2, // 3 hours ÷ 1.5 hours per delivery = 2 deliveries
          currentOrders: 0
        },
        {
          id: 'afternoon',
          name: 'Afternoon',
          time: '1pm - 5pm',
          available: true,
          maxOrders: 3, // 4 hours ÷ 1.5 hours per delivery = 2.67, rounded to 3
          currentOrders: 0
        }
      ],
      zipCodes: ['12345', '23456', '34567'],
      cutoffTime: '6pm day before',
      googleCalendarEventId: 'mock-event-2'
    }
  ];
}

/**
 * Update a delivery schedule in Google Calendar
 * @param {string} eventId - Google Calendar event ID
 * @param {Object} scheduleData - Updated schedule data
 * @returns {Promise<Object>} Updated event
 */
export async function updateAvailabilityEvent(eventId, scheduleData) {
  try {
    const { calendar, calendarId, mock } = await getCalendarClient();
    
    if (mock) {
      console.log('Using mock calendar client for updateAvailabilityEvent');
      return { id: eventId, htmlLink: 'https://calendar.google.com/mock' };
    }
    
    // Get the existing event first
    const response = await calendar.events.get({
      calendarId,
      eventId
    });
    
    const event = response.data;
    
    // Update the event with new data
    const updatedEvent = {
      ...event,
      summary: 'Hearthfire Farms Delivery Availability', // Correct spelling here
      description: `Delivery day with the following time slots:\n${scheduleData.slots.map(slot => 
        `- ${slot.name}: ${slot.time} (max: ${slot.maxOrders})`).join('\n')}\n\nServing zip codes: ${scheduleData.zipCodes.join(', ')}`,
      start: {
        dateTime: new Date(scheduleData.date).toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        // Default to end of day if not specified
        dateTime: new Date(new Date(scheduleData.date).getTime() + 8 * 60 * 60 * 1000).toISOString(),
        timeZone: 'America/New_York',
      },
    };
    
    // Update the event in Google Calendar
    const result = await calendar.events.update({
      calendarId,
      eventId,
      resource: updatedEvent
    });
    
    return result.data;
  } catch (error) {
    console.error('Error updating availability event in Google Calendar:', error);
    if (error.response) {
      console.error('Error data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Count delivery events for a specific date and time slot
 * @param {string|object} date - The date to check (can be ISO string, Date object, or Firestore timestamp)
 * @param {string} timeSlot - The time slot ID ('morning' or 'afternoon')
 * @returns {Promise<number>} - Number of delivery events found
 */
export async function countDeliveryEventsForSlot(date, timeSlot) {
  try {
    const { calendar, calendarId, mock } = await getCalendarClient();
    
    if (mock) {
      console.log('Using mock calendar client for countDeliveryEventsForSlot');
      return 0;
    }
    
    // Handle different date formats (ISO string, Date object, or Firestore timestamp)
    let dateObj;
    
    if (date instanceof Date) {
      // If it's already a Date object
      dateObj = date;
    } else if (typeof date === 'string') {
      // If it's an ISO string
      dateObj = new Date(date);
    } else if (date && typeof date === 'object') {
      // If it's a Firestore timestamp
      if (date._seconds !== undefined) {
        dateObj = new Date(date._seconds * 1000);
      } else if (date.seconds !== undefined) {
        dateObj = new Date(date.seconds * 1000);
      } else {
        // Fall back to current date if the format is unrecognized
        console.warn('Unrecognized date format, using current date as fallback', date);
        dateObj = new Date();
      }
    } else {
      // Fall back to current date if the format is unrecognized
      console.warn('Invalid date provided, using current date as fallback', date);
      dateObj = new Date();
    }
    
    console.log(`Counting delivery events for ${dateObj.toDateString()} - ${timeSlot} slot`);
    
    // Create date range for the specific date
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get all events for that day
    const events = await listEvents({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      maxResults: 20 // Limit to reasonable number
    });
    
    console.log(`Found ${events.length} total events on ${dateObj.toDateString()}`);
    
    // Filter to only include delivery events (not availability events)
    // and only those for the requested time slot
    const deliveryEvents = events.filter(event => {
      // Check if this is a delivery event (not an availability event)
      const isDeliveryEvent = event.summary && 
        (event.summary.includes('Delivery') || event.summary.includes('Delivery #')) && 
        !event.summary.includes('Availability');
      
      if (!isDeliveryEvent) return false;
      
      // Check if it's for the requested time slot
      const isMorningEvent = event.summary.includes('Morning') || 
                          (event.start.dateTime && new Date(event.start.dateTime).getHours() < 12) ||
                          (event.summary.includes('9am'));
      
      const isAfternoonEvent = event.summary.includes('Afternoon') || 
                            (event.start.dateTime && new Date(event.start.dateTime).getHours() >= 12) ||
                            (event.summary.includes('1pm'));
      
      return (timeSlot === 'morning' && isMorningEvent) || 
             (timeSlot === 'afternoon' && isAfternoonEvent);
    });
    
    console.log(`Found ${deliveryEvents.length} delivery events for ${timeSlot} on ${dateObj.toDateString()}`);
    return deliveryEvents.length;
  } catch (error) {
    console.error('Error counting delivery events:', error);
    return 0; // Return 0 if there's an error to avoid breaking the app
  }
}

// Add a reinitialize method to the Google Calendar service
const reinitialize = () => {
  console.log('Reinitializing Google Calendar client');
  client = null; // Clear the existing client
  return getCalendarClient(); // Create a new client with current settings
};

// Export methods
export default {
  listEvents,
  createAvailabilityEvent,
  createDeliveryEvent: createDeliveryCalendarEvent,
  getDeliverySchedulesFromCalendar,
  updateAvailabilityEvent,
  countDeliveryEventsForSlot,
  reinitialize,
  formatAddress: function(addressObj) {
    if (!addressObj) return '';
    
    const { street, city, state, zipCode } = addressObj;
    return `${street}, ${city}, ${state} ${zipCode}`;
  },
  formatDeliveryDescription: function(orderData) {
    const { deliveryInfo, items, orderId, customerName, customerEmail, customerPhone, 
            subtotal, deliveryFee, tax, total } = orderData;
    
    // Format items for the description
    const itemsList = items.map(item => 
      `${item.quantity} x ${item.name} ($${item.price} each)`
    ).join('\n');
    
    const address = this.formatAddress(deliveryInfo.address);
    
    // Create a detailed description with order information
    return `
Order ID: ${orderId}
Customer: ${customerName || 'N/A'}
Email: ${customerEmail || 'N/A'}
Phone: ${customerPhone || 'N/A'}

Delivery Address:
${address}

Items:
${itemsList}

Subtotal: $${subtotal}
Delivery Fee: $${deliveryFee || '0.00'}
Tax: $${tax || '0.00'}
Total: $${total}

Special Instructions: ${deliveryInfo.instructions || 'None'}

-----
Estimated delivery time: 1.5 hours
Google Maps Directions: https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}
`;
  }
}; 