// Google Calendar integration service for Hearthfire Farm
import { google } from 'googleapis';
import { supabaseAdmin } from './supabase-admin';
import { getTimeSlotHours, parseDeliveryDate, phoneToLink } from '../utils/formatters';

let client = null;

// Helper function to get calendar settings from Supabase
const getCalendarSettings = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('content')
      .select('data')
      .eq('id', 'googleCalendar')
      .single();

    if (error || !data?.data) {
      // No Google Calendar settings found in Supabase
      return null;
    }

    const settings = data.data;
    
    if (!settings.enabled) {
      // Google Calendar integration is disabled in settings
      return null;
    }
    
    if (!settings.calendarId || !settings.serviceAccountEmail || !settings.privateKey) {
      // Incomplete Google Calendar settings in Supabase
      return null;
    }
    
    return settings;
  } catch (error) {
    console.error('Error fetching Google Calendar settings from Supabase:', error);
    return null;
  }
};

// Helper to properly format the private key
function formatPrivateKey(key) {
  if (!key) return null;
  
  // Remove surrounding quotes if present
  let formattedKey = key.trim();
  // Replace escaped newlines with actual newlines
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  
  // Ensure the key has the proper BEGIN and END markers
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}`;
  }
  if (!formattedKey.includes('-----END PRIVATE KEY-----')) {
    formattedKey = `${formattedKey}\n-----END PRIVATE KEY-----`;
  }
  
  return formattedKey.trim();
}

function getCalendarDateKey(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === 'string') {
    const match = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().split('T')[0];
}

// Function to get the Google Calendar client
const getCalendarClient = async () => {
  if (client) return client;
  
  try {
    const isDevelopment = process.env.NODE_ENV === 'development';
    let serviceAccountEmail;
    let privateKey;
    let calendarId;
    
    // First try to get settings from Supabase
    const supabaseSettings = await getCalendarSettings();

    if (supabaseSettings) {
      serviceAccountEmail = supabaseSettings.serviceAccountEmail;
      privateKey = supabaseSettings.privateKey;
      calendarId = supabaseSettings.calendarId;
    } else {
      // Fall back to environment variables
      serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      privateKey = process.env.GOOGLE_PRIVATE_KEY;
      calendarId = process.env.GOOGLE_CALENDAR_ID;
    }
    
    let authError = null;
    
    // Attempt 1: Try with provided Google service account credentials
    if (serviceAccountEmail && privateKey) {
      try {
        // Format private key correctly
        privateKey = formatPrivateKey(privateKey);
        
        // Set up auth with service account
        const auth = new google.auth.JWT({
          email: serviceAccountEmail,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/calendar']
        });
        
        // Test the authentication
        await auth.authorize();
        
        // Create calendar client
        const calendar = google.calendar({ version: 'v3', auth });
        
        // Use the calendar
        client = { calendar, calendarId, mock: false };
        
        return client;
      } catch (error) {
        console.error('Error with Google credentials:', error.message);
        authError = error;
      }
    }
    
    // Attempt 2: Try with Firebase service account key if available
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        const firebasePrivateKey = serviceAccount.private_key;
        const firebaseEmail = serviceAccount.client_email;
        
        if (firebaseEmail && firebasePrivateKey) {
          const auth = new google.auth.JWT({
            email: firebaseEmail,
            key: firebasePrivateKey,
            scopes: ['https://www.googleapis.com/auth/calendar']
          });
          
          // Test the authentication
          await auth.authorize();
          
          // Create calendar client
          const calendar = google.calendar({ version: 'v3', auth });
          
          // Use the calendar
          client = { calendar, calendarId, mock: false };
          
          return client;
        }
      } catch (error) {
        console.error('Error with Firebase credentials:', error.message);
        authError = error;
      }
    }
    
    // If we're here, both authentication attempts failed
    if (isDevelopment) {
      return createMockClient();
    }
    
    // In production, throw the last error
    throw authError || new Error('Failed to initialize Google Calendar client');
  } catch (error) {
    console.error('Error initializing Google Calendar client:', error);
    
    // In development, return a mock client
    if (process.env.NODE_ENV === 'development') {
      return createMockClient();
    }
    
    throw error;
  }
};

// Function to create a mock calendar client for development/testing
const createMockClient = () => {
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
                  summary: 'Hearthfire Farm Delivery Availability',
                  description: 'Mock delivery availability event',
                  start: { dateTime: new Date().toISOString() },
                  end: { dateTime: new Date(Date.now() + 86400000).toISOString() }
                }
              ]
            }
          };
        },
        insert: async (params) => {
          return {
            data: {
              id: `mock-event-${Date.now()}`,
              htmlLink: 'https://calendar.google.com/mock-event',
              ...params.requestBody
            }
          };
        },
        update: async (params) => {
          return {
            data: {
              id: params.eventId,
              htmlLink: 'https://calendar.google.com/mock-event',
              ...params.requestBody
            }
          };
        },
        delete: async (params) => {
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
 * List all events from the Hearthfire Farm calendar
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
    
    try {
      const response = await calendar.events.list(params);
      return response.data.items || [];
    } catch (apiError) {
      console.error('Error calling Google Calendar API:', apiError);
      
      // In development mode, return mock events
      if (process.env.NODE_ENV === 'development') {
        return createMockEvents();
      }
      
      throw apiError;
    }
  } catch (error) {
    console.error('Error listing calendar events:', error);
    
    // In development mode, return mock events
    if (process.env.NODE_ENV === 'development') {
      console.log('Returning mock events in development mode after error');
      return createMockEvents();
    }
    
    throw new Error('Failed to fetch calendar events');
  }
}

/**
 * Create a new availability event on the calendar (either delivery or pickup)
 * @param {Object} scheduleData - Schedule data
 * @returns {Promise<Object>} Created event
 */
export async function createAvailabilityEvent(scheduleData) {
  try {
    const { calendar, calendarId } = await getCalendarClient();
    
    // Format the description with slot information - for delivery, use slots
    // For pickup, simplify if there are only a couple slots as it's more of a time window
    let slotsDescription = '';
    
    if (scheduleData.type === 'delivery') {
      // For delivery schedules, list all slots
      slotsDescription = scheduleData.slots.map(slot => {
      const timeRange = slot.time;
      const capacity = slot.maxOrders;
        const estimatedTime = "1.5 hours per delivery";
        return `- ${slot.name || slot.time} (${timeRange}): Max capacity ${capacity} deliveries\n  Estimated time: ${estimatedTime}`;
    }).join('\n');
    } else if (scheduleData.type === 'pickup') {
      // For pickup, show as a time window (e.g., "9am-3pm")
      // Use the first slot's time as the pickup hours
      if (scheduleData.slots.length > 0) {
        slotsDescription = `Pickup hours: ${scheduleData.slots[0].time}`;
      }
    }
    
    let locationStr = '';
    let descriptionStr = '';
    let summaryStr = '';
    
    if (scheduleData.type === 'delivery') {
      summaryStr = 'Hearthfire Farm Delivery Availability';
      locationStr = `Zip codes: ${scheduleData.zipCodes.join(', ')}`;
      descriptionStr = `Delivery day with the following time slots:\n${slotsDescription}\n\nServing zip codes: ${scheduleData.zipCodes.join(', ')}`;
      
      // Add notes section if there are notes
      if (scheduleData.notes && scheduleData.notes.trim() !== '') {
        descriptionStr += `\n\nDetails:\n${scheduleData.notes}`;
      }
      
      // Add standard footer notes
      descriptionStr += `\n\nNotes:\n- Each delivery takes approximately 1.5 hours\n- Once a time slot reaches its maximum capacity, it will no longer be available for new orders`;
    } else if (scheduleData.type === 'pickup') {
      summaryStr = 'Hearthfire Farm Pickup Availability';
      locationStr = scheduleData.location;
      
      // For pickup: Use notes as the primary description content
      if (scheduleData.notes && scheduleData.notes.trim() !== '') {
        descriptionStr = scheduleData.notes;
      } else {
        descriptionStr = `Farm pickup at ${scheduleData.location}\n\n${slotsDescription}`;
      }
      
      // Add pickup location information 
      descriptionStr += `\n\nPickup location: ${scheduleData.location}`;
      
      // Add Google Maps link if coordinates are available
      if (scheduleData.locationDetails && scheduleData.locationDetails.coordinates) {
        const { lat, lng } = scheduleData.locationDetails.coordinates;
        descriptionStr += `\nGoogle Maps: https://maps.google.com/?q=${lat},${lng}`;
      }
    }
    
    const dateKey = getCalendarDateKey(scheduleData.date);
    if (!dateKey) {
      throw new Error('Invalid schedule date');
    }
    
    // Create the event
    const event = {
      summary: summaryStr,
      location: locationStr,
      description: descriptionStr,
      start: {
        date: dateKey,
      },
      end: {
        date: addDaysToDateKey(dateKey, 1),
      },
      // Use different colors for delivery vs pickup
      colorId: scheduleData.type === 'delivery' ? '1' : '4', // 1 = Blue (delivery), 4 = Purple (pickup)
    };

    // For pickup events with coordinates, add location as structured data
    if (scheduleData.type === 'pickup' && scheduleData.locationDetails && scheduleData.locationDetails.coordinates) {
      const { lat, lng } = scheduleData.locationDetails.coordinates;
      
      // This is Google Calendar API structured location data format
      event.location = scheduleData.location;
      event.source = {
        url: `https://maps.google.com/?q=${lat},${lng}`,
        title: 'View on Google Maps'
      };
    }
    
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
 * Creates a Google Calendar event for a delivery
 * @param {Object} orderData - The order data with delivery details
 * @returns {Promise<Object>} The created event
 */
