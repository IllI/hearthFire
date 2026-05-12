require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

const db = admin.firestore();
const productsRef = db.collection('products');

// Cache for image search results
const imageCache = new Map();

// Delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to get better search terms
function getOptimizedSearchTerms(plant) {
  const commonName = plant['Common Name'] || '';
  const latinName = plant['Latin Name'] || '';
  
  // Build search variations
  const terms = [];
  
  // Add specific qualifiers
  terms.push(`${commonName} plant photo`);
  terms.push(`${commonName} garden plant`);
  
  // Add Latin name if available
  if (latinName) {
    terms.push(`${latinName} plant photo`);
  }
  
  // Add category-specific terms
  if (plant.category === 'vegetables') {
    terms.push(`${commonName} vegetable plant growing`);
  } else if (plant.category === 'herbs') {
    terms.push(`${commonName} herb plant growing`);
  }
  
  return terms;
}

// Function to search images using Brave Search API
async function searchBraveImages(query) {
  if (imageCache.has(query)) {
    console.log(`Using cached image for "${query}"`);
    return imageCache.get(query);
  }

  try {
    console.log(`Searching Brave for: "${query}"...`);
    
    const response = await axios.get('https://api.search.brave.com/res/v1/images/search', {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_API_KEY
      },
      params: {
        q: query,
        count: 5, // Get multiple results to choose from
        freshness: 'past_year',
        size: 'large'
      }
    });

    if (response.data && response.data.results && response.data.results.length > 0) {
      // Filter for high-quality images and appropriate dimensions
      const validImages = response.data.results.filter(img => {
        const ratio = img.height / img.width;
        return (
          img.height >= 800 && // Minimum height
          img.width >= 800 && // Minimum width
          ratio >= 0.5 && ratio <= 2 && // Reasonable aspect ratio
          !img.title.toLowerCase().includes('logo') // Avoid logos
        );
      });

      if (validImages.length > 0) {
        const imageUrl = validImages[0].url;
        imageCache.set(query, imageUrl);
        return imageUrl;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching Brave for "${query}":`, error.message);
    if (error.response?.status === 429) {
      console.log('Rate limited. Waiting 2 seconds...');
      await delay(2000);
      return searchBraveImages(query);
    }
    return null;
  }
}

// Function to process plants in batches
async function processPlantBatch(plants, batchSize = 5) {
  const batches = [];
  for (let i = 0; i < plants.length; i += batchSize) {
    batches.push(plants.slice(i, i + batchSize));
  }

  console.log(`Processing ${plants.length} plants in ${batches.length} batches of ${batchSize}...`);
  let processedCount = 0;

  for (const batch of batches) {
    const plantsWithImages = [];
    
    // Process each plant in the batch
    for (const plant of batch) {
      const searchTerms = getOptimizedSearchTerms(plant);
      let imageUrl = null;
      
      // Try each search term until we find a good image
      for (const term of searchTerms) {
        imageUrl = await searchBraveImages(term);
        if (imageUrl) break;
        await delay(1000); // Respect rate limits
      }
      
      plantsWithImages.push({ ...plant, imageUrl });
      processedCount++;
      console.log(`Progress: ${(processedCount / plants.length * 100).toFixed(1)}% (${processedCount}/${plants.length})`);
    }

    // Create a batch write
    const batch = db.batch();
    
    for (const plant of plantsWithImages) {
      const commonName = plant['Common Name'] || '';
      const category = plant.category || 'native-plants';
      
      const productData = {
        name: commonName,
        description: plant['Description'] || `${commonName} is a valuable native plant that supports local ecosystems.`,
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

      const docRef = productsRef.doc();
      batch.set(docRef, productData);
    }

    // Commit the batch
    try {
      await batch.commit();
      console.log(`✅ Successfully processed batch of ${plantsWithImages.length} plants`);
    } catch (error) {
      console.error('❌ Error committing batch:', error);
      // Individual retries if batch fails
      for (const plant of plantsWithImages) {
        try {
          await productsRef.add({
            name: plant['Common Name'],
            description: plant['Description'] || `${plant['Common Name']} is a valuable native plant that supports local ecosystems.`,
            price: 9.99,
            image: plant.imageUrl || '',
            images: plant.imageUrl ? [plant.imageUrl] : [],
            quantity: 0,
            category: plant.category || 'native-plants',
            featured: false,
            unit: plant['Unit'] || 'each',
            organic: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (retryError) {
          console.error(`❌ Failed to add ${plant['Common Name']}:`, retryError);
        }
      }
    }

    // Small delay between batches
    await delay(1000);
  }
}

// Main function to seed plants
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
      .pipe(require('csv')())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          console.log(`CSV file successfully processed, found ${results.length} plants.`);
          await processPlantBatch(results);
          console.log('Database seeding completed successfully!');
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

// Run the seeder
seedPlants()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error during seeding process:', error);
    process.exit(1);
  }); 