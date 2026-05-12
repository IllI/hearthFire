// Optimized Plant Seeder Script
// Features improved image selection and detailed plant descriptions
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin if not already initialized
if (!global.firebaseAdminInitialized && admin.apps.length === 0) {
  console.log('Attempting to initialize Firebase Admin...');
  
  try {
    // Prioritize service account key since we have it configured
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey && !serviceAccountKey.includes('YOUR_PRIVATE_KEY')) {
      try {
        // Try parsing the service account key from the environment variable
        const serviceAccount = JSON.parse(serviceAccountKey);

        console.log('Initializing Firebase Admin with service account credentials');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });

        global.firebaseAdminInitialized = true;
        console.log('✅ Firebase Admin initialized successfully with service account');
      } catch (parseError) {
        console.error('Error parsing service account key:', parseError);
        
        // Fall back to application default credentials
        try {
          console.log('Falling back to application default credentials...');
          admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms'
          });
          global.firebaseAdminInitialized = true;
          console.log('✅ Firebase Admin initialized with application default credentials');
        } catch (adcError) {
          console.error('Error initializing with application default credentials:', adcError.message);
          process.exit(1);
        }
      }
    } else {
      // No valid service account key, try application default credentials
      try {
        console.log('No valid service account key found. Initializing with application default credentials...');
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms'
        });
        global.firebaseAdminInitialized = true;
        console.log('✅ Firebase Admin initialized with application default credentials');
      } catch (error) {
        console.error('Error initializing with application default credentials:', error.message);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const productsRef = db.collection('products');

// Define site base URL
const siteBaseUrl = 'http://localhost:3000';

// Plant categories with improved descriptions
const plantCategories = [
  {
    name: 'Native Plants',
    slug: 'native-plants',
    description: 'Native plants adapted to local conditions, supporting biodiversity and providing habitat for wildlife.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Echinacea_purpurea_GotBot_2015_001.jpg/800px-Echinacea_purpurea_GotBot_2015_001.jpg'
  },
  {
    name: 'Medicinal Herbs',
    slug: 'medicinal-herbs',
    description: 'Plants with traditional medicinal properties, used for centuries in herbal remedies and healing traditions.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Echinacea_-_im_Einsatz_gegen_Erk%C3%A4ltungskrankheiten.jpg/800px-Echinacea_-_im_Einsatz_gegen_Erk%C3%A4ltungskrankheiten.jpg'
  },
  {
    name: 'Pollinator Friendly',
    slug: 'pollinator-friendly',
    description: 'Plants that attract and support pollinators like bees, butterflies, and hummingbirds, helping maintain ecosystem health.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Bee_on_flower_at_Indhus_Valley.jpg/800px-Bee_on_flower_at_Indhus_Valley.jpg'
  },
  {
    name: 'Culinary Herbs',
    slug: 'culinary-herbs',
    description: 'Flavorful herbs for cooking, teas, and other culinary uses, adding both taste and nutritional benefits to your meals.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Basil-Basilico-Ocimum_basilicum-albahaca.jpg/800px-Basil-Basilico-Ocimum_basilicum-albahaca.jpg'
  }
];

// Track used images to prevent duplication
const usedImages = new Map();

// Add cache for Pexels responses
const pexelsCache = new Map();

// Add progress tracking
let totalPlants = 0;
let processedPlants = 0;
let failedPlants = 0;

// Add rate limiting state
let lastApiCall = 0;
const MIN_API_INTERVAL = 2000; // Minimum 2 seconds between API calls

// Function to normalize plant names for better matching
function normalizePlantName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^\w\s,]/g, '')  // Remove special chars except commas
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim();
}

