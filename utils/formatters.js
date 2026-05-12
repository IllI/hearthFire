/**
 * Shared formatting utilities for the application
 */

import { format } from 'date-fns';

/**
 * Maps time slot IDs to their display values
 * @param {string} timeSlotId - The time slot ID ('morning', 'afternoon', etc.)
 * @returns {string} The display text for the time slot
 */
export function formatTimeSlot(timeSlotId) {
  if (!timeSlotId) return 'No time selected';
  
  const TIME_SLOTS = {
    'morning': '9am - 12pm',
    'afternoon': '1pm - 5pm'
  };
  
  // Special case for lowercase matching
  if (typeof timeSlotId === 'string' && timeSlotId.toLowerCase) {
    const lowercaseId = timeSlotId.toLowerCase();
    if (lowercaseId === 'morning') return 'Morning (9am-12pm)';
    if (lowercaseId === 'afternoon') return 'Afternoon (1pm-5pm)';
  }
  
  return TIME_SLOTS[timeSlotId] || timeSlotId;
}

/**
 * Gets the time slot hours for creating calendar events
 * @param {string} timeSlotId - The time slot ID ('morning', 'afternoon', etc.)
 * @returns {Object} Object with startHour, endHour, and display name
 */
export function getTimeSlotHours(timeSlotId) {
  const TIME_SLOTS = {
    'morning': { startHour: 9, endHour: 12, name: 'Morning (9am-12pm)' },
    'afternoon': { startHour: 13, endHour: 17, name: 'Afternoon (1pm-5pm)' }
  };
  
  return TIME_SLOTS[timeSlotId] || { startHour: 12, endHour: 14, name: 'Custom Time' };
}

/**
 * Formats a delivery date for display
 * @param {string|Object} dateString - The date string or object to format
 * @returns {string} Formatted date string
 */
export function formatDeliveryDate(dateString) {
  try {
    if (!dateString) return 'No date selected';
    
    console.log('Formatting date:', dateString, 'Type:', typeof dateString);
    
    // For ISO date strings or simple YYYY-MM-DD strings
    if (typeof dateString === 'string') {
      // Handle full ISO format by extracting just the date part
      const datePart = dateString.includes('T') 
        ? dateString.split('T')[0] 
        : dateString;
      
      // Check if it's already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [year, month, day] = datePart.split('-').map(Number);
        
        // Create a date object explicitly from components to avoid timezone issues
        const date = new Date(year, month - 1, day);
        return format(date, 'EEEE, MMMM d, yyyy');
      }
      
      // If it's not in ISO format, try direct parsing
      return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
    }
    
    // For Firestore timestamps
    if (dateString._seconds) {
      const date = new Date(dateString._seconds * 1000);
      return format(date, 'EEEE, MMMM d, yyyy');
    }
    
    // For Date objects
    if (dateString instanceof Date) {
      return format(dateString, 'EEEE, MMMM d, yyyy');
    }
    
    // Fallback for other formats
    return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error, 'Date value:', dateString);
    return 'Invalid date';
  }
}

/**
 * Formats an order date with time for display
 * @param {string|Object} createdAt - The date to format
 * @returns {string} Formatted date string
 */