async function createDeliveryCalendarEvent(orderData) {
  try {
    const { calendar, calendarId, mock } = await getCalendarClient();
    
    if (mock) {
      console.log('Using mock calendar client for delivery event');
      return {
        id: `mock-delivery-event-${Date.now()}`,
        htmlLink: 'https://calendar.google.com/mock-event',
        summary: `Delivery for ${orderData.customerName || 'Customer'}`
      };
    }
    
    if (!calendar) {
      console.error('Failed to initialize Google Calendar client');
      return null;
    }
    
    const { deliveryInfo, orderId, id } = orderData;
    // Use either id or orderId, whichever is provided
    const orderIdentifier = orderId || id;
    
    if (!orderIdentifier) {
      console.error('No order ID provided for delivery calendar event');
      throw new Error('Missing order ID for calendar event');
    }
    
    // Parse the delivery date properly
    const deliveryDate = parseDeliveryDate(deliveryInfo.date);
    if (!deliveryDate) {
      console.error('Invalid delivery date:', deliveryInfo.date);
      throw new Error('Invalid delivery date');
    }
    
    console.log(`Creating sequential delivery event for date: ${deliveryDate.toISOString()}`);
    
    // Get date components in UTC to ensure correct day
    const year = deliveryDate.getUTCFullYear();
    const month = deliveryDate.getUTCMonth();
    const day = deliveryDate.getUTCDate();
    
    // Create date range for the delivery day (midnight to midnight in local timezone)
    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59));
    
    // 1. Find the delivery availability event for this date
    console.log(`Searching for delivery availability event on ${startOfDay.toISOString().split('T')[0]}`);
    const availabilityEvents = await calendar.events.list({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      q: 'Hearthfire Farm Delivery Availability'
    });
    
    let availabilityEvent = null;
    if (availabilityEvents.data.items && availabilityEvents.data.items.length > 0) {
      // Find the delivery availability event
      availabilityEvent = availabilityEvents.data.items.find(event => 
        event.summary && event.summary.includes('Delivery Availability')
      );
    }
    
    if (!availabilityEvent) {
      console.error('No delivery availability event found for selected date');
      // If we can't find the availability event, fall back to using fixed times based on selected time slot
      const timeSlot = getTimeSlotHours(deliveryInfo.timeSlot);
      const chicagoToUTCOffset = 5; // Adjust for timezone
      
    const startDate = new Date(Date.UTC(year, month, day, timeSlot.startHour + chicagoToUTCOffset, 0, 0));
      const endDate = new Date(startDate);
      endDate.setTime(startDate.getTime() + (1.5 * 60 * 60 * 1000)); // 1.5 hours later
      
      console.log(`No availability event found. Using fallback time slot: ${startDate.toISOString()} - ${endDate.toISOString()}`);
      
      // Use these times to create the event
      return await createDeliveryEventWithTimes(
        orderData, 
        orderIdentifier, 
        startDate, 
        endDate, 
        calendar, 
        calendarId
      );
    }
    
    // 2. Find existing delivery events for this day
    console.log(`Searching for existing delivery events on ${startOfDay.toISOString().split('T')[0]}`);
    const deliveryEvents = await calendar.events.list({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      q: 'Delivery #'
    });
    
    // Parse availability event start/end times
    const availabilityStart = new Date(availabilityEvent.start.dateTime || `${availabilityEvent.start.date}T09:00:00`);
    const availabilityEnd = new Date(availabilityEvent.end.dateTime || `${availabilityEvent.start.date}T17:00:00`);
    
    console.log(`Delivery availability window: ${availabilityStart.toISOString()} - ${availabilityEnd.toISOString()}`);
    
    // 3. Calculate the next available time slot
    let newDeliveryStart;
    let newDeliveryEnd;
    
    if (!deliveryEvents.data.items || deliveryEvents.data.items.length === 0) {
      // If no existing deliveries, start at the beginning of the availability window
      console.log('No existing delivery events found, starting from availability window start');
      newDeliveryStart = new Date(availabilityStart);
    } else {
      // Find the latest end time of existing delivery events
      console.log(`Found ${deliveryEvents.data.items.length} existing delivery events`);
      
      // Sort events by end time
      const sortedEvents = deliveryEvents.data.items
        .filter(event => event.end && event.end.dateTime) // Ensure event has end time
        .sort((a, b) => {
          const aEnd = new Date(a.end.dateTime);
          const bEnd = new Date(b.end.dateTime);
          return bEnd - aEnd; // Sort descending (latest end time first)
        });
      
      if (sortedEvents.length > 0) {
        // Start the new delivery right after the last one ends
        const lastEndTime = new Date(sortedEvents[0].end.dateTime);
        console.log(`Latest delivery ends at: ${lastEndTime.toISOString()}`);
        newDeliveryStart = new Date(lastEndTime);
      } else {
        // Fallback if we have events but couldn't sort them properly
        newDeliveryStart = new Date(availabilityStart);
      }
    }
    
    // Calculate end time (1.5 hours after start)
    newDeliveryEnd = new Date(newDeliveryStart);
    newDeliveryEnd.setTime(newDeliveryStart.getTime() + (1.5 * 60 * 60 * 1000)); // 1.5 hours later
    
    // Check if the calculated delivery time is within the availability window
    if (newDeliveryEnd > availabilityEnd) {
      console.warn('Calculated delivery time extends beyond availability window');
      // Adjust to fit within the availability window if needed
      if (newDeliveryStart >= availabilityEnd) {
        // If we can't fit the delivery in the window, use the general day's time slot
        console.log('No more room in availability window, using general day slot');
        newDeliveryStart = new Date(availabilityStart);
        newDeliveryEnd = new Date(newDeliveryStart);
        newDeliveryEnd.setTime(newDeliveryStart.getTime() + (1.5 * 60 * 60 * 1000));
      }
    }
    
    console.log(`Scheduled new delivery for: ${newDeliveryStart.toISOString()} - ${newDeliveryEnd.toISOString()}`);
    
    // 4. Create the delivery event with calculated times
    return await createDeliveryEventWithTimes(
      orderData, 
      orderIdentifier, 
      newDeliveryStart, 
      newDeliveryEnd, 
      calendar, 
      calendarId
    );
  } catch (error) {
    console.error('Error creating Google Calendar event:', error.message);
    throw error;
  }
}

