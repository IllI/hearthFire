import googleCalendar from '../../../../lib/google-calendar';

/**
 * API endpoint for fetching pickup locations
 * GET /api/pickup/locations - Returns available pickup locations from calendar
 * GET /api/pickup/locations?forceReload=true - Force refresh from calendar and bypass caching
 */
export default async function handler(req, res) {
  // Check if we're forcing a reload/bypass of cache
  const forceReload = req.query.forceReload === 'true';
  
  // Set cache headers - cache for up to 2 hours, but only if not forcing reload
  if (!forceReload) {
    res.setHeader('Cache-Control', 'public, max-age=7200, s-maxage=7200, stale-while-revalidate=86400');
  } else {
    // If force reloading, set no-cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    console.log(`API: Fetching pickup locations from calendar ${forceReload ? '(forced reload)' : ''}`);
    
    // Calculate date range - from today to 6 months in the future
    const today = new Date();
    const sixMonthsLater = new Date(today);
    sixMonthsLater.setMonth(today.getMonth() + 6);
    
    console.log(`API: Date range for pickup locations: ${today.toISOString()} to ${sixMonthsLater.toISOString()}`);
    
    // Always use real data - mock data has been disabled in the calendar service
    const useRealData = true;
    
    console.log(`API: Fetching pickup locations with useRealData=${useRealData}`);
    
    let pickupLocations = await googleCalendar.getPickupLocationsFromCalendar(
      today.toISOString(),
      sixMonthsLater.toISOString(),
      useRealData
    );
    
    console.log(`API: Received ${pickupLocations.length} pickup locations from calendar service`);
    
    // Normalize date formats and other values to ensure consistency
    const normalizedLocations = pickupLocations.map(location => {
      // Make sure location has an id
      if (!location.id) {
        location.id = `pickup-${Math.random().toString(36).substring(2, 10)}`;
      }
      
      // Format date if it exists
      if (location.date) {
        try {
          // If it's already a Date object, convert to ISO string
          if (location.date instanceof Date) {
            location.date = location.date.toISOString();
          } 
          // If it's not a string (like a timestamp number), convert to Date then ISO
          else if (typeof location.date !== 'string') {
            location.date = new Date(location.date).toISOString();
          }
          // Otherwise leave as is, assuming it's already a properly formatted date string
        } catch (e) {
          console.error(`API: Invalid date for location ${location.id}:`, location.date);
          // Use current date as fallback
          location.date = new Date();
        }
      }
      return location;
    });
    
    // Group locations by date for easier frontend processing
    const groupedLocations = groupLocationsByDate(normalizedLocations);
    
    // Log the unique dates found
    const uniqueDates = Object.keys(groupedLocations);
    console.log(`API: Found ${uniqueDates.length} unique pickup dates: ${uniqueDates.join(', ')}`);
    
    return res.status(200).json({
      success: true,
      pickupLocations: normalizedLocations,
      groupedByDate: groupedLocations
    });
  } catch (error) {
    console.error('API: Error fetching pickup locations:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch pickup locations'
    });
  }
}

/**
 * Group locations by date for easier frontend processing
 * @param {Array} locations Array of location objects with date property
 * @returns {Object} Object with dates as keys and arrays of locations as values
 */
function groupLocationsByDate(locations) {
  const grouped = {};
  
  for (const location of locations) {
    if (!location.date) continue;
    
    let dateKey;
    
    try {
      // Consistent date extraction to avoid timezone issues
      if (typeof location.date === 'string') {
        // Extract just the date part from ISO string
        dateKey = location.date.split('T')[0];
      } else if (location.date instanceof Date) {
        // Use UTC methods to avoid timezone issues
        const year = location.date.getUTCFullYear();
        const month = String(location.date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(location.date.getUTCDate()).padStart(2, '0');
        dateKey = `${year}-${month}-${day}`;
      } else {
        // For any other format, convert to Date and extract using UTC
        const dateObj = new Date(location.date);
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        dateKey = `${year}-${month}-${day}`;
      }
      
      // Log the extracted date key for debugging
      console.log(`API: Processing location date: ${location.date} -> extracted key: ${dateKey}`);
    } catch (error) {
      console.error('API: Error extracting date key:', error);
      continue;
    }
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    
    grouped[dateKey].push(location);
  }
  
  return grouped;
} 