export function formatOrderDate(createdAt) {
  try {
    if (!createdAt) return 'N/A';
    
    // Handle Firestore timestamp object
    if (createdAt.seconds) {
      return format(new Date(createdAt.seconds * 1000), 'MMMM d, yyyy · h:mm a');
    } 
    
    // Handle ISO date string
    if (typeof createdAt === 'string') {
      return format(new Date(createdAt), 'MMMM d, yyyy · h:mm a');
    }
    
    // Handle Date object or timestamp
    return format(new Date(createdAt), 'MMMM d, yyyy · h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'N/A';
  }
}

/**
 * Parses a date string and returns a date object without timezone issues
 * @param {string} dateString - ISO date string
 * @returns {Date} Date object
 */
export function parseDeliveryDate(dateString) {
  if (!dateString) return null;
  
  try {
    // For ISO date strings like "2025-03-21T00:00:00.000Z"
    if (typeof dateString === 'string') {
      const datePart = dateString.split('T')[0]; // "2025-03-21"
      const [year, month, day] = datePart.split('-').map(Number);
      
      // Create date in UTC to avoid timezone shifting
      return new Date(Date.UTC(year, month - 1, day));
    }
    
    // For Firestore timestamps
    if (dateString._seconds) {
      return new Date(dateString._seconds * 1000);
    }
    
    // Fallback
    return new Date(dateString);
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * Formats a phone number to a standard format (XXX) XXX-XXXX
 * @param {string} phone - The phone number to format
 * @returns {string} Formatted phone number or original if invalid
 */
export function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Convert to string if it's not already
  const phoneStr = '' + phone;
  
  // Remove all non-digits
  const cleaned = phoneStr.replace(/\D/g, '');
  
  // Check if it's a valid US number (10 digits)
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  
  // Check if we have a valid phone number of length 10
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
  }
  
  // If not a standard format, return as is
  return phoneStr;
}

/**
 * Validates a phone number to ensure it meets requirements
 * @param {string} phone - The phone number to validate
 * @returns {Object} Result object with isValid flag and error message if any
 */
export function validatePhoneNumber(phone) {
  if (!phone) {
    return { isValid: false, error: 'Phone number is required' };
  }
  
  // Convert to string and remove all non-digits
  const cleaned = ('' + phone).replace(/\D/g, '');
  
  // Check length requirement
  if (cleaned.length !== 10) {
    return { 
      isValid: false, 
      error: cleaned.length < 10 
        ? 'Phone number must have 10 digits' 
        : 'Phone number cannot exceed 10 digits' 
    };
  }
  
  // Check for valid area code (can't start with 0 or 1)
  const areaCode = cleaned.substring(0, 3);
  if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
    return { isValid: false, error: 'Area code cannot start with 0 or 1' };
  }
  
  // Check for valid exchange code (second set of 3 digits)
  const exchangeCode = cleaned.substring(3, 6);
  if (exchangeCode.startsWith('0') || exchangeCode.startsWith('1')) {
    return { isValid: false, error: 'Exchange code cannot start with 0 or 1' };
  }
  
  return { isValid: true };
}

/**
 * Creates a tel: link for a phone number
 * @param {string} phone - The phone number
 * @param {string} [display] - Optional display text (defaults to formatted phone)
 * @returns {string} HTML for a tel: link or just the display text if invalid
 */
export function phoneToLink(phone, display) {
  if (!phone) return '';
  
  // Remove all non-digits
  const cleaned = ('' + phone).replace(/\D/g, '');
  const formatted = formatPhoneNumber(phone);
  
  // Use the formatted phone as display if none provided
  const displayText = display || formatted;
  
  if (cleaned.length < 10) {
    return displayText; // Not enough digits for a valid number
  }
  
  return `<a href="tel:${cleaned}">${displayText}</a>`;
}

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency (e.g., "$10.99")
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '$0.00';
  
  return '$' + parseFloat(amount).toFixed(2);
}

/**
 * Format an address object into a string
 * @param {Object} address - Address object
 * @returns {string} - Formatted address string
 */
export function formatAddress(address) {
  if (!address) return 'No address provided';
  
  const { street, city, state, zip } = address;
  let parts = [];
  
  if (street) parts.push(street);
  if (city) parts.push(city);
  if (state && zip) parts.push(`${state} ${zip}`);
  else if (state) parts.push(state);
  else if (zip) parts.push(zip);
  
  return parts.join(', ');
}

// Module exports for CommonJS compatibility (for use with require())
module.exports = {
  formatDeliveryDate,
  formatPhoneNumber,
  formatTimeSlot,
  formatCurrency,
  formatAddress,
  formatOrderDate,
  parseDeliveryDate,
  getTimeSlotHours,
  phoneToLink
}; 