// Function to get optimal search terms for Pexels
function getOptimalSearchTerms(commonName, latinName) {
  const terms = new Set();
  
  // Clean and normalize names
  const cleanCommonName = commonName.replace(/[,'"]/g, '').trim();
  const cleanLatinName = latinName.replace(/[,'"]/g, '').trim();
  
  // Add full names
  terms.add(cleanCommonName);
  if (cleanLatinName) terms.add(cleanLatinName);
  
  // Add genus and species separately
  if (cleanLatinName) {
    const [genus, species] = cleanLatinName.split(' ');
    if (genus) terms.add(genus);
    if (species) terms.add(species);
  }
  
  // Add common name parts
  const commonParts = cleanCommonName.split(' ');
  if (commonParts.length > 1) {
    // Add combinations of parts
    terms.add(commonParts.join(' '));
    terms.add(commonParts.slice(-2).join(' ')); // Last two words
    terms.add(commonParts[0]); // First word
  }
  
  // Add botanical context
  terms.add(`${cleanCommonName} plant`);
  terms.add(`${cleanCommonName} flower`);
  if (cleanLatinName) {
    terms.add(`${cleanLatinName} botanical`);
    terms.add(`${cleanLatinName} garden`);
  }
  
  return Array.from(terms);
}

// Add delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Update searchPexels function with better rate limiting
async function searchPexels(query) {
  // Check cache first
  if (pexelsCache.has(query)) {
    console.log(`Using cached image for "${query}"`);
    return pexelsCache.get(query);
  }

  if (!process.env.PEXELS_API_KEY) {
    console.warn('No Pexels API key found. Skipping image update.');
    return null;
  }

  try {
    // Ensure minimum time between API calls
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    if (timeSinceLastCall < MIN_API_INTERVAL) {
      await delay(MIN_API_INTERVAL - timeSinceLastCall);
    }
    
    console.log(`Trying Pexels query: "${query}"...`);
    lastApiCall = Date.now();
    
    const response = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
      headers: {
        'Authorization': process.env.PEXELS_API_KEY
      }
    });

    if (response.data.photos && response.data.photos.length > 0) {
      const imageUrl = response.data.photos[0].src.large;
      // Cache the result
      pexelsCache.set(query, imageUrl);
      return imageUrl;
    }
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log('Rate limited by Pexels API. Waiting 60 seconds before retrying...');
      await delay(60000); // Wait 60 seconds on rate limit
      return searchPexels(query); // Retry the request
    }
    console.error(`Error searching Pexels for "${query}":`, error.message);
  }
  return null;
}

// Function to determine plant category
function getPlantCategory(commonName, latinName) {
  const normalizedCommonName = (commonName || '').toLowerCase();
  const normalizedLatinName = (latinName || '').toLowerCase();
  
  // Define category rules based on common and Latin names
  const categoryRules = [
    // Medicinal herbs
    {
      category: 'medicinal-herbs',
      matches: ['echinacea', 'valerian', 'yarrow', 'nettle', 'stinging nettle', 'boneset', 
                'hibiscus', 'rose mallow', 'skullcap', 'st. johns wort', 'holy basil', 'tulsi', 
                'elecampane']
    },
    // Culinary herbs
    {
      category: 'culinary-herbs',
      matches: ['mint', 'thyme', 'oregano', 'sage', 'anise hyssop', 'marjoram', 'catnip', 
                'peppermint', 'spearmint', 'rosemary', 'basil']
    },
    // Pollinator friendly
    {
      category: 'pollinator-friendly',
      matches: ['bee balm', 'monarda', 'milkweed', 'asclepias', 'butterfly', 'coneflower', 
                'sunflower', 'aster', 'vervain', 'bergamot', 'indigo', 'ironweed', 'joe pye',
                'cardinal', 'lobelia', 'royal catchfly', 'silene', 'passionflower']
    }
  ];
  
  // Check for category matches
  for (const rule of categoryRules) {
    const isMatch = rule.matches.some(match => 
      normalizedCommonName.includes(match) || normalizedLatinName.includes(match)
    );
    
    if (isMatch) {
      return rule.category;
    }
  }
  
  // Default to native plants if no specific category matches
  return 'native-plants';
}

// Function to generate a description for a plant
function generateDescription(commonName, latinName) {
  const category = getPlantCategory(commonName, latinName);
  let description = `${commonName}`;
  
  if (latinName) {
    description += ` (${latinName})`;
  }
  
  description += ' is a ';
  
  switch (category) {
    case 'native-plants':
      description += 'valuable native plant that supports local ecosystems and wildlife. This adaptable perennial adds natural beauty to gardens while requiring minimal maintenance once established. Perfect for naturalized areas, rain gardens, and native plant landscapes.';
      break;
    case 'medicinal-herbs':
      description += 'versatile medicinal herb with a long history of traditional use. Its healing properties make it valuable for herbal preparations, while its attractive appearance adds beauty to garden spaces. This resilient plant grows well in herb gardens, sunny borders, and naturalized settings.';
      break;
    case 'pollinator-friendly':
      description += 'pollinator magnet, attracting bees, butterflies, and other beneficial insects to the garden. Its nectar-rich flowers provide essential resources for wildlife while adding vibrant color to the landscape. Ideal for butterfly gardens, meadow plantings, and eco-friendly landscapes.';
      break;
    case 'culinary-herbs':
      description += 'flavorful culinary herb that enhances a variety of dishes with its distinctive taste. Easy to grow in gardens or containers, it offers both practical and ornamental value. This versatile herb thrives in well-drained soil and sunny locations, perfect for kitchen gardens, raised beds, or mixed borders.';
      break;
    default:
      description += 'wonderful addition to any garden, offering beautiful blooms and ecological benefits. This adaptable plant attracts beneficial wildlife while adding visual interest to the landscape. Incorporate it into perennial borders, naturalized areas, or themed garden spaces for best effect.';
  }
  
  return description;
}

// Function to sanitize text for Firestore
function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim()                        // Trim leading/trailing whitespace
    .substring(0, 500);           // Limit length to 500 characters
}