/**
 * Helper function to create a delivery event with specified times
 * @private
 */
async function createDeliveryEventWithTimes(orderData, orderIdentifier, startDate, endDate, calendar, calendarId) {
  const { deliveryInfo } = orderData;
    
    const formatAddress = function(addressObj) {
      if (!addressObj) return '';
      
      const { street, city, state, zipCode, zip } = addressObj;
      return `${street}, ${city}, ${state} ${zipCode || zip}`;
    };
    
    const address = formatAddress(deliveryInfo.address);
  
  // Get human-readable time range for the event summary
  const formatTimeRange = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };
  
  const timeRangeText = `${formatTimeRange(startDate)} - ${formatTimeRange(endDate)}`;
    
    const formatDeliveryDescription = function(orderData) {
    const { deliveryInfo, items, orderId, id, customerName, customerEmail, customerPhone, 
              subtotal, deliveryFee, tax, total } = orderData;
      
    // Use either orderId or id, whichever is provided
    const orderIdentifier = orderId || id;
    
      // Format items for the description
      const itemsList = items?.map(item => 
        `${item.quantity} x ${item.name} ($${item.price} each)`
      ).join('\n') || 'No items';
      
      // Format phone as clickable link
      const phone = customerPhone || deliveryInfo?.phone || 'N/A';
      const phoneWithLink = phone !== 'N/A' ? phoneToLink(phone) : 'N/A';
      
      // Create a detailed description with order information
      return `
Order ID: ${orderIdentifier}
Customer: ${customerName || 'N/A'}
Email: ${customerEmail || 'N/A'}
Phone: ${phoneWithLink}

Delivery Address:
${address}

Items:
${itemsList}

Subtotal: $${subtotal || '0.00'}
Delivery Fee: $${deliveryFee || '0.00'}
Tax: $${tax || '0.00'}
Total: $${total || '0.00'}

Special Instructions: ${deliveryInfo.instructions || deliveryInfo.specialInstructions || 'None'}

-----
Estimated delivery time: 1.5 hours
Scheduled window: ${timeRangeText}
Google Maps Directions: https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}
`;
    };
    
    const event = {
    summary: `Delivery #${orderIdentifier.substring(6)} - ${timeRangeText}`,
      location: address,
      description: formatDeliveryDescription(orderData),
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'America/Chicago',
      },
      end: {
        dateTime: endDate.toISOString(),
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
    return {
      id: response.data.id,
      htmlLink: response.data.htmlLink,
      summary: response.data.summary
    };
}

/**
 * Parse time slots from event description
 * @param {string} description - Event description containing slot information
 * @returns {Array} Array of time slot objects
 */
function parseTimeSlots(description) {
  try {
    // Default slots if we can't parse the description
    const defaultSlots = [
      {
        id: 'morning',
        name: 'Morning',
        time: '9am - 12pm',
        available: true,
        maxOrders: 2,
        currentOrders: 0
      },
      {
        id: 'afternoon',
        name: 'Afternoon',
        time: '1pm - 5pm',
        available: true,
        maxOrders: 3,
        currentOrders: 0
      }
    ];
    
    if (!description) {
      console.log('No description to parse time slots from, using defaults');
      return defaultSlots;
    }
    
    // Try to extract slots from description
    // Example format in description: "Morning (9am - 12pm): Max capacity 2 deliveries"
    const slots = [];
    const slotRegex = /([A-Za-z]+)\s*\(([^)]+)\):\s*Max capacity\s*(\d+)/g;
    
    let match;
    while ((match = slotRegex.exec(description)) !== null) {
      const slotName = match[1].trim();
      const slotTime = match[2].trim();
      const maxOrders = parseInt(match[3], 10) || 2;
      
      // Generate a consistent ID from the name
      const slotId = slotName.toLowerCase().replace(/\s+/g, '-');
      
      slots.push({
        id: slotId,
        name: slotName,
        time: slotTime,
        available: true,
        maxOrders,
        currentOrders: 0
      });
    }
    
    // If no slots found in the description, use defaults
    if (slots.length === 0) {
      console.log('No slots found in description, using defaults');
      return defaultSlots;
    }
    
    return slots;
  } catch (error) {
    console.error('Error parsing time slots from description:', error);
    return [
      {
        id: 'morning',
        name: 'Morning',
        time: '9am - 12pm',
        available: true,
        maxOrders: 2,
        currentOrders: 0
      },
      {
        id: 'afternoon',
        name: 'Afternoon',
        time: '1pm - 5pm',
        available: true,
        maxOrders: 3,
        currentOrders: 0
      }
    ];
  }
}

/**
 * Extract note from event description
 * @param {string} description - Event description
 * @returns {string} Extracted note
 */
function extractNoteFromDescription(description) {
  if (!description) return '';
  
  // Look for a "Notes:" section
  const notesMatch = description.match(/Notes:\s*([^]*?)(?:\n\n|\n*$)/i);
  if (notesMatch && notesMatch[1]) {
    return notesMatch[1].trim();
  }
  
  return '';
}

/**
 * Get delivery schedules from Google Calendar
 * @param {string} timeMin - Start time (ISO string)
 * @param {string} timeMax - End time (ISO string)
 * @returns {Promise<Array>} Delivery schedules
 */
