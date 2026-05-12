/**
 * Utility to fetch real GeoJSON data for Atlanta zipcodes
 * Uses the same data source as the user's stand-alone map
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// List of valid delivery zipcodes - must match VALID_ZIP_CODES in other files
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

// Atlanta zipcode names for displaying in the UI
const ZIPCODE_NAMES = {
  "30002": "Avondale Estates",
  "30030": "Decatur",
  "30032": "East Decatur",
  "30033": "North Decatur",
  "30067": "Vinings",
  "30079": "Scottdale",
  "30080": "Smyrna",
  "30084": "Tucker",
  "30303": "Downtown Atlanta",
  "30305": "Buckhead",
  "30306": "Virginia-Highland",
  "30307": "Inman Park",
  "30308": "Midtown",
  "30309": "Midtown West",
  "30310": "West End",
  "30311": "Cascade Heights",
  "30312": "Old Fourth Ward",
  "30313": "North Downtown",
  "30314": "Atlanta University Center",
  "30315": "South Atlanta",
  "30316": "East Atlanta",
  "30317": "Kirkwood",
  "30318": "West Midtown",
  "30319": "Brookhaven"
  // Additional zipcode names would be added here as needed
};

// Define the Atlanta metro area bounding box for filtering
const ATLANTA_BOUNDS = {
  north: 34.3,   // Northern latitude
  south: 33.1,   // Southern latitude
  east: -83.7,   // Eastern longitude
  west: -85.0    // Western longitude
};

/**
 * Fetch real zipcode GeoJSON data from GitHub repository
 * @param {boolean} forceRefresh Whether to force a refresh of the data
 * @returns {Promise<Object>} GeoJSON data
 */
export async function fetchRealZipcodeData(forceRefresh = false) {
  console.log('Fetching real Atlanta zipcode GeoJSON data...');

  // Path to save the data locally
  const localFilePath = path.join(process.cwd(), 'public', 'atlanta-zipcodes.json');
  
  // Check if we already have the file and it's not a forced refresh
  if (!forceRefresh && fs.existsSync(localFilePath)) {
    try {
      console.log('Using locally saved GeoJSON data file');
      const fileData = fs.readFileSync(localFilePath, 'utf8');
      const geoJson = JSON.parse(fileData);
      
      // Verify it's valid GeoJSON data
      if (geoJson && geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) {
        return geoJson;
      }
    } catch (error) {
      console.error('Error reading local GeoJSON file:', error);
      // Continue to fetch from source if local file is invalid
    }
  }
  
  try {
    // Use the GitHub source that's working well in the user's script
    const response = await fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ga_georgia_zip_codes_geo.min.json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch GeoJSON data: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Fetched raw GeoJSON with ${data.features ? data.features.length : 0} features`);
    
    // Filter features to only include Atlanta area zipcodes
    const features = data.features.filter(feature => {
      // Get the zipcode from the ZCTA5CE10 property (Census Bureau format)
      const zipcode = feature.properties.ZCTA5CE10;
      
      // First, check if it's in our valid delivery zipcodes
      if (VALID_ZIP_CODES.includes(zipcode)) {
        return true;
      }
      
      // Otherwise, check if it's in the Atlanta area by coordinates
      if (feature.geometry && feature.geometry.coordinates) {
        // For polygons
        if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates.length > 0) {
          for (const ring of feature.geometry.coordinates) {
            for (const coord of ring) {
              const lng = coord[0];
              const lat = coord[1];
              
              if (lat >= ATLANTA_BOUNDS.south && 
                  lat <= ATLANTA_BOUNDS.north && 
                  lng >= ATLANTA_BOUNDS.west && 
                  lng <= ATLANTA_BOUNDS.east) {
                return true;
              }
            }
          }
        }
        // For multi-polygons
        else if (feature.geometry.type === 'MultiPolygon') {
          for (const polygon of feature.geometry.coordinates) {
            for (const ring of polygon) {
              for (const coord of ring) {
                const lng = coord[0];
                const lat = coord[1];
                
                if (lat >= ATLANTA_BOUNDS.south && 
                    lat <= ATLANTA_BOUNDS.north && 
                    lng >= ATLANTA_BOUNDS.west && 
                    lng <= ATLANTA_BOUNDS.east) {
                  return true;
                }
              }
            }
          }
        }
      }
      
      return false;
    });
    
    console.log(`Filtered to ${features.length} Atlanta area zipcodes`);
    
    // Create the final GeoJSON object with our custom properties
    const processedData = {
      type: "FeatureCollection",
      features: features.map(feature => ({
        type: "Feature",
        properties: {
          zipcode: feature.properties.ZCTA5CE10,
          name: ZIPCODE_NAMES[feature.properties.ZCTA5CE10] || `Atlanta Area ${feature.properties.ZCTA5CE10}`,
          isValid: VALID_ZIP_CODES.includes(feature.properties.ZCTA5CE10)
        },
        // Preserve the original geometry - this is critical
        geometry: feature.geometry
      }))
    };
    
    // Save to local file for future use
    try {
      fs.writeFileSync(localFilePath, JSON.stringify(processedData));
      console.log(`Saved processed GeoJSON to ${localFilePath}`);
    } catch (saveError) {
      console.error('Error saving GeoJSON file:', saveError);
      // Continue even if saving fails
    }
    
    return processedData;
  } catch (error) {
    console.error('Error fetching zipcode data:', error);
    throw error;
  }
}

/**
 * Download the real Georgia zipcode data from source to our public directory
 * This function can be called by a script to refresh the data
 */
export async function downloadAtlantaZipcodeData() {
  try {
    console.log('Downloading fresh Atlanta zipcode GeoJSON data...');
    const data = await fetchRealZipcodeData(true);
    return {
      success: true,
      featureCount: data.features.length,
      message: `Successfully downloaded ${data.features.length} zipcode features`
    };
  } catch (error) {
    console.error('Failed to download zipcode data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Allow this file to be executed directly as a script
if (require.main === module) {
  downloadAtlantaZipcodeData()
    .then(result => {
      console.log(result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} 