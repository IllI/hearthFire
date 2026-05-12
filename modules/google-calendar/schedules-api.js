import admin, { firestore, auth, isMockFirebase, createMockDeliverySchedules } from '../../../../lib/firebase-admin';
import googleCalendar from '../../../../lib/google-calendar';

// This is a placeholder for the database interface.
// In a real application, you would replace this with your actual database implementation.
const db = {
  getSchedules: async () => {
    // Replace this with your database logic to retrieve schedules.
    return [];
  },
  syncSchedules: async (schedules) => {
    // Replace this with your database logic to sync schedules.
  },
};

export default async function handler(req, res) {
  try {
    console.log('Delivery schedules API handler called');
    
    // Process different HTTP methods
    if (req.method === 'GET') {
      await getDeliverySchedules(req, res);
    } else if (req.method === 'POST') {
      await createDeliverySchedule(req, res);
    } else if (req.method === 'PATCH') {
      await updateAllScheduleCapacities(req, res);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in delivery schedules API:', error);
    res.status(500).json({ error: 'Failed to fetch delivery schedules' });
  }
}

/**
 * GET handler for delivery schedules 
 */
async function getDeliverySchedules(req, res) {
  try {
    // Set time range to search for 6 months of future dates
    const now = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    
    const calendarSchedules = await googleCalendar.getDeliverySchedulesFromCalendar(
      now.toISOString(), 
      sixMonthsLater.toISOString()
    );
    
    // Sync schedules to the database
    await db.syncSchedules(calendarSchedules);
    
    // Get schedules from the database
    const schedules = await db.getSchedules();
    
    res.status(200).json(schedules);
  } catch (error) {
    console.error('Error fetching delivery schedules:', error);
    res.status(500).json({ error: 'Failed to fetch delivery schedules' });
  }
}

// Process and validate schedule data
function processScheduleData(scheduleData) {
  try {
    // Validate required fields
    if (!scheduleData.date) {
      throw new Error('Date is required');
    }
    
    if (!scheduleData.type) {
      throw new Error('Schedule type is required');
    }
    
    // Type-specific validation
    if (scheduleData.type === 'delivery' && (!scheduleData.zipCodes || !Array.isArray(scheduleData.zipCodes))) {
      throw new Error('Zip codes are required for delivery schedules');
    }
    
    if (scheduleData.type === 'pickup' && !scheduleData.location) {
      throw new Error('Location is required for pickup schedules');
    }
    
    // Ensure slots are valid
    if (!scheduleData.slots || !Array.isArray(scheduleData.slots) || scheduleData.slots.length === 0) {
      throw new Error('At least one time slot is required');
    }
    
    // Process and validate each slot
    scheduleData.slots = scheduleData.slots.map((slot, index) => {
      // Generate ID if not provided (consistent for updates)
      const slotId = slot.id || `slot-${index + 1}`;
      
      // Ensure time format is valid
      if (!slot.time || typeof slot.time !== 'string') {
        throw new Error(`Time is required for slot ${index + 1}`);
      }
      
      // Ensure maxOrders is a number
      const maxOrders = parseInt(slot.maxOrders, 10);
      if (isNaN(maxOrders) || maxOrders <= 0) {
        throw new Error(`Maximum orders must be a positive number for slot ${index + 1}`);
      }
      
      return {
        id: slotId,
        name: slot.name || slot.time,
        time: slot.time,
        maxOrders: maxOrders,
        available: true
      };
    });
    
    // Handle notes field - client may send either 'note' or 'notes'
    let notes = '';
    if (scheduleData.notes && scheduleData.notes.trim() !== '') {
      notes = scheduleData.notes;
    } else if (scheduleData.note && scheduleData.note.trim() !== '') {
      notes = scheduleData.note;
    }
    
    // Create a structured schedule object
    return {
      date: new Date(scheduleData.date).toISOString(),
      type: scheduleData.type,
      slots: scheduleData.slots,
      zipCodes: scheduleData.type === 'delivery' ? scheduleData.zipCodes : [],
      location: scheduleData.type === 'pickup' ? scheduleData.location : '',
      locationDetails: scheduleData.type === 'pickup' ? scheduleData.locationDetails : null,
      cutoffTime: scheduleData.cutoffTime || '6pm day before',
      notes: notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error processing schedule data:', error);
    throw error;
  }
}

/**
 * Creates a new delivery schedule
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
async function createDeliverySchedule(req, res) {
  try {
    // Get schedule data from request body
    const scheduleData = req.body;
    
    // Process and validate schedule data
    const processedData = processScheduleData(scheduleData);
    
    // Create a reference to the delivery schedules collection
    const scheduleRef = admin.firestore().collection('deliverySchedules').doc();
    
    // Get the new document ID
    const scheduleId = scheduleRef.id;
    
    // Include the ID in the data
    const scheduleWithId = {
      ...processedData,
      id: scheduleId
    };
    
    // Create availability event in Google Calendar if enabled
    try {
      console.log('Creating Google Calendar event for schedule:', scheduleWithId.type);
      
      // Make sure we're including locationDetails as an empty object if it's not defined for pickup
      if (scheduleWithId.type === 'pickup' && !scheduleWithId.locationDetails) {
        console.log('Location details missing for pickup, using empty object');
        scheduleWithId.locationDetails = {}; 
      }
      
      // Call the Google Calendar API to create an availability event
      console.log('Calling createAvailabilityEvent with schedule:', {
        id: scheduleWithId.id,
        type: scheduleWithId.type,
        date: scheduleWithId.date,
        slots: scheduleWithId.slots.length,
        location: scheduleWithId.type === 'pickup' ? scheduleWithId.location : 'N/A'
      });
      
      const calendarEvent = await googleCalendar.createAvailabilityEvent(scheduleWithId);
      
      if (calendarEvent && calendarEvent.id) {
        // Store the Google Calendar event ID
        scheduleWithId.googleCalendarEventId = calendarEvent.id;
        console.log(`Created Google Calendar event with ID: ${calendarEvent.id}`);
      }
    } catch (calendarError) {
      console.error('Error creating Google Calendar event:', calendarError);
      // Continue without Google Calendar integration - don't fail the whole creation process
      console.log('Continuing schedule creation without Google Calendar integration');
    }
    
    // Handle location details for pickup schedules
    if (scheduleWithId.type === 'pickup') {
      // Ensure locationDetails is an object, never undefined
      if (!scheduleWithId.locationDetails) {
        scheduleWithId.locationDetails = {};
      }
      
      // If we have notes, log them for debugging
      if (scheduleWithId.notes) {
        console.log(`Adding notes to pickup schedule: ${scheduleWithId.notes}`);
      }
    }
    
    // Save the schedule to Firestore
    await scheduleRef.set(scheduleWithId);
    
    // Return the created schedule
    return res.status(201).json({
      success: true,
      data: scheduleWithId
    });
  } catch (error) {
    console.error('Error creating delivery schedule:', error);
    return res.status(500).json({
      success: false,
      message: `Failed to create schedule: ${error.message}`
    });
  }
}

// PATCH request - update all schedules (temporary utility)
async function updateAllScheduleCapacities(req, res) {
  try {
    console.log('Updating all schedule capacities with correct values');
    
    // Check if this is a request to sync order counts
    const syncOrderCounts = req.query.syncOrderCounts === 'true';
    
    // Get all schedules
    const schedulesSnapshot = await firestore.collection('deliverySchedules').get();
    
    if (schedulesSnapshot.empty) {
      return res.status(404).json({ error: 'No schedules found' });
    }
    
    const batch = firestore.batch();
    let updateCount = 0;
    
    // For syncing order counts, we need to fetch from Google Calendar
    if (syncOrderCounts) {
      console.log('Syncing order counts from Google Calendar');
      
      for (const doc of schedulesSnapshot.docs) {
        const schedule = doc.data();
        const scheduleDate = new Date(schedule.date._seconds ? schedule.date._seconds * 1000 : schedule.date);
        
        // Skip past dates
        const now = new Date();
        if (scheduleDate < now) {
          console.log(`Skipping past date ${scheduleDate.toISOString()}`);
          continue;
        }
        
        // Update each slot's order count
        for (let i = 0; i < schedule.slots.length; i++) {
          const slot = schedule.slots[i];
          
          try {
            // Count delivery events for this slot in Google Calendar
            console.log(`Counting orders for ${scheduleDate.toISOString()} - ${slot.id}`);
            const orderCount = await googleCalendar.countDeliveryEventsForSlot(
              scheduleDate,
              slot.id
            );
            
            console.log(`Found ${orderCount} orders for ${slot.id} slot on ${scheduleDate.toISOString()}`);
            schedule.slots[i].currentOrders = orderCount;
          } catch (countError) {
            console.error(`Error counting orders for slot ${slot.id}:`, countError);
          }
        }
        
        // Update the document
        batch.update(doc.ref, { 
          slots: schedule.slots,
          lastUpdated: new Date()
        });
        
        updateCount++;
      }
    } else {
      // Update each schedule with correct maxOrders values
      schedulesSnapshot.forEach(doc => {
        const data = doc.data();
        const updatedSlots = data.slots.map(slot => ({
          ...slot,
          maxOrders: slot.id === 'morning' ? 2 : slot.id === 'afternoon' ? 3 : slot.maxOrders
        }));
        
        batch.update(doc.ref, { 
          slots: updatedSlots,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        updateCount++;
      });
    }
    
    // Commit all updates
    await batch.commit();
    
    const message = syncOrderCounts 
      ? `Updated order counts for ${updateCount} schedules from Google Calendar`
      : `Updated ${updateCount} schedules with correct capacities (morning: 2, afternoon: 3)`;
      
    return res.status(200).json({ message });
  } catch (error) {
    console.error('Error updating schedules:', error);
    return res.status(500).json({ error: 'Failed to update schedules' });
  }
}

// Helper function to create mock schedules for development
function createMockSchedules() {
  console.log('Creating mock schedule data');
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  return [
    {
      id: 'test-schedule-1',
      date: tomorrow.toISOString(),
      slots: [
        { id: 'morning', name: 'Morning', time: '9am - 12pm', available: true, maxOrders: 2, currentOrders: 0 },
        { id: 'afternoon', name: 'Afternoon', time: '1pm - 5pm', available: true, maxOrders: 3, currentOrders: 0 }
      ],
      zipCodes: ['12345', '23456', '34567'],
      cutoffTime: '6pm day before',
      googleCalendarEventId: 'mock-event-1'
    },
    {
      id: 'test-schedule-2',
      date: nextWeek.toISOString(),
      slots: [
        { id: 'morning', name: 'Morning', time: '9am - 12pm', available: true, maxOrders: 2, currentOrders: 0 },
        { id: 'afternoon', name: 'Afternoon', time: '1pm - 5pm', available: true, maxOrders: 3, currentOrders: 0 }
      ],
      zipCodes: ['12345', '23456', '34567'],
      cutoffTime: '6pm day before',
      googleCalendarEventId: 'mock-event-2'
    }
  ];
}