export async function getDeliverySchedulesFromCalendar(timeMin, timeMax) {
  try {
    console.log('Fetching delivery schedules from Google Calendar');
    const { calendar, calendarId, mock } = await getCalendarClient();
    
    if (mock) {
      console.log('Using mock calendar client for getDeliverySchedulesFromCalendar');
      return createMockDeliverySchedules();
    }
    
    // List events from calendar within the time range
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100
    });
    
    const events = response.data.items;
    console.log(`Found ${events.length} total events in Google Calendar, filtering for delivery availability events...`);
    
    // Log all events for debugging
    events.forEach(event => {
      console.log(`Calendar event: ${event.summary} (${event.id})`);
    });
    
    // Filter for delivery availability events (not delivery orders)
    const availabilityEvents = events.filter(event => 
      event.summary && event.summary.includes('Availability') && 
      !event.summary.includes('Delivery #') && !event.summary.includes('Order #')
    );
    
    // Process each availability event
    const schedules = [];
    
    for (const event of availabilityEvents) {
      try {
        // Get the event date (prefer dateTime over date for more precision)
        const startDate = new Date(event.start.dateTime || event.start.date);
        console.log(`Processing event ${event.id} with start date: ${startDate.toISOString()}, using date: ${startDate.toDateString()}`);
        
        // Determine if this is a pickup event or delivery event
        const isPickupEvent = event.summary && event.summary.includes('Pickup');
        console.log(`Event type: ${isPickupEvent ? 'Pickup' : 'Delivery'}`);
        
        // Try to parse time slots from the event description if it exists
        let slots = [];
        if (event.description) {
          try {
            console.log('Attempting to parse time slots from description');
            slots = parseTimeSlots(event.description);
            console.log(`Parsed ${slots.length} slots from description`);
          } catch (parseError) {
            console.error('Error parsing time slots from description:', parseError);
            console.log('Falling back to default slots');
            slots = [];
          }
        } else {
          console.log('No description to parse time slots from, using defaults');
        }
        
        // If no slots could be parsed, use appropriate defaults based on event type
        if (!slots || slots.length === 0) {
          if (isPickupEvent) {
            // For pickup events, use a single time slot
            console.log('Using default single pickup time slot');
            slots = [
              {
                id: 'pickup-window',
                name: 'Pickup Window',
                time: '9am-3pm',
                available: true,
                maxOrders: 999, // Unlimited capacity for pickup events
                currentOrders: 0
              }
            ];
          } else {
            // For delivery events, use standard morning/afternoon slots
            console.log('Using default delivery time slots');
          slots = [
            {
              id: 'morning',
              name: 'Morning',
              time: '9am - 12pm',
              available: true,
              maxOrders: 2,
              currentOrders: 0
            },
            {
              id: 'afternoon',
              name: 'Afternoon',
              time: '1pm - 5pm',
              available: true,
              maxOrders: 3,
              currentOrders: 0
            }
          ];
          }
        } else if (isPickupEvent && slots.length > 1) {
          // If it's a pickup event but we somehow got multiple slots, use only the first one
          console.log('Pickup event has multiple slots, using only the first one');
          slots = [slots[0]];
        }
        
        // Create the schedule object
        schedules.push({
          id: event.id,
          date: startDate.toISOString(),
          type: isPickupEvent ? 'pickup' : 'delivery', // Add explicit type field
          slots,
          location: event.location || '',
          zipCodes: isPickupEvent ? [] : (event.location ? event.location.split(',').map(s => s.trim()) : []),
          cutoffTime: '6pm day before', // Default cutoff time
          googleCalendarEventId: event.id,
          note: event.description || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (eventError) {
        console.error(`Error processing event ${event.id}:`, eventError);
      }
    }
    
    if (schedules.length === 0) {
      console.log('No delivery schedules found in Google Calendar');
      return [];
    }
    
    // Get current order counts for each schedule
    for (const schedule of schedules) {
      try {
        const scheduleDate = new Date(schedule.date);
        
        for (let i = 0; i < schedule.slots.length; i++) {
          const slot = schedule.slots[i];
          
          // Count delivery events for this slot
          console.log(`Counting orders for ${scheduleDate.toDateString()} - ${slot.id}`);
          const orderCount = await countDeliveryEventsForSlot(scheduleDate, slot.id);
          
          console.log(`Found ${orderCount} orders for ${slot.id} slot`);
          
          // Update slot with current order count
          schedule.slots[i] = {
            ...slot,
            currentOrders: orderCount,
            available: orderCount < slot.maxOrders // Update availability based on current orders
          };
        }
      } catch (countError) {
        console.error(`Error counting orders for schedule ${schedule.id}:`, countError);
      }
    }
    
    console.log(`Returning ${schedules.length} schedules from Google Calendar`);
    return schedules;
  } catch (error) {
    console.error('Error fetching events from Google Calendar:', error);
    return []; // Return empty array on error
  }
}

// Helper function to create mock delivery schedules for development
function createMockDeliverySchedules() {
  // Create some mock delivery schedules for testing
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  return [
    {
      id: 'mock-schedule-1',
      date: tomorrow.toISOString().split('T')[0],
      timeSlots: [
        {
          id: 'morning',
          name: 'Morning',
          time: '9am - 12pm',
          available: true,
          maxOrders: 2,
          currentOrders: 0
        },
        {
          id: 'afternoon',
          name: 'Afternoon',
          time: '1pm - 5pm',
          available: true,
          maxOrders: 3,
          currentOrders: 1
        }
      ],
      zipCodes: ['12345', '23456', '34567'],
      available: true,
      note: 'This is a mock delivery schedule for testing.'
    },
    {
      id: 'mock-schedule-2',
      date: nextWeek.toISOString().split('T')[0],
      timeSlots: [
        {
          id: 'morning',
          name: 'Morning',
          time: '9am - 12pm',
          available: true,
          maxOrders: 2,
          currentOrders: 0
        },
        {
          id: 'afternoon',
          name: 'Afternoon',
          time: '1pm - 5pm',
          available: true,
          maxOrders: 3,
          currentOrders: 0
        }
      ],
      zipCodes: ['12345', '23456', '34567'],
      available: true,
      note: 'Another mock delivery schedule for next week.'
    }
  ];
}

/**
 * Update an existing availability event on the calendar
 * @param {string} eventId - The Google Calendar event ID
 * @param {Object} scheduleData - Updated schedule data
 * @returns {Promise<Object>} Updated event
 */
export async function updateAvailabilityEvent(eventId, scheduleData) {
  try {
    const { calendar, calendarId } = await getCalendarClient();
    
    // Format the description with slot information
    const slotsDescription = scheduleData.slots.map(slot => {
      const timeRange = slot.time;
      const capacity = slot.maxOrders;
      const estimatedTime = scheduleData.type === 'delivery' ? "1.5 hours per delivery" : "15 minutes per pickup";
      return `- ${slot.name || slot.time} (${timeRange}): Max capacity ${capacity} ${scheduleData.type === 'delivery' ? 'deliveries' : 'pickups'}\n  Estimated time: ${estimatedTime}`;
    }).join('\n');
    
    let locationStr = '';
    let descriptionStr = '';
    let summaryStr = '';
    
    if (scheduleData.type === 'delivery') {
      summaryStr = 'Hearthfire Farm Delivery Availability';
      locationStr = `Zip codes: ${scheduleData.zipCodes.join(', ')}`;
      descriptionStr = `Delivery day with the following time slots:\n${slotsDescription}\n\nServing zip codes: ${scheduleData.zipCodes.join(', ')}\n\nNotes:\n- Each delivery takes approximately 1.5 hours\n- Once a time slot reaches its maximum capacity, it will no longer be available for new orders`;
    } else if (scheduleData.type === 'pickup') {
      summaryStr = 'Hearthfire Farm Pickup Availability';
      locationStr = scheduleData.location;
      
      // Add location with Google Maps link if coordinates are available
      let locationInfo = scheduleData.location;
      if (scheduleData.locationDetails && scheduleData.locationDetails.coordinates) {
        const { lat, lng } = scheduleData.locationDetails.coordinates;
        locationInfo += `\nGoogle Maps: https://maps.google.com/?q=${lat},${lng}`;
      }
      
      descriptionStr = `Farm pickup day with the following time slots:\n${slotsDescription}\n\nPickup location: ${locationInfo}\n\nNotes:\n- Each pickup takes approximately 15 minutes\n- Once a time slot reaches its maximum capacity, it will no longer be available for new orders`;
    }
    
    const dateKey = getCalendarDateKey(scheduleData.date);
    if (!dateKey) {
      throw new Error('Invalid schedule date');
    }

    // Create the event update
    const event = {
      summary: summaryStr,
      location: locationStr,
      description: descriptionStr,
      start: {
        date: dateKey,
      },
      end: {
        date: addDaysToDateKey(dateKey, 1),
      },
      // Use different colors for delivery vs pickup
      colorId: scheduleData.type === 'delivery' ? '1' : '4', // 1 = Blue (delivery), 4 = Purple (pickup)
    };
    
    // For pickup events with coordinates, add location as structured data
    if (scheduleData.type === 'pickup' && scheduleData.locationDetails && scheduleData.locationDetails.coordinates) {
      const { lat, lng } = scheduleData.locationDetails.coordinates;
      
      // This is Google Calendar API structured location data format
      event.location = scheduleData.location;
      event.source = {
        url: `https://maps.google.com/?q=${lat},${lng}`,
        title: 'View on Google Maps'
      };
    }
    
    const response = await calendar.events.update({
      calendarId,
      eventId,
      resource: event,
    });
    
    return response.data;
  } catch (error) {
    console.error('Error updating availability event:', error);
    throw new Error('Failed to update availability event');
  }
}

/**
 * Delete an event from Google Calendar
 * @param {string} eventId - The Google Calendar event ID
 * @returns {Promise<void>}
 */
export async function deleteEvent(eventId) {
  try {
    const { calendar, calendarId } = await getCalendarClient();
    
    await calendar.events.delete({
      calendarId,
      eventId
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    throw new Error('Failed to delete event');
  }
}

/**
 * Count the number of delivery events for a specific date and time slot
 * @param {string|object} date - The date to check (can be ISO string, Date object, or Firestore timestamp)
 * @param {string} timeSlot - The time slot identifier ('morning' or 'afternoon')
 * @returns {Promise<number>} The number of delivery events found
 */
// Cache for event fetching by date to prevent recursive loops
const eventCacheByDate = new Map();

export async function countDeliveryEventsForSlot(date, timeSlot) {
  try {
    console.log(`Counting delivery events for ${date} - ${timeSlot}`);
    
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
    
    // Create date range for the specific date (entire day)
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);
    
    const cacheKey = startOfDay.toISOString().split('T')[0];
    console.log(`Date range for search: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
    
    // Use cached events if available to prevent repeated API calls
    let events;
    if (eventCacheByDate.has(cacheKey)) {
      events = eventCacheByDate.get(cacheKey);
      console.log(`Using cached events for ${dateObj.toDateString()} (${events.length} events)`);
    } else {
      // Get all events for that day
      events = await listEvents({
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        maxResults: 100 // Increased limit to ensure we get all events
      });
      
      // Cache the results to avoid repeated calls
      eventCacheByDate.set(cacheKey, events);
      console.log(`Found ${events.length} total events on ${dateObj.toDateString()} (cached for future use)`);
    }
    
    // Log all events for debugging
    events.forEach(event => {
      console.log(`Event: ID=${event.id}, Summary="${event.summary}", Start=${event.start?.dateTime || event.start?.date}`);
    });
    
    // Filter to only include delivery events (not availability events)
    // and only those for the requested time slot
    const deliveryEvents = events.filter(event => {
      // Check if this is a delivery event (not an availability event)
      const isDeliveryEvent = event.summary && 
        (event.summary.includes('Delivery #') || event.summary.includes('Order #')) && 
        !event.summary.includes('Availability');
      
      if (!isDeliveryEvent) {
        return false;
      }
      
      console.log(`Found delivery event: ${event.summary}, checking if it matches ${timeSlot} slot`);
      
      // Check if it's for the requested time slot based on summary and time
      const eventSummary = event.summary.toLowerCase();
      
      if (timeSlot === 'morning') {
        // Check for morning slot: explicitly says "morning", or has 9am time, or starts before noon
        return eventSummary.includes('morning') || 
               eventSummary.includes('9am') || 
               eventSummary.includes('9am-12pm') || 
               (event.start.dateTime && new Date(event.start.dateTime).getHours() < 12);
      } else if (timeSlot === 'afternoon') {
        // Check for afternoon slot: explicitly says "afternoon", or has 1pm time, or starts after noon
        return eventSummary.includes('afternoon') || 
               eventSummary.includes('1pm') || 
               eventSummary.includes('1pm-5pm') || 
               (event.start.dateTime && new Date(event.start.dateTime).getHours() >= 12);
      }
      
      // If timeSlot doesn't match known patterns, default to not matching
      return false;
    });
    
    console.log(`Found ${deliveryEvents.length} matching delivery events for ${timeSlot} on ${dateObj.toDateString()}`);
    
    // Log the matched events for debugging
    deliveryEvents.forEach(event => {
      console.log(`Matched delivery event: ${event.summary} (${event.id})`);
    });
    
    return deliveryEvents.length;
  } catch (error) {
    console.error('Error counting delivery events:', error);
    return 0; // Return 0 if there's an error to avoid breaking the app
  }
}

/**
 * Reset the calendar client (useful after changing settings)
 */
export async function resetCalendarClient() {
  client = null;
  return getCalendarClient();
}

// Add a reinitialize method to the Google Calendar service
const reinitialize = () => {
  console.log('Reinitializing Google Calendar client');
  client = null; // Clear the existing client
  return getCalendarClient(); // Create a new client with current settings
};

// Add a function to create mock events
function createMockEvents() {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);
  
  return [
    {
      id: 'mock-event-1',
      summary: 'Hearthfire Farm Delivery Availability',
      description: 'Mock delivery availability event',
      start: { dateTime: tomorrow.toISOString() },
      end: { dateTime: new Date(tomorrow.getTime() + 86400000).toISOString() }
    },
    {
      id: 'mock-event-2',
      summary: 'Hearthfire Farm Delivery Availability',
      description: 'Mock delivery availability event',
      start: { dateTime: nextWeek.toISOString() },
      end: { dateTime: new Date(nextWeek.getTime() + 86400000).toISOString() }
    }
  ];
}

/**
 * Extract coordinates from event description
 * @param {string} description Event description text
 * @returns {Object|null} Coordinates object with lat and lng or null
 */
function extractCoordinatesFromDescription(description) {
  if (!description) return null;
  
  // Look for coordinates in format [lat:33.749,lng:-84.388] in the description
  const coordsMatch = description.match(/\[lat:([-\d.]+),lng:([-\d.]+)\]/);
  if (coordsMatch && coordsMatch.length >= 3) {
    return {
      lat: parseFloat(coordsMatch[1]),
      lng: parseFloat(coordsMatch[2])
    };
  }
  
  return null;
}

/**
 * Create mock pickup locations for development
 * @returns {Array} Array of mock pickup location objects
 */
function createMockPickupLocations() {
  // Mock Atlanta area pickup locations
  const today = new Date();
  const locations = [];
  
  // Create pickup events for the next 4 weeks (weekends only)
  for (let week = 0; week < 4; week++) {
    // Saturday pickup (10am-2pm)
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + (6 - today.getDay()) + (week * 7));
    saturday.setHours(10, 0, 0, 0);
    
    // Sunday pickup (11am-3pm)
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    sunday.setHours(11, 0, 0, 0);
    
    // Add both locations for each day
    [saturday, sunday].forEach((date, dayIndex) => {
      // Peachtree Farmers Market
      locations.push({
        id: `pickup-peachtree-${date.toISOString().split('T')[0]}`,
        title: `Peachtree Farmers Market Pickup`,
        location: {
          name: 'Peachtree Farmers Market',
          address: '2744 Peachtree Rd NE, Atlanta, GA 30305',
          coordinates: {
            lat: 33.824813,
            lng: -84.389721
          }
        },
        date: date,
        startTime: dayIndex === 0 ? '10:00 AM' : '11:00 AM',
        endTime: dayIndex === 0 ? '2:00 PM' : '3:00 PM',
        description: 'Pickup your order at our booth at the Peachtree Farmers Market'
      });
      
      // Grant Park Farmers Market
      locations.push({
        id: `pickup-grant-${date.toISOString().split('T')[0]}`,
        title: `Grant Park Farmers Market Pickup`,
        location: {
          name: 'Grant Park Farmers Market',
          address: '600 Cherokee Ave SE, Atlanta, GA 30312',
          coordinates: {
            lat: 33.736256,
            lng: -84.372443
          }
        },
        date: date,
        startTime: dayIndex === 0 ? '10:00 AM' : '11:00 AM',
        endTime: dayIndex === 0 ? '2:00 PM' : '3:00 PM',
        description: 'Pickup your order at our booth at the Grant Park Farmers Market'
      });
    });
  }
  
  return locations;
}

// Get pickup locations from Google Calendar
export async function getPickupLocationsFromCalendar(timeMin, timeMax, useRealData = true) {
  try {
    // NEVER use mock data - always use real calendar data
    console.log('Fetching pickup events from Google Calendar with real data (mock data disabled)');
    const { calendar, calendarId } = await getCalendarClient();
    
    if (!calendar || !calendarId) {
      throw new Error('Calendar client or calendar ID not available');
    }
    
    // Query for pickup availability events
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100
    });
    
    // Get events from response
    const events = response.data.items || [];
    
    // Filter events that are ONLY pure availability events (not order events)
    // Pure availability events have "Pickup Availability" in their title but DON'T have an order number prefix
    const pickupEvents = events.filter(event => 
      event.summary && 
      event.summary.includes('Pickup Availability') && 
      !event.summary.includes('Pickup #') // Exclude pickup order events
    );
    
    // Log event count and details for debugging
    console.log(`Found ${pickupEvents.length} pickup availability events in calendar`);
    if (pickupEvents.length > 0) {
      pickupEvents.forEach((event, index) => {
        console.log(`Pickup availability event ${index + 1}:`, {
          summary: event.summary,
          start: event.start.dateTime || event.start.date,
          location: event.location || 'No location specified'
        });
      });
    } else {
      console.warn('No pickup availability events found in Google Calendar. Please add a "Pickup Availability" event to your Google Calendar.');
      return []; // Return empty array - never use mock data
    }
    
    // Map events to pickup locations with geocoding
    const mappedLocations = await Promise.all(pickupEvents.map(async event => {
      // Extract coordinates from description if available
      const coordinates = extractCoordinatesFromDescription(event.description);
      
      // Format start and end times
      const startTime = event.start.dateTime ? formatTime(new Date(event.start.dateTime)) : '';
      const endTime = event.end.dateTime ? formatTime(new Date(event.end.dateTime)) : '';
      
      // Store the original time strings to ensure we have the exact same format as in Google Calendar
      let originalTimeString = '';
      if (event.start.dateTime && event.end.dateTime) {
        const startDate = new Date(event.start.dateTime);
        const endDate = new Date(event.end.dateTime);
        
        // Format time exactly as it appears in Google Calendar
        const formatTimeForDisplay = (date) => {
          const hours = date.getHours();
          const minutes = date.getMinutes();
          const ampm = hours >= 12 ? 'pm' : 'am';
          const displayHour = hours % 12 || 12; // Convert 0 to 12 for 12 AM
          return `${displayHour}${minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''}${ampm}`;
        };
        
        originalTimeString = `${formatTimeForDisplay(startDate)} - ${formatTimeForDisplay(endDate)}`;
        console.log(`Created exact time string from event: ${originalTimeString}`);
      }
      
      // Extract date
      let date;
      if (event.start.dateTime) {
        // For dateTime format, create a date object and normalize to YYYY-MM-DD
        date = new Date(event.start.dateTime);
        console.log(`Parsed date from dateTime: ${date} (${date.toISOString()})`);
      } else if (event.start.date) {
        // For date-only format, parse directly
        date = new Date(event.start.date);
        console.log(`Parsed date from date-only: ${date} (${date.toISOString()})`);
      } else {
        console.warn('Event has no valid date information:', event.summary);
        date = new Date(); // Fallback to today
      }
      
      // Get location details
      const locationAddress = event.location || 'Unknown Location';
      
      // If coordinates weren't found in the description, geocode the address
      let locationCoords = coordinates;
      if (!locationCoords && locationAddress && locationAddress !== 'Unknown Location') {
        try {
          // Use Google Maps Geocoding API directly
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationAddress)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
          const geocodeResponse = await fetch(geocodeUrl);
          const geocodeData = await geocodeResponse.json();
          
          if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
            const { lat, lng } = geocodeData.results[0].geometry.location;
            locationCoords = { lat, lng };
            console.log(`Geocoded "${locationAddress}" to [${lat}, ${lng}]`);
          } else {
            console.warn(`Failed to geocode "${locationAddress}": ${geocodeData.status}`);
          }
        } catch (error) {
          console.error(`Error geocoding "${locationAddress}":`, error);
        }
      }
      
      // Default location only as absolute last resort
      if (!locationCoords) {
        console.warn(`Using default coordinates for "${locationAddress}"`);
        locationCoords = {
          lat: 33.749,
          lng: -84.388
        };
      }
      
      // Extract any special instructions from the description
      let specialInstructions = '';
      if (event.description) {
        const instructionsMatch = event.description.match(/Instructions:\s*(.*?)(?:\n\n|\n*$)/i);
        if (instructionsMatch && instructionsMatch[1]) {
          specialInstructions = instructionsMatch[1].trim();
        }
      }
      
      return {
        id: event.id,
        title: event.summary,
        location: {
          name: event.location ? event.location.split(',')[0] : 'Pickup Location',
          address: locationAddress,
          coordinates: locationCoords
        },
        date: date,
        startTime: startTime,
        endTime: endTime,
        // Use the original time string to ensure exact match with Google Calendar
        timeString: originalTimeString || `${startTime} - ${endTime}`,
        // Store the raw datetime values for precise time extraction
        rawStartDateTime: event.start.dateTime,
        rawEndDateTime: event.end.dateTime,
        description: event.description || 'Pickup your farm-fresh order',
        instructions: specialInstructions || 'No special instructions'
      };
    }));
    
    // Log the final mapped locations for debugging
    console.log(`Mapped ${mappedLocations.length} pickup locations with dates:`);
    const uniqueDates = new Set();
    mappedLocations.forEach(location => {
      const dateStr = location.date.toISOString().split('T')[0];
      uniqueDates.add(dateStr);
      console.log(`Location: ${location.title}, Date: ${dateStr}, Time: ${location.startTime}-${location.endTime}`);
    });
    console.log(`Found ${uniqueDates.size} unique pickup dates`);
    
    return mappedLocations;
  } catch (error) {
    console.error('Error fetching pickup locations:', error);
    // Return empty array in case of error
    return [];
  }
}

/**
 * Create a calendar event for a pickup order
 * @param {Object} orderData Order data including pickup information
 * @returns {Promise<Object>} Created calendar event
 */
export async function createPickupCalendarEvent(orderData) {
  console.log('Creating pickup calendar event for order:', orderData.id);
  
  try {
    const { calendar, calendarId, mock } = await getCalendarClient();
    
    if (mock) {
      console.log('Using mock calendar client for pickup event');
      return {
        id: `mock-pickup-event-${Date.now()}`,
        htmlLink: 'https://calendar.google.com/mock-event',
        summary: `Pickup for ${orderData.customerName || 'Customer'}`
      };
    }
    
    if (!calendar || !calendarId) {
      throw new Error('Calendar client or ID not available');
    }
    
    // Fix date handling to ensure we use the exact date selected by the user
    let displayDate;
    
    // Check what format the date is in
    console.log('Pickup date type:', typeof orderData.pickupInfo.date);
    
    // If this is a date string in YYYY-MM-DD format, parse it correctly
    if (typeof orderData.pickupInfo.date === 'string') {
      if (orderData.pickupInfo.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // It's already in YYYY-MM-DD format
        const [year, month, day] = orderData.pickupInfo.date.split('-').map(Number);
        displayDate = new Date(year, month - 1, day);
        console.log('Parsed YYYY-MM-DD date:', displayDate);
      } else if (orderData.pickupInfo.date.includes('T')) {
        // It's an ISO string, extract just the date part
        const [year, month, day] = orderData.pickupInfo.date.split('T')[0].split('-').map(Number);
        displayDate = new Date(year, month - 1, day);
        console.log('Parsed ISO date:', displayDate);
      } else {
        // Try to parse as a regular date string
        displayDate = new Date(orderData.pickupInfo.date);
        console.log('Parsed date string:', displayDate);
      }
    } else if (orderData.pickupInfo.date instanceof Date) {
      // It's already a Date object
      displayDate = orderData.pickupInfo.date;
      console.log('Using Date object directly:', displayDate);
    } else {
      // Fallback - create a date for today
      displayDate = new Date();
      console.warn('Invalid date format, using today:', displayDate);
    }
    
    // Get the time from the original availability event if it exists
    // Find the availability event for this date first
    let startHour = 13; // Default to 1:00 PM
    let startMinute = 0;
    let endHour = 21; // Default to 9:00 PM
    let endMinute = 30;
    
    // Try to get the actual time from the availability event
    try {
      // First, get availability events for this date
      console.log(`Looking up availability event for pickup on date: ${displayDate.toISOString().split('T')[0]}`);
      
      const dateStart = new Date(displayDate);
      dateStart.setHours(0, 0, 0, 0);
      
      const dateEnd = new Date(displayDate);
      dateEnd.setHours(23, 59, 59, 999);
      
      const availabilityResponse = await calendar.events.list({
        calendarId: calendarId,
        timeMin: dateStart.toISOString(),
        timeMax: dateEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
      
      // Find the pickup availability event
      const availabilityEvent = availabilityResponse.data.items?.find(event => 
        event.summary && 
        event.summary.includes('Pickup Availability') && 
        !event.summary.includes('Pickup #')
      );
      
      if (availabilityEvent) {
        console.log(`Found availability event: ${availabilityEvent.summary}`);
        
        // Check if it's an all-day event
        if (availabilityEvent.start?.date) {
          console.log('This is an all-day pickup availability event');
          
          // For all-day events, set a reasonable business hours timeframe (noon to 6 PM)
          startHour = 12; // Noon
          startMinute = 0;
          endHour = 18; // 6 PM
          endMinute = 0;
          
          console.log(`Using default business hours for all-day event: ${startHour}:${startMinute} - ${endHour}:${endMinute}`);
        }
        // If it has dateTime specified, use those hours
        else if (availabilityEvent.start?.dateTime) {
          const availabilityStart = new Date(availabilityEvent.start.dateTime);
          const availabilityEnd = new Date(availabilityEvent.end.dateTime);
          
          // Extract hours and minutes directly from the availability event without timezone adjustments
          startHour = availabilityStart.getHours();
          startMinute = availabilityStart.getMinutes();
          endHour = availabilityEnd.getHours();
          endMinute = availabilityEnd.getMinutes();
          
          console.log(`Using exact availability event time: ${startHour}:${startMinute} - ${endHour}:${endMinute}`);
          console.log(`Raw availability start time: ${availabilityEvent.start.dateTime}`);
          console.log(`Raw availability end time: ${availabilityEvent.end.dateTime}`);
          
          // Store the original dateTime values to use directly when creating the event
          // This ensures we maintain the exact same timezone information
          const originalStartDateTime = availabilityEvent.start.dateTime;
          const originalEndDateTime = availabilityEvent.end.dateTime;
          
          // Extract just the time part to use with our selected date
          if (originalStartDateTime && originalEndDateTime) {
            // Parse the ISO date strings to extract just the time parts
            const startTimePart = originalStartDateTime.split('T')[1].split('.')[0];
            const endTimePart = originalEndDateTime.split('T')[1].split('.')[0];
            
            console.log(`Extracted start time part: ${startTimePart}, end time part: ${endTimePart}`);
            
            // Store these for use when creating the event
            orderData.originalStartTimePart = startTimePart;
            orderData.originalEndTimePart = endTimePart;
          }
        }
      } 
      // Check if the order's pickupInfo contains raw datetime information from when the user selected the location
      else if (orderData.pickupInfo.rawStartDateTime && orderData.pickupInfo.rawEndDateTime) {
        console.log(`No availability event found, but pickup info has raw date/time data`);
        
        // Use the raw date/time information from the pickup location selection
        const rawStartDate = new Date(orderData.pickupInfo.rawStartDateTime);
        const rawEndDate = new Date(orderData.pickupInfo.rawEndDateTime);
        
        // Extract hours and minutes directly
        startHour = rawStartDate.getHours();
        startMinute = rawStartDate.getMinutes();
        endHour = rawEndDate.getHours();
        endMinute = rawEndDate.getMinutes();
        
        console.log(`Using time from pickup location selection: ${startHour}:${startMinute} - ${endHour}:${endMinute}`);
        
        // Extract just the time part to use with our selected date
        const startTimePart = orderData.pickupInfo.rawStartDateTime.split('T')[1].split('.')[0];
        const endTimePart = orderData.pickupInfo.rawEndDateTime.split('T')[1].split('.')[0];
        
        console.log(`Extracted start time part: ${startTimePart}, end time part: ${endTimePart}`);
        
        // Store these for use when creating the event
        orderData.originalStartTimePart = startTimePart;
        orderData.originalEndTimePart = endTimePart;
      }
      // Check if timeString is available from the original pickup location selection
      else if (orderData.pickupInfo.timeString) {
        console.log(`Using timeString from pickup location selection: ${orderData.pickupInfo.timeString}`);
        
        // Default to standard hours but use the timeString for display
        startHour = 9; // 9 AM (typical opening time)
        startMinute = 0;
        endHour = 14; // 2 PM (typical closing time)
        endMinute = 0;
      }
      else {
        console.log(`No specific availability event found for ${displayDate.toISOString().split('T')[0]}, using default time (9:00 AM - 2:00 PM)`);
        
        // Update default times to match typical hours
        startHour = 9; // 9 AM (typical opening time)
        startMinute = 0;
        endHour = 14; // 2 PM (typical closing time)
        endMinute = 0;
      }
    } catch (availabilityError) {
      console.error('Error finding availability event, using default time:', availabilityError);
      
      // Update default times to be business hours
      startHour = 12; // Noon
      startMinute = 0;
      endHour = 18; // 6 PM
      endMinute = 0;
    }
    
    // Format the time strings for display
    const formatTimeString = (hour, minute) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12; // Convert 0 to 12 for 12 AM
      return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
    };

    const eventStartTime = formatTimeString(startHour, startMinute);
    const eventEndTime = formatTimeString(endHour, endMinute);
    
    // Store the exact pickup time in the order data for confirmation page and emails
    orderData.pickupInfo.time = `${eventStartTime} - ${eventEndTime}`;
    console.log(`Setting order pickup time to match availability: ${orderData.pickupInfo.time}`);

    // If this is a real order in Supabase, update the pickup time there too
    if (orderData.id && orderData.id.startsWith('order-') && process.env.NODE_ENV === 'production') {
      try {
        await supabaseAdmin
          .from('orders')
          .update({
            pickup_info: orderData.pickupInfo
          })
          .eq('id', orderData.id);
        console.log(`Updated pickup time in Supabase for order ${orderData.id}`);
      } catch (updateError) {
        console.error(`Failed to update pickup time in Supabase: ${updateError.message}`);
      }
    }

    // Create the event with explicit timezone settings
    const event = {
      summary: `Pickup #${orderData.id.substring(orderData.id.length - 8)} - Hearthfire Farm Pickup`,
      location: orderData.pickupInfo.address,
      description: formatPickupDescription({
        ...orderData,
        eventStartTime, // Pass the formatted time strings to the description generator
        eventEndTime
      }),
      start: {
        // If we have the original time parts from the availability event, use them
        // This preserves the exact same time and timezone format
        dateTime: orderData.originalStartTimePart 
          ? `${displayDate.getFullYear()}-${String(displayDate.getMonth()+1).padStart(2, '0')}-${String(displayDate.getDate()).padStart(2, '0')}T${orderData.originalStartTimePart}`
          : `${displayDate.getFullYear()}-${String(displayDate.getMonth()+1).padStart(2, '0')}-${String(displayDate.getDate()).padStart(2, '0')}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`,
        timeZone: 'America/New_York',
      },
      end: {
        // If we have the original time parts from the availability event, use them
        dateTime: orderData.originalEndTimePart 
          ? `${displayDate.getFullYear()}-${String(displayDate.getMonth()+1).padStart(2, '0')}-${String(displayDate.getDate()).padStart(2, '0')}T${orderData.originalEndTimePart}`
          : `${displayDate.getFullYear()}-${String(displayDate.getMonth()+1).padStart(2, '0')}-${String(displayDate.getDate()).padStart(2, '0')}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`,
        timeZone: 'America/New_York',
      },
      colorId: '5', // Different color from delivery events
      // Add metadata as extended properties
      extendedProperties: {
        private: {
          orderId: orderData.id,
          orderType: 'pickup',
          customerName: orderData.customerName || 'Guest',
          customerEmail: orderData.customerEmail || 'No email provided'
        }
      }
    };
    
    // Log the final event dates being used
    console.log('Event start date:', event.start.dateTime);
    console.log('Event end date:', event.end.dateTime);
    
    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event,
    });
    
    console.log('Pickup event created:', response.data.htmlLink);
    return response.data;
  } catch (error) {
    console.error('Error creating pickup calendar event:', error);
    // In development mode, return a mock success response
    if (process.env.NODE_ENV === 'development') {
      console.log('Returning mock pickup event data in development mode');
      return {
        id: `mock-pickup-event-${Date.now()}`,
        htmlLink: 'https://calendar.google.com/mock-event',
        summary: `Pickup for ${orderData.customerName || 'Customer'}`
      };
    }
    throw error;
  }
}

