# Google Calendar Integration for Delivery Scheduling Systems

## Overview

This document provides a comprehensive technical guide for integrating Google Calendar with a delivery scheduling system. Based on the implementation in Hearthfire Farm's e-commerce platform, this guide outlines how to use Google Calendar as the source of truth for managing delivery availability and appointment slots.

## System Architecture

### Core Components

1. **Google Calendar API Client**: Authenticates and communicates with Google Calendar.
2. **Event-to-Schedule Converter**: Transforms Google Calendar events into delivery schedule objects.
3. **Availability Management**: Tracks slot capacities and current bookings.
4. **Booking Integration**: Creates Google Calendar events when customers place orders.

### Data Flow

```
Google Calendar Events → API Client → Schedule Converter → Frontend Calendar → User Selection → Order Checkout → Booking Creation → Google Calendar Update
```

## Authentication Setup

### Service Account Method

This system uses Google Service Account authentication, which is ideal for server-to-server applications.

1. **Required Credentials**:
   - Service Account Email
   - Private Key
   - Calendar ID

2. **Authentication Flow**:
   ```javascript
   const auth = new google.auth.JWT({
     email: serviceAccountEmail,
     key: privateKey,
     scopes: ['https://www.googleapis.com/auth/calendar']
   });
   
   await auth.authorize();
   const calendar = google.calendar({ version: 'v3', auth });
   ```

3. **Credential Storage**:
   - Primary: Firestore collection `settings/googleCalendar`
   - Fallback: Environment variables

## Delivery Availability Management

### Calendar Event Structure

Delivery availability events in Google Calendar use a specific format:

1. **Event Summary**: "Hearthfire Farms Delivery Availability"
2. **Event Description**: Contains delivery slot details
3. **Event Date**: The delivery date
4. **Extended Properties**: Can contain metadata like valid ZIP codes

### Converting Calendar Events to Delivery Schedules

```javascript
// Simplified example of conversion logic
const availabilityEvents = events.filter(event => 
  event.summary && event.summary.includes('Delivery Availability')
);

const schedules = availabilityEvents.map(event => {
  const startDate = new Date(event.start.dateTime || event.start.date);
  
  // Create delivery slots with capacity information
  const slots = [
    {
      id: 'morning',
      name: 'Morning',
      time: '9am - 12pm',
      available: true,
      maxOrders: 2, // Based on time window duration
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
  
  return {
    id: event.id,
    date: startDate.toISOString(),
    slots,
    zipCodes: ['12345', '23456', '34567'], // Default or extracted from event
    cutoffTime: '6pm day before',
    googleCalendarEventId: event.id
  };
});
```

### Slot Capacity Management

The system calculates slot capacity based on:

1. Time window duration
2. Average delivery time required per order
3. Buffer time between deliveries

Example calculation:
- Morning slot: 9am-12pm (3 hours) = 2 deliveries at 1.5 hours each
- Afternoon slot: 1pm-5pm (4 hours) = 3 deliveries at 1.5 hours each

## Frontend Integration

### Displaying Availability in the Calendar UI

The frontend calendar component:

1. Fetches delivery schedules from an API endpoint
2. Renders them as events on the calendar
3. Provides selection of delivery dates and time slots

```javascript
// Calendar component renders days with events
const dayEvents = events.filter(event => {
  const eventDate = new Date(event.date);
  return isSameDay(day, eventDate);
});

// Events are displayed as clickable items
// When selected, they populate the checkout delivery information
```

### User Selection Flow

1. User views calendar with available delivery days
2. User selects a date to see available time slots
3. User chooses a time slot, which is stored for checkout
4. System ensures slot availability at checkout time

## Order Processing and Booking

### Creating Calendar Events for Orders

When a customer places an order, the system:

1. Validates that the selected slot is still available
2. Creates a new event in Google Calendar for the delivery
3. Updates the slot's current usage count
4. Returns the booking confirmation to the customer

