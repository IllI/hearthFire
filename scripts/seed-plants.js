// Script to seed the Firestore database with plant products from the Hearthfire inventory
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const cheerio = require('cheerio'); // For HTML parsing
require('dotenv').config();

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Log config for debugging before initializing Firebase
console.log('Firebase Config:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Set' : '✗ Missing',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Missing',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✓ Set' : '✗ Missing',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✓ Set' : '✗ Missing',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✓ Set' : '✗ Missing',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ? '✓ Set' : '✗ Missing'
});

// Plant categories
const plantCategories = [
  {
    name: 'Native Plants',
    slug: 'native-plants',
    description: 'Native plants adapted to local conditions that support pollinators and wildlife',
    image: 'https://images.unsplash.com/photo-1636804707340-d521faaa2929?q=80&w=3000&auto=format&fit=crop'
  },
  {
    name: 'Medicinal Herbs',
    slug: 'medicinal-herbs',
    description: 'Plants with traditional medicinal properties and health benefits',
    image: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?q=80&w=3000&auto=format&fit=crop'
  },
  {
    name: 'Pollinator Friendly',
    slug: 'pollinator-friendly',
    description: 'Plants that attract and support bees, butterflies, and other pollinators',
    image: 'https://images.unsplash.com/photo-1566808057768-e9d40da6731e?q=80&w=3000&auto=format&fit=crop'
  },
  {
    name: 'Culinary Herbs',
    slug: 'culinary-herbs',
    description: 'Flavorful herbs for cooking and teas',
    image: 'https://images.unsplash.com/photo-1520587963533-65f1795bde61?q=80&w=3000&auto=format&fit=crop'
  }
];

// Generic placeholder image URLs by plant type
const placeholderImages = {
  milkweed: 'https://images.unsplash.com/photo-1530092285049-1c42085fd395?q=80&w=3000&auto=format&fit=crop',
  sunflower: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?q=80&w=3000&auto=format&fit=crop',
  coneflower: 'https://images.unsplash.com/photo-1597909555411-cb16f69d6b06?q=80&w=3000&auto=format&fit=crop',
  mint: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e4cb?q=80&w=3000&auto=format&fit=crop',
  monarda: 'https://images.unsplash.com/photo-1597383384562-b7b7f738d418?q=80&w=3000&auto=format&fit=crop',
  sage: 'https://images.unsplash.com/photo-1608198491498-cd202162c59c?q=80&w=3000&auto=format&fit=crop',
  aster: 'https://images.unsplash.com/photo-1600648362188-59e9f10e8b28?q=80&w=3000&auto=format&fit=crop',
  default: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=3000&auto=format&fit=crop'
};