/**
 * Format pickup description for calendar event
 * @param {Object} orderData Order data
 * @returns {string} Formatted description
 */
function formatPickupDescription(orderData) {
  // Create a nicely formatted header with an emoji
  let description = `🌱 PICKUP ORDER #${orderData.id} 🌱\n\n`;
  
  // Add customer information
  description += `📋 CUSTOMER INFORMATION:\n`;
  description += `• Name: ${orderData.customerName || 'Guest'}\n`;
  description += `• Email: ${orderData.customerEmail || 'No email provided'}\n`;
  description += `• Phone: ${orderData.customerPhone || 'No phone provided'}\n\n`;
  
  // Add pickup information with clear date formatting
  description += `📍 PICKUP DETAILS:\n`;
  description += `• Location: ${orderData.pickupInfo.locationName}\n`;
  
  // Format date nicely using the native Date formatter
  const pickupDate = new Date(orderData.pickupInfo.date);
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  
  description += `• Date: ${pickupDate.toLocaleDateString('en-US', dateOptions)}\n`;
  
  // For pickup time, priority:
  // 1. Use the event start/end time if available (from the availability event)
  // 2. Use the pickupInfo.time if already set
  // 3. Default to standard business hours
  let pickupTime;
  if (orderData.eventStartTime && orderData.eventEndTime) {
    pickupTime = `${orderData.eventStartTime} - ${orderData.eventEndTime}`;
  } else if (orderData.pickupInfo && orderData.pickupInfo.time) {
    pickupTime = orderData.pickupInfo.time;
  } else {
    pickupTime = '12:00 PM - 6:00 PM';
  }
  
  description += `• Time: ${pickupTime}\n`;
  
  // Add location address
  description += `• Address: ${orderData.pickupInfo.address || 'Address not provided'}\n\n`;
  
  // Add order items with clearer formatting
  description += `🛒 ORDER ITEMS:\n`;
  if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
  orderData.items.forEach(item => {
      const itemTotal = (parseFloat(item.price) * parseFloat(item.quantity)).toFixed(2);
      description += `• ${item.quantity}× ${item.name} ($${item.price} each) = $${itemTotal}\n`;
    });
  } else {
    description += `• No items found in order data\n`;
  }
  
  // Add order total with better formatting
  description += `\n💰 ORDER SUMMARY:\n`;
  description += `• Subtotal: $${parseFloat(orderData.subtotal || 0).toFixed(2)}\n`;
  description += `• Tax: $${parseFloat(orderData.tax || 0).toFixed(2)}\n`;
  if (orderData.deliveryFee) {
    description += `• Pickup Fee: $${parseFloat(orderData.deliveryFee || 0).toFixed(2)}\n`;
  }
  description += `• Total: $${parseFloat(orderData.total || 0).toFixed(2)}\n`;
  
  // Add special instructions if any
  if (orderData.pickupInfo.instructions) {
    description += `\n📝 SPECIAL INSTRUCTIONS:\n${orderData.pickupInfo.instructions}\n`;
  }
  
  // Add direct links to the order with better formatting
  description += `\n---------------------------\n`;
  description += `🔗 ORDER LINKS:\n`;
  description += `• Customer Order: https://hearthfire-farm.web.app/orders/${orderData.id}\n`;
  description += `• Admin Order: https://hearthfire-farm.web.app/admin/orders/${orderData.id}\n`;
  
  return description;
}