```javascript
async function createDeliveryCalendarEvent(orderData) {
  try {
    const { calendar, calendarId } = await getCalendarClient();
    
    console.log('Creating Google Calendar event for delivery');
    
    // Create delivery event data
    const event = {
      summary: `Delivery to ${orderData.customerName}`,
      description: `Order: ${orderData.orderId}\nTotal: $${orderData.total}\n\nItems: ${orderData.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`,
      start: {
        dateTime: new Date(orderData.scheduledDelivery.date).toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: new Date(new Date(orderData.scheduledDelivery.date).getTime() + 1.5 * 60 * 60 * 1000).toISOString(),
        timeZone: 'America/New_York',
      },
      location: orderData.deliveryAddress,
      // Add custom metadata if needed
      extendedProperties: {
        private: {
          orderId: orderData.orderId,
          timeSlot: orderData.scheduledDelivery.timeSlot
        }
      }
    };
    
    // Insert event into calendar
    const response = await calendar.events.insert({
      calendarId,
      resource: event
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}
```

### Tracking Delivery Slot Usage

To prevent overbooking:

1. Count existing delivery events for a given date and slot
2. Compare with the slot's maximum capacity
3. Mark slots as unavailable when capacity is reached

```javascript
export async function countDeliveryEventsForSlot(date, timeSlot) {
  try {
    // Convert date to start and end times
    const dayStart = startOfDay(new Date(date));
    const dayEnd = endOfDay(new Date(date));
    
    // Get all delivery events for the day
    const events = await listEvents({
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString()
    });
    
    // Filter for delivery events (not availability events)
    const deliveryEvents = events.filter(event => 
      event.summary && 
      event.summary.includes('Delivery to') &&
      event.extendedProperties?.private?.timeSlot === timeSlot
    );
    
    return deliveryEvents.length;
  } catch (error) {
    console.error('Error counting delivery events:', error);
    return 0;
  }
}
```

## Fallback and Development Modes

The system includes:

1. **Mock Calendar Client**: For development without Google Calendar credentials
2. **Fallback Schedules**: Pre-defined schedules when Google Calendar is unavailable
3. **Error Handling**: Graceful degradation with logging

## Implementation Guide for AI Models

### Step 1: Setup Authentication

1. Create a Google Cloud project
2. Enable the Google Calendar API
3. Create a service account with calendar access
4. Store credentials securely (database or environment variables)

### Step 2: Design Calendar Event Structure

1. Define a consistent event format for availability
2. Decide how to encode slot information (description, extended properties)
3. Establish naming conventions for event types

### Step 3: Build Calendar API Client

1. Implement JWT authentication
2. Create methods for listing, creating, and updating events
3. Add error handling and retry logic

### Step 4: Create Event-to-Schedule Converter

1. Design the schedule data structure
2. Implement parsing logic for calendar events
3. Calculate slot capacities based on business rules

### Step 5: Develop Frontend Calendar

1. Create a calendar UI component
2. Implement date/slot selection functionality
3. Connect to the backend API for schedule data

### Step 6: Integrate with Checkout Flow

1. Store selected delivery information during checkout
2. Validate slot availability before order completion
3. Create calendar events for confirmed orders

### Step 7: Implement Booking Management

1. Track slot capacities and usage
2. Update availability when orders are placed or canceled
3. Provide rescheduling functionality

## Adapting for Different Use Cases

This architecture can be adapted for various scheduling systems:

### Medical Appointments

- Modify slots for consultation durations
- Add patient information to calendar events
- Implement specialized confirmation workflows

### Service Scheduling

- Adjust capacity based on service provider availability
- Add service type and duration to calendar events
- Create separate calendars for different service types

### Class Bookings

- Configure slots based on class schedule
- Track participant capacity per session
- Add instructor and location information

## Conclusion

This Google Calendar integration provides a robust foundation for any scheduling system. By using Google Calendar as the source of truth, businesses gain:

1. Familiar calendar management tools for staff
2. Reliable cloud-based storage of schedule data
3. Integration with existing Google Workspace tools
4. Synchronization across multiple devices and applications

The implementation can be customized to fit various business needs while maintaining the core architecture described in this document. 