// Function to generate a shorter description
function generateShortDescription(commonName, latinName) {
  const category = getPlantCategory(commonName, latinName);
  let description = `${commonName}`;
  
  if (latinName) {
    description += ` (${latinName})`;
  }
  
  description += ' is a ';
  
  switch (category) {
    case 'native-plants':
      description += 'valuable native plant that supports local ecosystems.';
      break;
    case 'medicinal-herbs':
      description += 'versatile medicinal herb with traditional healing properties.';
      break;
    case 'pollinator-friendly':
      description += 'pollinator magnet that attracts bees and butterflies.';
      break;
    case 'culinary-herbs':
      description += 'flavorful culinary herb that enhances dishes.';
      break;
    default:
      description += 'wonderful addition to any garden.';
  }
  
  return sanitizeText(description);
}

// Function to validate and format product data for Firestore
function formatProductData(data) {
  return {
    name: String(data.name || '').trim().substring(0, 500),
    description: String(data.description || '').trim().substring(0, 1500),
    price: Number(data.price || 0),
    image: String(data.image || ''),
    images: [String(data.image || '')], // Store as array to match schema
    quantity: Math.max(0, Math.floor(Number(data.quantity || 0))),
    stock: Math.max(0, Math.floor(Number(data.quantity || 0))), // Keep both fields in sync
    category: String(data.category || '').trim(),
    featured: Boolean(data.featured),
    unit: String(data.unit || 'each').trim(),
    organic: false // Default value
  };
}

// Function to update progress
function updateProgress() {
  const progress = ((processedPlants + failedPlants) / totalPlants * 100).toFixed(1);
  console.log(`Progress: ${progress}% (${processedPlants + failedPlants}/${totalPlants}) - Success: ${processedPlants}, Failed: ${failedPlants}`);
}

