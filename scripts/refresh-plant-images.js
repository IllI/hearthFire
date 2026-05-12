/**
 * Refresh Plant Images
 * 
 * This script refreshes all plant images in the database by fetching more accurate
 * images from the Pexels API using carefully crafted search queries.
 * It also provides better fallbacks for cases where specific images can't be found.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const csv = require('csv-parser');
const dotenv = require('dotenv');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Load environment variables from .env.local file
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Define paths
const PUBLIC_IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'plants');
const CATEGORIES_DIR = path.join(__dirname, '..', 'public', 'images', 'categories');
const CSV_PATH = path.join(__dirname, '..', 'plant pages', '2025 Hearthfire Plant List - Sheet1.csv');

// Map to track which image URLs have been used by which plants
const usedImageUrls = new Map();
// Keep track of statistics
const stats = {
  plantsProcessed: 0,
  plantsUpdated: 0,
  uniqueImagesUsed: 0,
  fallbackImageUsed: 0,
  failedUpdates: 0
};

// Function to normalize plant names for file/directory naming
function normalizePlantName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .trim();                   // Trim whitespace
}

// Function to get optimal search terms for a plant
function getOptimalSearchTerms(commonName, latinName) {
  if (!latinName) {
    // If no Latin name is available, use common name with botanical qualifiers
    return [
      `${commonName} botanical plant photograph`,
      `${commonName} wildflower native plant`,
      `${commonName} garden plant photograph`,
    ];
  }
  
  // Extract genus and species from Latin name
  const parts = latinName.split(' ');
  const genus = parts[0];
  const species = parts.length > 1 ? parts[1] : '';
  
  // Create search queries that STRONGLY prioritize Latin name for botanical accuracy
  const queries = [
    // EXACT Latin name searches - highest priority
    `${latinName} plant`,
    `${latinName} botanical`,
    `${latinName} flower`,
    `${latinName} native plant photograph`,
    // Genus + Species searches with botanical qualifiers
    `${genus} ${species} botanical plant`,
    `${genus} ${species} wildflower`,
    // Common name + Latin name combinations
    `${commonName} ${latinName} plant`,
    // Genus searches (for when species-specific images are hard to find)
    `${genus} species plant photograph`,
    `${genus} botanical garden`,
    // Common name with botanical qualifiers as fallback
    `${commonName} wildflower botanical`,
    // More generic plant-focused terms for rare plants
    `native plant wildflower ${genus}`
  ];
  
  return queries;
}

// Function to download and save an image
async function downloadAndSaveImage(imageUrl, plantName, latinName = '') {
  try {
    if (typeof imageUrl === 'object' && imageUrl.url) {
      // Handle the new image result object format
      console.log(`Downloading image from ${imageUrl.url} for ${plantName}...`);
    } else {
      // Handle legacy string format
      console.log(`Downloading image from ${imageUrl} for ${plantName}...`);
      imageUrl = { url: imageUrl };
    }
    
    // Create normalized name and directory
    const normalizedName = normalizePlantName(plantName);
    const plantDir = path.join(PUBLIC_IMAGES_DIR, normalizedName);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(plantDir)) {
      fs.mkdirSync(plantDir, { recursive: true });
      console.log(`Created directory for ${plantName}: ${plantDir}`);
    }
    
    // Include Latin genus in filename if available (to ensure accuracy)
    let filename;
    if (latinName) {
      const genus = latinName.split(' ')[0].toLowerCase();
      
      // Add a timestamp to ensure uniqueness
      const timestamp = Date.now().toString().slice(-6);
      filename = `${normalizedName}-${genus}-${timestamp}.jpg`;
    } else {
      const timestamp = Date.now().toString().slice(-6);
      filename = `${normalizedName}-${timestamp}.jpg`;
    }
    
    const filePath = path.join(plantDir, filename);
    const webPath = `/images/plants/${normalizedName}/${filename}`;
    
    // Download the image
    const response = await axios({
      method: 'GET',
      url: imageUrl.url,
      responseType: 'stream',
      timeout: 15000, // 15 second timeout
    });
    
    // Save the image
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        // Verify the file exists and has content
        try {
          const stats = fs.statSync(filePath);
          if (stats.size > 0) {
            console.log(`✅ Image saved successfully to ${filePath} (${stats.size} bytes)`);
            resolve(webPath);
          } else {
            fs.unlinkSync(filePath); // Delete empty file
            throw new Error('Downloaded file is empty');
          }
        } catch (err) {
          reject(err);
        }
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error downloading image for ${plantName}:`, error.message);
    throw error;
  }
}

// Function to search Pexels for the best image
async function searchPexelsForBestImage(commonName, latinName) {
  if (!process.env.PEXELS_API_KEY) {
    console.log('⚠️ No Pexels API key found. Skipping image update.');
    return null;
  }
  
  // Initialize usedImageUrls Map from database if it's empty
  if (usedImageUrls.size === 0) {
    try {
      console.log('Loading previously used image URLs from database...');
      
      // Get all plants from database
      const allPlantsSnapshot = await getDocs(collection(db, "products"));
      const allPlants = allPlantsSnapshot.docs.map(doc => doc.data());
      
      // Track all image URLs being used
      let urlCount = 0;
      for (const plant of allPlants) {
        // Skip plants without imageSource data
        if (!plant.imageSource || !plant.imageSource.url) continue;
        
        usedImageUrls.set(plant.imageSource.url, plant.name);
        urlCount++;
      }
      
      console.log(`Loaded ${urlCount} previously used image URLs.`);
    } catch (error) {
      console.log('Failed to load used image URLs:', error.message);
    }
  }
  
  // Get our search queries
  const searchTerms = getOptimalSearchTerms(commonName, latinName);
  
  // Special debugging for Blue Vervain
  if (commonName === 'Blue Vervain') {
    console.log('\n🔍 DEBUGGING Blue Vervain:');
    console.log('Latin Name:', latinName);
    console.log('Search Terms:', JSON.stringify(searchTerms, null, 2));
  }
  
  // Words that might indicate inappropriate content or wrong subject matter
  const filterOutWords = [
    'marijuana', 'cannabis', 'weed', 'drug', 'smoke', 'hands', 'person', 'people', 'hold', 
    'frame', 'art', 'wall', 'poster', 'painting', 'shop', 'drawing', 'illustration', 'food',
    'dried', 'powder', 'medicine', 'capsule', 'extract', 'supplement', 'pills', 'tablet', 
    'background', 'isolated', 'pattern', 'design', 'logo', 'interior', 'room', 'decor',
    'canva', 'youtube', 'video', 'thumbnail', 'banner', 'advertisement', 'ad', 'app'
  ];
  
  // Words that strongly indicate a good botanical image
  const preferredWords = [
    'botanical', 'garden', 'wildflower', 'native plant', 'flower', 'bloom', 'field',
    'species', 'herbarium', 'taxonomy', 'scientific', 'flora', 'specimen', 'blooming',
    'plant', 'herb', 'perennial', 'annual'
  ];
  
  // Botanical context indicators that suggest a true plant photo
  const botanicalContextWords = [
    'growing', 'habitat', 'wild', 'perennial', 'annual', 'leaves', 'stem', 
    'inflorescence', 'petals', 'flowering', 'natural', 'meadow', 'prairie'
  ];
  
  // Track all eligible images across all queries to select from later
  let allEligibleImages = [];
  let totalPhotosFound = 0;
  
  // If we're still not finding suitable images, try adjusting the search strategy
  const searchStrategies = [
    { per_page: 30, orientation: 'landscape' },  // Default strategy
    { per_page: 30, orientation: 'portrait' },   // Try portrait images too
    { per_page: 15, orientation: 'square' },     // Try square images
    { per_page: 50, orientation: 'landscape' }   // Try more images in landscape
  ];
  
  // Try each query with potentially multiple strategies until we find good images
  for (const query of searchTerms) {
    console.log(`Trying Pexels query: "${query}"...`);
    
    // Try different search strategies in sequence
    for (const strategy of searchStrategies) {
      // Skip additional strategies if we already found enough images
      if (allEligibleImages.length > 10) {
        break;
      }
      
      try {
        const response = await axios.get('https://api.pexels.com/v1/search', {
          params: {
            query: query,
            per_page: strategy.per_page,
            size: 'medium',
            orientation: strategy.orientation
          },
          headers: {
            'Authorization': `${process.env.PEXELS_API_KEY}`
          }
        });
        
        if (response.data.photos && response.data.photos.length > 0) {
          totalPhotosFound += response.data.photos.length;
          
          // Special debugging for Blue Vervain
          if (commonName === 'Blue Vervain') {
            console.log(`🔍 Found ${response.data.photos.length} photos from Pexels for query "${query}" (${strategy.orientation})`);
            if (allEligibleImages.length === 0) {
              console.log('First 3 photos alt text:');
              response.data.photos.slice(0, 3).forEach((photo, i) => {
                console.log(`  ${i+1}. ${photo.alt || 'No alt text'} (Score: calculating...)`);
              });
            }
          }
          
          // Filter out potentially inappropriate images
          let filteredPhotos = response.data.photos.filter(photo => {
            // Skip photos without alt text (but only when we have enough options)
            // This helps with plants that have few images available
            if (!photo.alt && allEligibleImages.length > 5) return false;
            
            // For photos without alt text, create a minimal description
            const altText = photo.alt ? photo.alt.toLowerCase() : 'photo';
            
            // Filter out photos with banned terms
            const hasBannedTerm = filterOutWords.some(word => altText.includes(word));
            if (hasBannedTerm) {
              return false;
            }
            
            return true;
          });
          
          if (filteredPhotos.length > 0) {
            // Score photos based on relevance
            const scoredPhotos = filteredPhotos.map(photo => {
              let score = 0;
              const altText = photo.alt ? photo.alt.toLowerCase() : '';
              const imageUrl = photo.src.large;
              
              // Check if this image URL has been used before - STRONGEST PENALTY
              if (usedImageUrls.has(imageUrl)) {
                // Penalize heavily for reusing images
                score -= 1000;
                
                // For debugging
                const previousPlant = usedImageUrls.get(imageUrl);
                console.log(`⚠️ This image was already used for ${previousPlant} (-1000 score)`);
              }
              
              // For photos with no alt text, give a basic score but don't disqualify
              if (!altText) {
                score += 10; // Base score for photos without alt text
                
                // Add a small bonus for early queries - they're more likely to be relevant
                const queryIndex = searchTerms.indexOf(query);
                score += Math.max(0, 10 - queryIndex);
                
                return { photo, score, query, strategy: strategy.orientation };
              }
              
              // Check for exact Latin name match - HIGHEST PRIORITY
              if (latinName && altText.includes(latinName.toLowerCase())) {
                score += 150; // Much higher bonus for exact Latin name match
              }
              
              // Check for genus match - HIGH PRIORITY
              if (latinName) {
                const genus = latinName.split(' ')[0].toLowerCase();
                if (altText.includes(genus)) {
                  score += 75; // Increased bonus for genus match
                }
              }
              
              // Check for species match (if no genus match already counted)
              if (latinName && latinName.includes(' ')) {
                const species = latinName.split(' ')[1].toLowerCase();
                if (altText.includes(species) && !altText.includes(latinName.toLowerCase())) {
                  score += 40; // Bonus for species mention (without full Latin name)
                }
              }
              
              // Check for common name match
              if (altText.includes(commonName.toLowerCase())) {
                score += 25; // Moderate bonus for common name
              }
              
              // Bonus for preferred botanical terms
              for (const term of preferredWords) {
                if (altText.includes(term)) {
                  score += 15; // Increased bonus for botanical terms
                }
              }
              
              // Add points for botanical context words
              for (const term of botanicalContextWords) {
                if (altText.includes(term)) {
                  score += 10; // Increased bonus for context words
                }
              }
              
              // Extra bonus if both Latin name and 'botanical' are present - ideal match
              if (latinName && 
                  altText.includes(latinName.toLowerCase()) && 
                  altText.includes('botanical')) {
                score += 50; // Increased bonus for the perfect combination
              }
              
              // Extra points if the photo description suggests it's a specimen photo
              if (altText.includes('specimen') || 
                  altText.includes('herbarium') || 
                  altText.includes('taxonomy')) {
                score += 35; // Increased bonus for scientific context
              }
              
              // Prioritize query-specific images by tracking the query order
              // Earlier queries in our list are more relevant (Latin name focused)
              const queryIndex = searchTerms.indexOf(query);
              score += Math.max(0, 20 - (queryIndex * 2)); // Higher bonus for earlier queries
              
              // Add a random factor to break ties and increase variety (0-5 points)
              score += Math.random() * 5;
              
              return { photo, score, query, strategy: strategy.orientation };
            });
            
            // Add these scored photos to our overall collection
            allEligibleImages = allEligibleImages.concat(scoredPhotos);
          }
        }
      } catch (error) {
        console.log(`Error with Pexels API for query "${query}" (${strategy.orientation}): ${error.message}`);
        // Continue to next strategy/query if there's an error
      }
    }
  }
  
  // After trying all queries/strategies, sort all the collected images by score
  if (allEligibleImages.length > 0) {
    // Sort by score (highest first)
    allEligibleImages.sort((a, b) => b.score - a.score);
    
    // Special debugging for Blue Vervain
    if (commonName === 'Blue Vervain') {
      console.log(`Found ${allEligibleImages.length} eligible images out of ${totalPhotosFound} total photos`);
      console.log('Top 3 scored photos across all queries:');
      allEligibleImages.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i+1}. Score: ${item.score}, Alt: ${item.photo.alt || 'No alt text'}, Query: "${item.query}" (${item.strategy})`);
      });
      
      // Show the breakdown of the top photo's score
      if (allEligibleImages.length > 0) {
        const topPhoto = allEligibleImages[0];
        const altText = topPhoto.photo.alt ? topPhoto.photo.alt.toLowerCase() : 'no alt text';
        console.log('\nScore breakdown for top photo:');
        
        if (altText === 'no alt text') {
          console.log('- No alt text available, basic scoring applied');
        } else {
          if (latinName && altText.includes(latinName.toLowerCase())) {
            console.log('- Contains exact Latin name (+150)');
          }
          
          if (latinName) {
            const genus = latinName.split(' ')[0].toLowerCase();
            if (altText.includes(genus)) {
              console.log(`- Contains genus "${genus}" (+75)`);
            }
            
            if (latinName.includes(' ')) {
              const species = latinName.split(' ')[1].toLowerCase();
              if (altText.includes(species) && !altText.includes(latinName.toLowerCase())) {
                console.log(`- Contains species "${species}" (+40)`);
              }
            }
          }
          
          if (altText.includes(commonName.toLowerCase())) {
            console.log('- Contains common name (+25)');
          }
          
          console.log('- Botanical terms found:');
          for (const term of preferredWords) {
            if (altText.includes(term)) {
              console.log(`  * "${term}" (+15)`);
            }
          }
          
          console.log('- Botanical context words found:');
          for (const term of botanicalContextWords) {
            if (altText.includes(term)) {
              console.log(`  * "${term}" (+10)`);
            }
          }
          
          if (latinName && altText.includes(latinName.toLowerCase()) && altText.includes('botanical')) {
            console.log('- Perfect combination: Latin name + botanical (+50)');
          }
          
          if (altText.includes('specimen') || altText.includes('herbarium') || altText.includes('taxonomy')) {
            console.log('- Contains specimen/scientific terms (+35)');
          }
          
          if (usedImageUrls.has(topPhoto.photo.src.large)) {
            console.log(`- Image already used for ${usedImageUrls.get(topPhoto.photo.src.large)} (-1000)`);
          }
        }
        
        // Show query-based scoring
        const queryIndex = searchTerms.indexOf(topPhoto.query);
        console.log(`- Query priority bonus: ${Math.max(0, 20 - (queryIndex * 2))} points (query position: ${queryIndex + 1})`);
      }
    }
    
    // Use the highest-scoring photo
    const bestPhoto = allEligibleImages[0].photo;
    const imageUrl = bestPhoto.src.large;
    const sourceQuery = allEligibleImages[0].query;
    const sourceStrategy = allEligibleImages[0].strategy;
    
    // Mark this URL as used by this plant
    usedImageUrls.set(imageUrl, commonName);
    
    console.log(`✅ Found Pexels image for ${commonName} with query "${sourceQuery}" (${sourceStrategy})`);
    return { 
      url: imageUrl, 
      altText: bestPhoto.alt || `Photo of ${commonName} (${latinName || 'unknown species'})`,
      source: bestPhoto.src.original, 
      originalWidth: bestPhoto.width,
      originalHeight: bestPhoto.height,
      photographer: bestPhoto.photographer,
      photographerUrl: bestPhoto.photographer_url,
      query: sourceQuery,
      strategy: sourceStrategy
    };
  }
  
  console.log(`⚠️ No suitable images found on Pexels for ${commonName}`);
  return null;
}

// Function to get category image path
function getCategoryImagePath(category) {
  const categoryFileName = `${category}.jpg`;
  const categoryPath = `/images/categories/${categoryFileName}`;
  
  // Ensure the file actually exists
  const fullPath = path.join(__dirname, '..', 'public', categoryPath);
  if (fs.existsSync(fullPath)) {
    return categoryPath;
  }
  
  // Return default fallback if category image doesn't exist
  return '/images/categories/default.jpg';
}

// Function to get plant category
function getPlantCategory(commonName) {
  const name = commonName.toLowerCase();
  
  // Categories mapping
  const categories = {
    'native-plants': [
      'coneflower', 'milkweed', 'black-eyed susan', 'wild', 'native', 
      'echinacea', 'rudbeckia', 'aster', 'goldenrod', 'serviceberry'
    ],
    'medicinal-herbs': [
      'echinacea', 'yarrow', 'valerian', 'calendula', 'chamomile', 
      'feverfew', 'comfrey', 'holy basil', 'medicinal', 'healing'
    ],
    'pollinator-friendly': [
      'bee balm', 'butterfly', 'milkweed', 'coneflower', 'echinacea',
      'lavender', 'catmint', 'salvia', 'pollinator', 'honeybee'
    ],
    'culinary-herbs': [
      'basil', 'thyme', 'mint', 'sage', 'rosemary', 'parsley', 
      'cilantro', 'chives', 'oregano', 'culinary', 'edible'
    ]
  };
  
  // Find matching category
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }
  
  // Default category for plants that don't match any specific category
  return 'native-plants';
}

/**
 * Main function to refresh plant images.
 * Fetches plants from Firestore and updates their images with better matches.
 */