// Helper for formatting dates/times consistently
function formatDate(date) {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

// Export methods
export default {
  getCalendarClient,
  listEvents,
  createAvailabilityEvent,
  createDeliveryEvent: createDeliveryCalendarEvent,
  createDeliveryCalendarEvent, // Add direct export of the function
  getDeliverySchedulesFromCalendar,
  updateAvailabilityEvent,
  countDeliveryEventsForSlot,
  reinitialize,
  getPickupLocationsFromCalendar,
  createPickupCalendarEvent: createPickupCalendarEvent,
  formatAddress: function(addressObj) {
    if (!addressObj) return '';
    
    const { street, city, state, zipCode } = addressObj;
    return `${street}, ${city}, ${state} ${zipCode}`;
  },
  formatDeliveryDescription: function(orderData) {
    const { deliveryInfo, items, orderId, id, customerName, customerEmail, customerPhone, 
            subtotal, deliveryFee, tax, total } = orderData;
    
    // Use either orderId or id, whichever is provided
    const orderIdentifier = orderId || id;
    
    // Format items for the description
    const itemsList = items?.map(item => 
      `${item.quantity} x ${item.name} ($${item.price} each)`
    ).join('\n') || 'No items';
    
    // Format phone as clickable link
    const phone = customerPhone || deliveryInfo?.phone || 'N/A';
    const phoneWithLink = phone !== 'N/A' ? phoneToLink(phone) : 'N/A';
    
    // Create a detailed description with order information
    return `
Order ID: ${orderIdentifier}
Customer: ${customerName || 'N/A'}
Email: ${customerEmail || 'N/A'}
Phone: ${phoneWithLink}

Delivery Address:
${address}

Items:
${itemsList}

Subtotal: $${subtotal || '0.00'}
Delivery Fee: $${deliveryFee || '0.00'}
Tax: $${tax || '0.00'}
Total: $${total || '0.00'}

Special Instructions: ${deliveryInfo.instructions || deliveryInfo.specialInstructions || 'None'}

-----
Estimated delivery time: 1.5 hours
Google Maps Directions: https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}
`;
  },
  // Add test function to verify Google Calendar auth
  testAuth: async function() {
    try {
      console.log('Testing Google Calendar authentication...');
      const client = await getCalendarClient();
      
      if (client.mock) {
        return {
          success: false,
          message: 'Using mock client - real authentication not tested',
          isMock: true
        };
      }
      
      return {
        success: true,
        message: 'JWT authentication successful',
        calendarId: client.calendarId
      };
    } catch (error) {
      console.error('Google Calendar authentication test failed:', error.message);
      return {
        success: false,
        message: `Authentication failed: ${error.message}`,
        error: error.message
      };
    }
  }
}; 

/**
 * Alias for createDeliveryCalendarEvent for backward compatibility
 */
export const createDeliveryEvent = createDeliveryCalendarEvent;

// The countDeliveryEventsForSlot function is already defined earlier in this file,
// so we're removing the duplicate definition that was here.
