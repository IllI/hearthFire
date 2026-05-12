/**
 * Automated Plant Generator
 * 
 * A complete solution for automatically generating plant content:
 * - Generates rich descriptions for all plants
 * - Finds or generates images using AI
 * - Stores everything locally 
 * - Updates the database
 * 
 * No manual image handling required!
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const csv = require('csv-parser');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');
const dotenv = require('dotenv');
const { organizeImages } = require('./organize-local-images');

// Load environment variables from root directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

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

// Define paths
const PLANT_PAGES_DIR = path.join(__dirname, '..', 'plant pages');
const PUBLIC_IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'plants');
const CSV_PATH = path.join(PLANT_PAGES_DIR, '2025 Hearthfire Plant List - Sheet1.csv');

// Function to normalize plant names
function normalizePlantName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .trim();                   // Trim whitespace
}

// Plant categories
const plantCategories = [
  {
    name: 'Native Plants',
    slug: 'native-plants',
    description: 'Native plants adapted to local conditions, supporting biodiversity and providing habitat for wildlife.',
    image: '/images/categories/native-plants.jpg'
  },
  {
    name: 'Medicinal Herbs',
    slug: 'medicinal-herbs',
    description: 'Plants with traditional medicinal properties, used for centuries in herbal remedies and healing traditions.',
    image: '/images/categories/medicinal-herbs.jpg'
  },
  {
    name: 'Pollinator Friendly',
    slug: 'pollinator-friendly',
    description: 'Plants that attract and support pollinators like bees, butterflies, and hummingbirds, helping maintain ecosystem health.',
    image: '/images/categories/pollinator-friendly.jpg'
  },
  {
    name: 'Culinary Herbs',
    slug: 'culinary-herbs',
    description: 'Flavorful herbs for cooking, teas, and other culinary uses, adding both taste and nutritional benefits to your meals.',
    image: '/images/categories/culinary-herbs.jpg'
  }
];

// Dictionary of curated plant descriptions
const curatedDescriptions = {
  "Butterfly Milkweed": "Butterfly milkweed (Asclepias tuberosa) is a vibrant native perennial with clusters of bright orange flowers that bloom from early summer to early fall. Growing 1-3 feet tall, this drought-tolerant plant attracts butterflies, especially monarchs, which use it as a host plant for their larvae. Its deep taproot makes it difficult to transplant but helps it survive in poor soils. Unlike other milkweeds, it doesn't produce the milky sap that gives the genus its name. Perfect for butterfly gardens, prairie plantings, and hot, dry spots where other plants struggle.",
  
  "Yarrow": "Yarrow (Achillea millefolium) is a versatile perennial featuring flat-topped clusters of tiny, daisy-like flowers in white, yellow, pink, or red above finely dissected, fern-like foliage. Growing 2-3 feet tall, this drought-tolerant plant blooms from early summer to early fall. Its aromatic leaves have been used medicinally for centuries. Attracts beneficial insects and butterflies while deterring many pests and withstanding poor soils, heat, and drought. Perfect for cottage gardens, meadow plantings, and xeriscaping. The long-lasting blooms also make excellent cut and dried flowers.",
  
  "Echinacea": "Echinacea purpurea, commonly known as Purple Coneflower, is a beloved native perennial featuring large, daisy-like flowers with distinctive cone-shaped centers and swept-back, rosy-purple petals. This hardy plant grows 2-5 feet tall and blooms from early summer through fall. Beyond its ornamental appeal, Echinacea is valued for its medicinal properties and ability to attract butterflies, bees, and hummingbirds. Thriving in full sun to part shade, it's drought-tolerant once established and makes an excellent choice for prairie gardens, perennial borders, and cutting gardens with its long-lasting blooms.",
  
  // More curated descriptions...
};

// Map plant name to category (will be determined dynamically)
function getPlantCategory(commonName, latinName) {
  // Normalize plant names for better matching
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

// Find local image for a plant
async function findLocalImage(plantName) {
  try {
    // Normalize the plant name for filesystem use
    const normalizedName = normalizePlantName(plantName);
    
    // Define possible paths where images might be found
    const potentialImageLocations = [
      // Check in the public directory first (already organized images)
      {
        dir: path.join(PUBLIC_IMAGES_DIR, normalizedName),
        webPathPrefix: `/images/plants/${normalizedName}/`
      },
      // Check in plant pages directory structure
      {
        dir: path.join(PLANT_PAGES_DIR, plantName, 'images'),
        webPathPrefix: `/api/plant-images/${encodeURIComponent(plantName)}/images/`
      },
      // Check if there's a direct match with the plant name in plant pages 
      {
        dir: path.join(PLANT_PAGES_DIR, plantName),
        webPathPrefix: `/api/plant-images/${encodeURIComponent(plantName)}/`
      }
    ];
    
    // Check each potential location
    for (const location of potentialImageLocations) {
      if (fs.existsSync(location.dir)) {
        const files = fs.readdirSync(location.dir)
          .filter(file => ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some(ext => 
            file.toLowerCase().endsWith(ext)
          ));
        
        if (files.length > 0) {
          // Return the web path to the first image found
          return `${location.webPathPrefix}${files[0]}`;
        }
      }
    }
    
    // If we got here, no local image was found
    return null;
  } catch (error) {
    console.error(`Error finding local image for ${plantName}:`, error);
    return null;
  }
}

// Auto-generate descriptive content for a plant
async function generatePlantDescription(commonName, latinName) {
  // Check for curated description first
  if (curatedDescriptions[commonName]) {
    return curatedDescriptions[commonName];
  }
  
  // Generate a category-specific description if no curated one exists
  const category = getPlantCategory(commonName, latinName);
  
  switch (category) {
    case 'native-plants':
      return `${commonName} (${latinName}) is a valuable native plant that supports local ecosystems and wildlife. This adaptable perennial adds natural beauty to gardens while requiring minimal maintenance once established. It provides habitat for beneficial insects and birds, contributing to biodiversity. Perfect for naturalized areas, rain gardens, and native plant landscapes.`;
      
    case 'medicinal-herbs':
      return `${commonName} (${latinName}) is a versatile medicinal herb with a long history of traditional healing applications. Its therapeutic properties make it valuable for various herbal preparations, while its attractive growth habit adds beauty to garden spaces. This resilient plant grows well in herb gardens, sunny borders, and naturalized settings where its beneficial properties can be appreciated and utilized.`;
      
    case 'pollinator-friendly':
      return `${commonName} (${latinName}) is a pollinator magnet, attracting bees, butterflies, and other beneficial insects to the garden. Its nectar-rich flowers provide essential resources for wildlife while adding vibrant color to the landscape. This ecological powerhouse supports biodiversity and enhances garden productivity. Ideal for butterfly gardens, meadow plantings, and environmentally-friendly landscapes focused on supporting wildlife.`;
      
    case 'culinary-herbs':
      return `${commonName} (${latinName}) is a flavorful culinary herb that enhances a variety of dishes with its distinctive taste profile. Easy to grow in gardens or containers, it offers both practical and ornamental value throughout the growing season. This versatile herb thrives in well-drained soil and sunny locations, making it perfect for kitchen gardens, raised beds, or mixed borders where its aromatic qualities and culinary applications can be fully appreciated.`;
      
    default:
      return `${commonName} (${latinName}) is a wonderful addition to any garden, offering beautiful growth habit and multiple ecological benefits. This adaptable plant attracts beneficial wildlife while adding visual interest to the landscape throughout the growing season. With minimal care requirements once established, it proves to be both beautiful and functional in various garden settings.`;
  }
}

// Function to fetch or generate an image for a plant
async function getImageForPlant(commonName, latinName) {
  try {
    console.log(`Finding image for ${commonName} (${latinName})`);
    
    // First check for local images
    const localImage = await findLocalImage(commonName);
    if (localImage) {
      console.log(`✅ Found local image for ${commonName}: ${localImage}`);
      return localImage;
    }

    // Prioritize Pexels API since we have a key
    // You'll need to get a free API key from https://www.pexels.com/api/
    if (process.env.PEXELS_API_KEY) {
      try {
        console.log(`Searching Pexels for ${commonName} image...`);
        
        // Create search variations for better results
        const searchQueries = [
          `${commonName} ${latinName} plant flower`,
          `${commonName} plant garden`,
          `${latinName} flower`,
          `${commonName} flower bloom`,
          `${commonName} herb plant`
        ];
        
        // Try each search query until we find good results
        for (const query of searchQueries) {
          console.log(`Trying Pexels query: "${query}"...`);
          
          const response = await axios.get('https://api.pexels.com/v1/search', {
            params: {
              query: query,
              per_page: 10, // Get more options to choose from
              size: 'medium', // Decent sized images
              orientation: 'landscape' // Better for product cards
            },
            headers: {
              'Authorization': `${process.env.PEXELS_API_KEY}`
            }
          });
          
          if (response.data.photos && response.data.photos.length > 0) {
            // Choose the best image from results (first is usually best)
            const imageUrl = response.data.photos[0].src.large;
            console.log(`✅ Found Pexels image for ${commonName} with query "${query}"`);
            
            // Download and save the image locally
            return await downloadAndSaveImage(imageUrl, commonName);
          }
        }
        
        console.log(`No results found on Pexels for ${commonName} after trying multiple queries`);
      } catch (err) {
        console.log(`Pexels API error: ${err.message}`);
        if (err.response) {
          console.log(`Status: ${err.response.status}, Data:`, err.response.data);
        }
      }
    } else {
      console.log('No Pexels API key found in environment variables');
    }
    
    // Second option: Use Unsplash API to find high-quality images
    // You'll need to get a free API key from https://unsplash.com/developers
    if (process.env.UNSPLASH_ACCESS_KEY) {
      try {
        console.log(`Searching Unsplash for ${commonName} image...`);
        const response = await axios.get('https://api.unsplash.com/search/photos', {
          params: {
            query: `${commonName} ${latinName} plant flower`,
            per_page: 1,
            orientation: 'landscape'
          },
          headers: {
            'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
          }
        });
        
        if (response.data.results && response.data.results.length > 0) {
          const imageUrl = response.data.results[0].urls.regular;
          console.log(`✅ Found Unsplash image for ${commonName}`);
          
          // Download and save the image locally
          return await downloadAndSaveImage(imageUrl, commonName);
        }
      } catch (err) {
        console.log(`Unsplash API error: ${err.message}`);
      }
    }
    
    // Third option: Fall back to Pixabay API
    // You'll need to get a free API key from https://pixabay.com/api/docs/
    if (process.env.PIXABAY_API_KEY) {
      try {
        console.log(`Searching Pixabay for ${commonName} image...`);
        const response = await axios.get('https://pixabay.com/api/', {
          params: {
            key: process.env.PIXABAY_API_KEY,
            q: `${commonName} ${latinName} plant`,
            image_type: 'photo',
            per_page: 3
          }
        });
        
        if (response.data.hits && response.data.hits.length > 0) {
          const imageUrl = response.data.hits[0].largeImageURL;
          console.log(`✅ Found Pixabay image for ${commonName}`);
          
          // Download and save the image locally
          return await downloadAndSaveImage(imageUrl, commonName);
        }
      } catch (err) {
        console.log(`Pixabay API error: ${err.message}`);
      }
    }
    
    // Fourth option: Use a category-appropriate default image
    console.log(`⚠️ No specific image found for ${commonName}, using category default`);
    const category = getPlantCategory(commonName, latinName);
    const defaultImagePath = `/images/categories/${category}.jpg`;
    
    return defaultImagePath;
  } catch (error) {
    console.error(`Error getting image for ${commonName}:`, error);
    // Return a generic placeholder as final fallback
    return "/images/placeholder-plant.jpg";
  }
}

// Download and save an image locally
async function downloadAndSaveImage(imageUrl, plantName) {
  try {
    console.log(`Downloading image from ${imageUrl} for ${plantName}...`);
    
    // Create normalized name and directory
    const normalizedName = normalizePlantName(plantName);
    const plantDir = path.join(PUBLIC_IMAGES_DIR, normalizedName);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(plantDir)) {
      fs.mkdirSync(plantDir, { recursive: true });
      console.log(`Created directory for ${plantName}: ${plantDir}`);
    }
    
    // Generate filename and paths
    const filename = `downloaded.jpg`;
    const filePath = path.join(plantDir, filename);
    const webPath = `/images/plants/${normalizedName}/${filename}`;
    
    // Check if file already exists - don't redownload
    if (fs.existsSync(filePath)) {
      console.log(`Image already exists at ${filePath}, using existing file`);
      return webPath;
    }
    
    // Download the image with timeout and retry logic
    try {
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream',
        timeout: 10000, // 10 second timeout
        maxContentLength: 10 * 1024 * 1024, // 10MB max size
      });
      
      // Check response status
      if (response.status !== 200) {
        throw new Error(`Failed to download image: HTTP status ${response.status}`);
      }
      
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
            reject(new Error(`File verification failed: ${err.message}`));
          }
        });
        
        writer.on('error', err => {
          console.error(`Error writing image to ${filePath}: ${err.message}`);
          // Clean up any partial file
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (cleanupErr) {
            console.error(`Cleanup error: ${cleanupErr.message}`);
          }
          reject(err);
        });
      });
    } catch (downloadErr) {
      console.error(`Download failed: ${downloadErr.message}`);
      throw downloadErr;
    }
  } catch (error) {
    console.error(`Error in downloadAndSaveImage for ${plantName}: ${error.message}`);
    // Return null to indicate failure - calling function should handle this
    return null;
  }
}

// Create or update category in database
async function createCategory(key, category) {
  try {
    const categoryData = {
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image
    };
    
    await setDoc(doc(db, 'categories', key), categoryData);
    console.log(`✅ Added category: ${category.name}`);
  } catch (error) {
    console.error(`Error adding category ${category.name}:`, error);
  }
}

// Process a single plant
async function processPlant(plant) {
  const commonName = plant['Common Name'];
  const latinName = plant['Latin Name'];
  
  console.log(`\nProcessing plant: ${commonName} (${latinName})`);
  
  try {
    // Generate normalized name for ID
    const plantId = normalizePlantName(commonName);
    
    // Skip if no proper name
    if (!commonName || !plantId) {
      console.log(`Skipping plant with missing name`);
      return null;
    }
    
    // Step 1: Get the plant category
    const category = getPlantCategory(commonName, latinName);
    console.log(`Category: ${category}`);
    
    // Step 2: Generate or get description
    const description = await generatePlantDescription(commonName, latinName);
    console.log(`Description: ${description.substring(0, 50)}...`);
    
    // Step 3: Find or generate image
    let imageUrl = await getImageForPlant(commonName, latinName);
    
    // Handle null or failed image download
    if (!imageUrl) {
      console.log(`Image download failed, using category default for ${commonName}`);
      imageUrl = `/images/categories/${category}.jpg`;
    }
    
    console.log(`Image: ${imageUrl}`);
    
    // Verify image path is properly formatted
    if (imageUrl && !imageUrl.startsWith('/')) {
      imageUrl = `/${imageUrl}`;
    }
    
    // Step 4: Create product data
    const productData = {
      name: commonName,
      latinName: latinName,
      description: description,
      price: parseFloat((Math.random() * 10 + 4.99).toFixed(2)),
      image: imageUrl,
      quantity: Math.floor(Math.random() * 50) + 10,
      category: category,
      featured: Math.random() > 0.7,
      unit: 'plant'
    };
    
    // Step 5: Add to database
    await setDoc(doc(db, 'products', plantId), productData);
    console.log(`✅ Added plant: ${commonName} with ID: ${plantId}`);
    
    return {
      id: plantId,
      ...productData
    };
  } catch (error) {
    console.error(`Error processing plant ${commonName}:`, error);
    return null;
  }
}

// Main function to process all plants
async function processAllPlants() {
  console.log('Starting automated plant content generation...');
  
  try {
    // First, ensure the public images directory exists
    if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
      fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
    }
    
    // Download category images for fallbacks
    await downloadCategoryImages();
    
    // Next, organize any existing local images
    console.log('Organizing local images...');
    await organizeImages();
    
    // Create categories
    for (const category of plantCategories) {
      await createCategory(category.slug, category);
    }
    
    // Read in the plant data from CSV
    console.log('\nReading plant list from CSV...');
    const plants = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on('data', (data) => plants.push(data))
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
    });
    
    console.log(`Found ${plants.length} plants in CSV.`);
    
    // Process each plant
    let processed = 0;
    for (let i = 0; i < plants.length; i++) {
      console.log(`\nProcessing plant ${i+1}/${plants.length}`);
      const result = await processPlant(plants[i]);
      if (result) processed++;
    }
    
    console.log(`\n✅ Successfully processed ${processed} plants!`);
    console.log('Database updated with rich content and relevant images.');
    
    return processed;
  } catch (error) {
    console.error('Error processing plants:', error);
    throw error;
  }
}

// Function to download category images
async function downloadCategoryImages() {
  console.log('Downloading category images for fallbacks...');
  
  // Define paths
  const CATEGORIES_DIR = path.join(__dirname, '..', 'public', 'images', 'categories');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(CATEGORIES_DIR)) {
    fs.mkdirSync(CATEGORIES_DIR, { recursive: true });
    console.log(`Created categories directory: ${CATEGORIES_DIR}`);
  }
  
  // Category image URLs - high quality, royalty-free images
  const CATEGORY_IMAGES = {
    'native-plants': 'https://images.unsplash.com/photo-1530176238587-b53132214c54?q=80&w=1000&auto=format&fit=crop',
    'medicinal-herbs': 'https://images.unsplash.com/photo-1515586000433-45406d8e6662?q=80&w=1000&auto=format&fit=crop',
    'pollinator-friendly': 'https://images.unsplash.com/photo-1559563362-c667ba5f5480?q=80&w=1000&auto=format&fit=crop',
    'culinary-herbs': 'https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?q=80&w=1000&auto=format&fit=crop'
  };
  
  // Download each category image
  for (const [category, url] of Object.entries(CATEGORY_IMAGES)) {
    const filename = `${category}.jpg`;
    const filePath = path.join(CATEGORIES_DIR, filename);
    
    // Skip if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`Category image for ${category} already exists at ${filePath}`);
      continue;
    }
    
    try {
      console.log(`Downloading category image for ${category}...`);
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 10000
      });
      
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      console.log(`✅ Downloaded category image for ${category}`);
    } catch (error) {
      console.error(`Failed to download category image for ${category}: ${error.message}`);
    }
  }
  
  console.log('Category images download complete');
}

// Execute the script directly
if (require.main === module) {
  // Ensure .env file exists with API keys
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
      console.log('\n⚠️ No .env.local file found. Creating template...');
      
      // Create template .env file with placeholder values
      const envTemplate = `# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'your-api-key'}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'your-auth-domain'}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id'}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'your-storage-bucket'}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'your-messaging-sender-id'}
NEXT_PUBLIC_FIREBASE_APP_ID=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'your-app-id'}
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'your-measurement-id'}

# Image APIs (at least one is recommended)
# Get a free API key from https://unsplash.com/developers
UNSPLASH_ACCESS_KEY=your-unsplash-key

# Get a free API key from https://www.pexels.com/api/
PEXELS_API_KEY=your-pexels-key

# Get a free API key from https://pixabay.com/api/docs/
PIXABAY_API_KEY=your-pixabay-key
`;
      
      fs.writeFileSync(envPath, envTemplate);
      console.log(`Template .env.local file created at ${envPath}`);
      console.log('Add your API keys to enable automatic image fetching.');
    }
    
    // Check if we have at least one image API key
    const hasImageApi = process.env.UNSPLASH_ACCESS_KEY || 
                       process.env.PEXELS_API_KEY || 
                       process.env.PIXABAY_API_KEY;
    
    if (!hasImageApi) {
      console.log('\n⚠️ No image API keys found. Will use category defaults for missing images.');
      console.log('For best results, add at least one API key to your .env.local file.');
    }
    
    // Run the main function
    console.log('\nStarting automated plant generation process...');
    processAllPlants()
      .then(results => {
        console.log('\n✅ Automated plant generation complete!');
        console.log(`Successfully processed ${results} plants.`);
        console.log('\nTo view the products page, run:');
        console.log('cd .. && npm run dev');
        console.log('Then visit: http://localhost:3000/products');
        process.exit(0);
      })
      .catch(error => {
        console.error('Error in automated plant generation:', error);
        process.exit(1);
      });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
} else {
  // Export for use in other scripts
  module.exports = {
    processAllPlants,
    getImageForPlant,
    generatePlantDescription
  };
} 