async function refreshPlantImages(specificPlantName = null) {
  console.log('Starting plant image refresh process...');
  console.log('Using Latin names for botanical accuracy when available.\n');
  
  try {
    // Get all plants from Firestore
    const plantsSnapshot = await getDocs(collection(db, "products"));
    
    // Convert to array of plants
    let plants = plantsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${plants.length} plants in the database.`);
    
    // If a specific plant name is provided, filter to just that plant
    if (specificPlantName) {
      console.log(`Filtering to only process plant: "${specificPlantName}"`);
      
      plants = plants.filter(plant => {
        const nameMatches = plant.name.toLowerCase().includes(specificPlantName.toLowerCase());
        const latinMatches = plant.latinName && plant.latinName.toLowerCase().includes(specificPlantName.toLowerCase());
        
        return nameMatches || latinMatches;
      });
      
      if (plants.length === 0) {
        console.error(`❌ No plant found matching "${specificPlantName}"`);
        return;
      } else {
        console.log(`Found ${plants.length} matching plants.`);
      }
    }
    
    // Process each plant
    for (const plant of plants) {
      stats.plantsProcessed++;
      
      const commonName = plant.name;
      const latinName = plant.latinName || '';
      
      console.log(`\nProcessing ${commonName} (Latin name: ${latinName || 'None available'})`);
      
      try {
        // Search for the best image
        const imageResult = await searchPexelsForBestImage(commonName, latinName);
        
        if (imageResult) {
          // Download the image and save it locally
          const imagePath = await downloadAndSaveImage(imageResult, commonName, latinName);
          
          if (imagePath) {
            // Update the plant in Firestore
            const plantRef = doc(db, "products", plant.id);
            
            // Update data to send to Firestore
            const updateData = { 
              image: imagePath,
              imageSource: {
                pexels: true,
                url: imageResult.source,
                altText: imageResult.altText,
                photographer: imageResult.photographer,
                photographerUrl: imageResult.photographerUrl,
                width: imageResult.originalWidth,
                height: imageResult.originalHeight,
                query: imageResult.query,
                strategy: imageResult.strategy
              }
            };
            
            await updateDoc(plantRef, updateData);
            
            console.log(`✅ Image for ${commonName} updated in database!`);
            stats.plantsUpdated++;
            
            // Count unique images
            if (!stats.imageUrls) {
              stats.imageUrls = new Set();
            }
            stats.imageUrls.add(imageResult.url);
          }
        } else {
          console.log(`⚠️ No suitable image found for ${commonName}, trying fallback...`);
          
          // Get category for fallback
          const category = getPlantCategory(commonName);
          const fallbackImagePath = getCategoryImagePath(category);
          
          // Update with category fallback
          const plantRef = doc(db, "products", plant.id);
          await updateDoc(plantRef, { 
            image: fallbackImagePath,
            imageSource: {
              fallback: true,
              category: category,
              lastAttempted: new Date().toISOString()
            }
          });
          
          console.log(`ℹ️ Updated ${commonName} with fallback image for ${category}`);
          stats.fallbackImageUsed++;
        }
      } catch (error) {
        console.error(`❌ Error updating image for ${commonName}:`, error.message);
        stats.failedUpdates++;
      }
    }
    
    // Summary of results
    console.log('\n===== IMAGE REFRESH SUMMARY =====');
    console.log(`Plants processed: ${stats.plantsProcessed}`);
    console.log(`Plants updated with new images: ${stats.plantsUpdated}`);
    console.log(`Unique images used: ${stats.imageUrls ? stats.imageUrls.size : 0}`);
    console.log(`Fallback images used: ${stats.fallbackImageUsed}`);
    console.log(`Failed updates: ${stats.failedUpdates}`);
    
    console.log('\n✅ Database refreshed with more accurate plant images!');
  } catch (error) {
    console.error('❌ Error in refreshPlantImages:', error.message);
    throw error;
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  // Check if a specific plant name was provided as an argument
  const specificPlant = process.argv.length > 2 ? process.argv[2] : null;
  
  refreshPlantImages(specificPlant)
    .then(() => console.log('Image refresh process complete!'))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
} 