// Helper function to check if HTML file exists for a plant
function findPlantHtmlFile(plantName) {
  const htmlFilesDir = path.join(__dirname, '..', 'plant pages');
  
  // Check various possible filenames based on the plant name
  const possibleNames = [
    plantName.replace(/\s+/g, ''),
    plantName.replace(/[,'"]/g, '').replace(/\s+/g, ''),
    plantName.replace(/[,'"]/g, '').replace(/\s+/g, ' ').trim(),
    plantName.split(',')[0].trim().replace(/\s+/g, '')
  ];
  
  // Check for direct HTML file in the main directory
  for (const name of possibleNames) {
    const htmlPath = path.join(htmlFilesDir, `${name}.html`);
    if (fs.existsSync(htmlPath)) {
      return htmlPath;
    }
  }
  
  // Check for HTML files in subdirectories with the plant name
  try {
    const dirs = fs.readdirSync(htmlFilesDir, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const dirName = dir.name;
        if (plantName.toLowerCase().includes(dirName.toLowerCase()) || 
            dirName.toLowerCase().includes(plantName.toLowerCase())) {
          const subDirPath = path.join(htmlFilesDir, dirName);
          const subDirFiles = fs.readdirSync(subDirPath);
          
          for (const file of subDirFiles) {
            if (file.endsWith('.html')) {
              return path.join(subDirPath, file);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error checking subdirectories for ${plantName}:`, error.message);
  }
  
  return null;
}

// Helper function to extract content from HTML files
function extractPlantInfoFromHtml(htmlPath) {
  try {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const $ = cheerio.load(htmlContent);
    
    // Extract image path
    let imageSrc = null;
    const imgTag = $('img');
    if (imgTag.length > 0) {
      const src = imgTag.attr('src');
      if (src) {
        imageSrc = src;
      }
    }
    
    // Extract features from paragraphs
    let features = [];
    $('p').each((i, element) => {
      const text = $(element).text().trim();
      if (text && text.includes('*')) {
        // Split by * and filter out empty strings
        const featureLines = text.split('*').filter(line => line.trim().length > 0);
        features = [...features, ...featureLines.map(line => line.trim())];
      }
    });
    
    // Clean up features
    features = features.filter(feature => 
      !feature.includes('existing code') && 
      feature.length > 1 && 
      !feature.includes('<') && 
      !feature.includes('>')
    );
    
    return {
      features,
      imageSrc
    };
  } catch (error) {
    console.error(`Error extracting info from HTML file ${htmlPath}:`, error.message);
    return { features: [], imageSrc: null };
  }
}

// Helper function to sanitize data for Firestore
function sanitizeForFirestore(data) {
  // Deep copy to avoid modifying original
  const sanitized = {};
  
  // Only include primitive types and arrays
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key];
      
      // Check for null or undefined
      if (value === null || value === undefined) {
        sanitized[key] = null;
        continue;
      }
      
      // Handle different types
      switch (typeof value) {
        case 'string':
        case 'number':
        case 'boolean':
          sanitized[key] = value;
          break;
        case 'object':
          if (Array.isArray(value)) {
            // Handle arrays
            sanitized[key] = value.map(item => {
              if (typeof item === 'object' && item !== null) {
                return JSON.stringify(item);
              }
              return item;
            });
          } else {
            // Handle objects (convert to string for safety)
            sanitized[key] = JSON.stringify(value);
          }
          break;
        default:
          // Skip functions, symbols, etc.
          break;
      }
    }
  }
  
  return sanitized;
}

// Helper function to determine plant category
function determinePlantCategory(commonName, latinName) {
  const nameLower = (commonName || '').toLowerCase() + ' ' + (latinName || '').toLowerCase();
  
  if (nameLower.includes('monarda') || nameLower.includes('salvia') || 
      nameLower.includes('mint') || nameLower.includes('oregano') || 
      nameLower.includes('thyme') || nameLower.includes('sage') || 
      nameLower.includes('rosemary') || nameLower.includes('basil') ||
      nameLower.includes('nepeta') || nameLower.includes('thymus') ||
      nameLower.includes('origanum') || nameLower.includes('mentha')) {
    return 'culinary-herbs';
  }
  
  if (nameLower.includes('milkweed') || nameLower.includes('asclepias') || 
      nameLower.includes('butterfly') || nameLower.includes('bee balm') || 
      nameLower.includes('monarda') || nameLower.includes('coneflower') || 
      nameLower.includes('echinacea') || nameLower.includes('sunflower') ||
      nameLower.includes('lobelia') || nameLower.includes('vervain')) {
    return 'pollinator-friendly';
  }
  
  if (nameLower.includes('echinacea') || nameLower.includes('valerian') || 
      nameLower.includes('skullcap') || nameLower.includes('scutellaria') || 
      nameLower.includes('stinging nettle') || nameLower.includes('tulsi') ||
      nameLower.includes('elecampane') || nameLower.includes('hypericum')) {
    return 'medicinal-herbs';
  }
  
  // Default category is native plants
  return 'native-plants';
}

// Helper function to determine a suitable image
function getImageForPlant(commonName, latinName) {
  const nameLower = (commonName || '').toLowerCase() + ' ' + (latinName || '').toLowerCase();
  
  if (nameLower.includes('milkweed') || nameLower.includes('asclepias')) {
    return placeholderImages.milkweed;
  }
  if (nameLower.includes('sunflower') || nameLower.includes('helianthus')) {
    return placeholderImages.sunflower;
  }
  if (nameLower.includes('coneflower') || nameLower.includes('echinacea') || 
      nameLower.includes('ratibida') || nameLower.includes('rudbeckia')) {
    return placeholderImages.coneflower;
  }
  if (nameLower.includes('mint') || nameLower.includes('mentha') || 
      nameLower.includes('pycnanthemum')) {
    return placeholderImages.mint;
  }
  if (nameLower.includes('monarda') || nameLower.includes('bee balm')) {
    return placeholderImages.monarda;
  }
  if (nameLower.includes('sage') || nameLower.includes('salvia')) {
    return placeholderImages.sage;
  }
  if (nameLower.includes('aster') || nameLower.includes('symphyotrichum')) {
    return placeholderImages.aster;
  }
  
  return placeholderImages.default;
}

// Helper function to generate plant features
function generatePlantFeatures(commonName, latinName) {
  const nameLower = (commonName || '').toLowerCase() + ' ' + (latinName || '').toLowerCase();
  const features = [];
  
  // Sun exposure
  if (Math.random() > 0.5) {
    features.push('Full sun');
  } else {
    features.push('Part sun to part shade');
  }
  
  // Height
  const heights = ['1-2ft', '2-3ft', '3-4ft', '4-5ft', '5-6ft'];
  features.push(heights[Math.floor(Math.random() * heights.length)] + ' tall');
  
  // Pollinators
  if (nameLower.includes('butterfly') || nameLower.includes('bee balm') || 
      nameLower.includes('monarda') || nameLower.includes('coneflower') || 
      nameLower.includes('asclepias') || nameLower.includes('echinacea')) {
    features.push('Attracts butterflies and bees');
  }
  
  // Drought tolerance
  if (Math.random() > 0.5) {
    features.push('Drought tolerant');
  }
  
  // Deer resistance
  if (Math.random() > 0.3) {
    features.push('Deer resistant');
  }
  
  // Bloom time
  const seasons = ['Spring', 'Summer', 'Fall'];
  features.push('Blooms in ' + seasons[Math.floor(Math.random() * seasons.length)]);
  
  return features;
}

// Helper function to generate description from features
function generateDescription(commonName, latinName, features) {
  commonName = commonName || 'Native Plant';
  latinName = latinName || '';
  features = features || [];
  
  const fullDescription = `${commonName} (${latinName}) is a beautiful native plant that adds color and ecological value to any garden. ${features.join('. ')}. This plant is ideal for naturalized areas, rain gardens, and pollinator-friendly landscapes.`;
  
  return fullDescription;
}

// Helper function to generate a fixed URL for an image
function getImageUrl(imageSrc, plantName, folderPath) {
  // If no imageSrc provided, get a placeholder
  if (!imageSrc) {
    return null;
  }
  
  // For actual deployment, you would upload to Firebase Storage
  // For now, we'll use a fixed placeholder with the plant name
  const sanitizedPlantName = (plantName || 'plant')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  
  return `https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?plant=${sanitizedPlantName}`;
}

// Seed database with plants from CSV
async function seedPlants() {
  console.log('Starting to seed plants from CSV file...');
  
  try {
    // First, add categories
    for (const category of plantCategories) {
      try {
        const sanitizedCategory = sanitizeForFirestore(category);
        const docRef = await addDoc(collection(db, 'categories'), {
          ...sanitizedCategory,
          createdAt: serverTimestamp()
        });
        console.log(`Added category: ${category.name} with ID: ${docRef.id}`);
      } catch (error) {
        console.error(`Error adding category ${category.name}:`, error.message);
      }
    }
    
    // Now parse the CSV and add plants
    const plantData = [];
    const plantCsvPath = path.join(__dirname, '..', 'plant pages', '2025 Hearthfire Plant List - Sheet1.csv');
    console.log('Looking for CSV file at:', plantCsvPath);
    
    if (!fs.existsSync(plantCsvPath)) {
      throw new Error(`CSV file not found at: ${plantCsvPath}`);
    }
    
    fs.createReadStream(plantCsvPath)
      .pipe(csv())
      .on('data', (data) => {
        plantData.push(data);
      })
      .on('end', async () => {
        console.log(`CSV file successfully processed, found ${plantData.length} plants.`);
        
        // Process plants one by one with delay to avoid overwhelming Firestore
        for (const plant of plantData) {
          try {
            const commonName = plant['Common Name'];
            const latinName = plant['Latin Name'];
            
            if (!commonName || !latinName) {
              console.log('Skipping plant with missing name:', plant);
              continue;
            }
            
            // Look for HTML file with plant information
            const htmlFilePath = findPlantHtmlFile(commonName);
            
            let features = [];
            let imageSrc = null;
            let imageUrl = null;
            
            if (htmlFilePath) {
              console.log(`Found HTML file for ${commonName} at ${htmlFilePath}`);
              
              // Extract information from HTML
              const htmlInfo = extractPlantInfoFromHtml(htmlFilePath);
              
              if (htmlInfo.features && htmlInfo.features.length > 0) {
                features = htmlInfo.features.map(feature => 
                  (feature || '').trim().substring(0, 500) // Limit length to avoid potential issues
                );
              }
              
              if (htmlInfo.imageSrc) {
                imageSrc = htmlInfo.imageSrc;
                // Generate a URL for the image
                imageUrl = getImageUrl(imageSrc, commonName, path.dirname(htmlFilePath));
              }
            }
            
            // If no features were extracted from HTML or no HTML file was found, generate them
            if (features.length === 0) {
              features = generatePlantFeatures(commonName, latinName);
            }
            
            // If no image was found, use a placeholder
            if (!imageUrl) {
              imageUrl = getImageForPlant(commonName, latinName);
            }
            
            // Create the product object with primitive types only
            const productData = {
              name: commonName,
              latinName: latinName,
              description: generateDescription(commonName, latinName, features).substring(0, 1000), // Limit description length
              price: parseFloat((Math.random() * 10 + 4.99).toFixed(2)), // Convert to number
              image: imageUrl,
              quantity: Math.floor(Math.random() * 50) + 10,
              category: determinePlantCategory(commonName, latinName),
              featured: Math.random() > 0.7, 
              unit: 'plant',
              features: features.slice(0, 10).map(f => String(f)), // Limit number of features and ensure strings
              nativePlant: true,
              careInstructions: 'Water regularly until established. After establishment, water as needed based on conditions.'
            };
            
            // Sanitize the data before sending to Firestore
            const sanitizedData = sanitizeForFirestore(productData);
            
            // Add product to Firestore
            const docRef = await addDoc(collection(db, 'products'), {
              ...sanitizedData,
              createdAt: serverTimestamp()
            });
            
            console.log(`Added plant: ${commonName} with ID: ${docRef.id}`);
            
            // Add a small delay between writes to avoid overwhelming Firestore
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (error) {
            console.error(`Error processing plant:`, error.message);
            // Continue with next plant instead of stopping the whole process
            continue;
          }
        }
        
        console.log('Database seeding completed successfully!');
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error);
      });
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// Run the seeding function
seedPlants(); 