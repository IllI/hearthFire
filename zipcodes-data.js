// This is a placeholder. In a real-world scenario, we would fetch actual GeoJSON data for Atlanta zipcodes.
// For demonstration purposes, I'll create a simplified version that generates placeholder polygon data.

const ATLANTA_CENTER = [33.7490, -84.3880];

// List of Atlanta area zipcodes from the provided file (initially selected)
const ATLANTA_ZIPCODES = [
    "30002", "30021", "30030", "30032", "30033", "30034", "30035", "30038",
    "30072", "30079", "30080", "30083", "30084", "30088", "30094", "30228", 
    "30236", "30238", "30250", "30253", "30260", "30273", "30274", "30281", 
    "30288", "30294", "30296", "30297", "30303", "30305", "30306", "30307", 
    "30308", "30309", "30310", "30311", "30312", "30313", "30314", "30315", 
    "30316", "30317", "30318", "30319", "30322", "30324", "30326", "30327", 
    "30328", "30329", "30332", "30334", "30337", "30338", "30339", "30340", 
    "30341", "30342", "30344", "30345", "30346", "30354", "30360", "30363"
];

// Remove duplicates from initial selection
const uniqueSelectedZipcodes = [...new Set(ATLANTA_ZIPCODES)];

// This will hold our GeoJSON data once loaded
let zipcodeGeoJSON = null;

// Define the Atlanta metro area bounding box - expanded to ensure more coverage
const ATLANTA_BOUNDS = {
    north: 34.3,   // Northern latitude (expanded)
    south: 33.1,   // Southern latitude (expanded)
    east: -83.7,   // Eastern longitude (expanded)
    west: -85.0    // Western longitude (expanded)
};

// List of known Atlanta area zipcode prefixes (30xxx, 31xxx)
const ATLANTA_ZIPCODE_PREFIXES = ['30', '31'];

// Function to fetch real zipcode GeoJSON data
async function fetchZipcodeData() {
    try {
        // Using Census Bureau's 2020 ZCTA (Zipcode Tabulation Areas) data
        // We'll use a pre-compiled GeoJSON file focused on Georgia/Atlanta area
        const response = await fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ga_georgia_zip_codes_geo.min.json');
        if (!response.ok) {
            throw new Error('Failed to fetch zipcode data');
        }
        
        const data = await response.json();
        
        // Use a better filtering approach - combine bounding box with zipcode pattern
        const features = data.features.filter(feature => {
            const zipcode = feature.properties.ZCTA5CE10;
            
            // Check if the zipcode starts with Atlanta area prefix
            const hasAtlantaPrefix = ATLANTA_ZIPCODE_PREFIXES.some(prefix => 
                zipcode.startsWith(prefix)
            );
            
            if (!hasAtlantaPrefix) {
                return false;
            }
            
            // Now check if any part of the zipcode is within our bounding box
            // Use a more robust approach to check coordinates
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
        
        console.log(`Found ${features.length} zipcodes in the Atlanta metro area`);
        
        // Create a new GeoJSON object with all Atlanta area features
        return {
            type: "FeatureCollection",
            features: features.map(feature => ({
                type: "Feature",
                properties: {
                    zipcode: feature.properties.ZCTA5CE10,
                    name: `Zipcode ${feature.properties.ZCTA5CE10}`
                },
                geometry: feature.geometry
            }))
        };
    } catch (error) {
        console.error("Error fetching zipcode data:", error);
        // Fall back to mock data as a last resort
        return generateMockZipcodeData();
    }
}

// Generate mock data as a fallback (keeping the existing function)
function generateMockZipcodeData() {
    console.warn("Using mock zipcode data as fallback");
    const features = [];
    
    // Create a grid of "zipcode polygons" around Atlanta
    const rows = 8;
    const cols = 8;
    const cellSize = 0.03; // Size in degrees
    
    let index = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (index < uniqueSelectedZipcodes.length) {
                const zipcode = uniqueSelectedZipcodes[index];
                
                // Calculate the center of this "zipcode"
                const centerLat = ATLANTA_CENTER[0] + (r - rows/2) * cellSize * 1.5;
                const centerLng = ATLANTA_CENTER[1] + (c - cols/2) * cellSize * 1.5;
                
                // Create an irregular polygon
                const vertices = 5 + Math.floor(Math.random() * 3); // 5-7 vertices
                const points = [];
                
                for (let i = 0; i < vertices; i++) {
                    const angle = (i / vertices) * Math.PI * 2;
                    const radius = cellSize * 0.5 * (0.8 + Math.random() * 0.4);
                    const lat = centerLat + Math.sin(angle) * radius;
                    const lng = centerLng + Math.cos(angle) * radius;
                    points.push([lng, lat]);
                }
                
                // Close the polygon
                points.push([...points[0]]);
                
                // Create a GeoJSON feature
                features.push({
                    type: "Feature",
                    properties: {
                        zipcode: zipcode,
                        name: `Zipcode ${zipcode}`
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [points]
                    }
                });
                
                index++;
            }
        }
    }
    
    return {
        type: "FeatureCollection",
        features: features
    };
}

// Alternative data fetching if the first source fails
async function fetchBackupZipcodeData() {
    try {
        // Try another data source that might have better coverage
        const response = await fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ga_georgia_zip_codes_geo.min.json');
        if (!response.ok) {
            throw new Error('Failed to fetch backup data');
        }
        
        const data = await response.json();
        console.log("Using backup data source for Atlanta zipcodes");
        
        // Filter to Georgia zipcodes that start with 30 or 31 (Atlanta area)
        const features = data.features.filter(feature => {
            const zipcode = feature.properties.ZCTA5CE10;
            return zipcode.startsWith('30') || zipcode.startsWith('31');
        });
        
        return {
            type: "FeatureCollection",
            features: features.map(feature => ({
                type: "Feature",
                properties: {
                    zipcode: feature.properties.ZCTA5CE10,
                    name: `Zipcode ${feature.properties.ZCTA5CE10}`
                },
                geometry: feature.geometry
            }))
        };
    } catch (error) {
        console.error("Error fetching backup data:", error);
        return null;
    }
}

// Initialize async loading
(async function initializeData() {
    // Try to load the primary data
    zipcodeGeoJSON = await fetchZipcodeData();
    
    // If we didn't get enough features, try the backup
    if (!zipcodeGeoJSON || zipcodeGeoJSON.features.length < 50) {
        console.warn("Primary data source didn't return enough zipcodes, trying backup...");
        const backupData = await fetchBackupZipcodeData();
        if (backupData && backupData.features.length > zipcodeGeoJSON.features.length) {
            zipcodeGeoJSON = backupData;
        }
    }
    
    // Dispatch an event when data is ready
    const event = new CustomEvent('zipcodeDataReady');
    document.dispatchEvent(event);
})(); 