// Function to process plants in batches with increased parallelization
async function processPlantBatch(plants, batchSize = 5) { // Reduced batch size to 5
  const batches = [];
  for (let i = 0; i < plants.length; i += batchSize) {
    batches.push(plants.slice(i, i + batchSize));
  }

  console.log(`Processing ${plants.length} plants in ${batches.length} batches of ${batchSize}...`);

  for (const currentBatch of batches) {
    // Process images sequentially to avoid rate limiting
    const plantsWithImages = [];
    for (const plant of currentBatch) {
      const commonName = plant['Common Name'] || '';
      const latinName = plant['Latin Name'] || '';
      
      // Get optimal search terms
      const searchTerms = getOptimalSearchTerms(commonName, latinName);
      
      // Try each search term until we find an image
      let imageUrl = null;
      for (const term of searchTerms) {
        if (pexelsCache.has(term)) {
          imageUrl = pexelsCache.get(term);
          break;
        }
      }
      
      // If no cached image found, try Pexels API
      if (!imageUrl) {
        imageUrl = await searchPexels(commonName);
      }
      
      plantsWithImages.push({ ...plant, imageUrl });
    }

    // Create a batch write
    const firestoreBatch = db.batch();
    
    for (const plant of plantsWithImages) {
      const commonName = plant['Common Name'] || '';
      const latinName = plant['Latin Name'] || '';
      const category = getPlantCategory(commonName, latinName);
      
      const initialData = {
        name: commonName,
        description: plant['Description'] || generateShortDescription(commonName, latinName),
        price: 9.99,
        image: plant.imageUrl || '',
        images: plant.imageUrl ? [plant.imageUrl] : [],
        quantity: 0,
        category: category,
        featured: false,
        unit: plant['Unit'] || 'each',
        organic: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const productData = formatProductData(initialData);
      const docRef = productsRef.doc();
      firestoreBatch.set(docRef, productData);
    }

    // Commit the batch with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await firestoreBatch.commit();
        processedPlants += plantsWithImages.length;
        updateProgress();
        console.log(`✅ Successfully processed batch of ${plantsWithImages.length} plants`);
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          console.error('❌ Error committing batch after retries:', error);
          failedPlants += plantsWithImages.length;
          updateProgress();
          // Try individual writes as fallback
          for (const plant of plantsWithImages) {
            try {
              const commonName = plant['Common Name'] || '';
              const docRef = await productsRef.add({
                ...formatProductData({
                  name: commonName,
                  description: plant['Description'] || generateShortDescription(commonName, plant['Latin Name'] || ''),
                  price: 9.99,
                  image: plant.imageUrl || '',
                  images: plant.imageUrl ? [plant.imageUrl] : [],
                  quantity: 0,
                  category: getPlantCategory(commonName, plant['Latin Name'] || ''),
                  featured: false,
                  unit: plant['Unit'] || 'each',
                  organic: false,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                })
              });
              processedPlants++;
              updateProgress();
              console.log(`✅ Added ${commonName} with ID: ${docRef.id}`);
            } catch (retryError) {
              failedPlants++;
              updateProgress();
              console.error(`❌ Failed to add ${commonName}:`, retryError);
            }
          }
        } else {
          console.log(`Retrying batch commit (attempt ${retryCount + 1}/${maxRetries})...`);
          await delay(1000 * retryCount); // Exponential backoff
        }
      }
    }

    // Small delay between batches to avoid overwhelming Firestore
    await delay(100); // Increased delay between batches
  }
}

// Update seedPlants function to use batch processing with progress tracking
async function seedPlants() {
  console.log('Starting to seed plants from CSV file...');
  
  const results = [];
  const csvPath = path.join(__dirname, '..', 'plant pages', '2025 Hearthfire Plant List - Sheet1.csv');
  
  console.log('Looking for CSV file at:', csvPath);
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          totalPlants = results.length;
          console.log(`CSV file successfully processed, found ${totalPlants} plants.`);
          
          // Process plants in batches
          await processPlantBatch(results);
          
          console.log('\nFinal Results:');
          console.log(`Total Plants: ${totalPlants}`);
          console.log(`Successfully Processed: ${processedPlants}`);
          console.log(`Failed: ${failedPlants}`);
          console.log(`Success Rate: ${((processedPlants / totalPlants) * 100).toFixed(1)}%`);
          
          resolve();
        } catch (error) {
          console.error('Error seeding database:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('Error reading CSV:', error);
        reject(error);
      });
  });
}

// Run the seeding function
seedPlants()
  .then(() => console.log('✅ Seeding process completed successfully!'))
  .catch(error => {
    console.error('❌ Error during seeding process:', error);
    process.exit(1);
  }); 