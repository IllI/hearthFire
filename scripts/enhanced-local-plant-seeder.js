/**
 * Enhanced Local Plant Seeder
 * 
 * This script seeds the Firestore database with plant data from CSV, 
 * downloading and storing images locally and extracting descriptions from HTML files.
 * 
 * Features:
 * - Local image storage for better performance and reliability
 * - HTML description extraction from plant page files
 * - Scientific description generation based on plant categories
 * - Improved error handling and reporting
 */

const fs = require('fs');
const path = require('path');
const fsPromises = fs.promises;
const csv = require('csv-parser');
const cheerio = require('cheerio');
const axios = require('axios');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, setDoc } = require('firebase/firestore');
const dotenv = require('dotenv');

// Import the organize images utility
const { organizeImages, PUBLIC_IMAGES_DIR, ORGANIZED_IMAGES_JSON } = require('./organize-local-images');

// Load environment variables from .env.local file
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase with environment variables
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

// Define file paths
const csvPath = path.join(__dirname, '..', 'plant pages', '2025 Hearthfire Plant List - Sheet1.csv');
const plantPagesDir = path.join(__dirname, '..', 'plant pages');
const downloadDir = path.join(__dirname, '..', 'public', 'images', 'plants');

// Ensure the downloads directory exists
try {
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
    console.log(`Created directory: ${downloadDir}`);
  }
} catch (err) {
  console.error('Error creating downloads directory:', err);
}

// Define plant categories and their descriptions
const plantCategories = {
  nativePlants: {
    name: 'Native Plants',
    description: 'Locally adapted species that support wildlife and require less maintenance.',
    image: '/images/categories/native-plants.jpg'
  },
  medicinalHerbs: {
    name: 'Medicinal Herbs',
    description: 'Plants with traditional and modern therapeutic properties.',
    image: '/images/categories/medicinal-herbs.jpg'
  },
  pollinatorFriendly: {
    name: 'Pollinator Friendly',
    description: 'Plants that attract and support bees, butterflies, and other beneficial insects.',
    image: '/images/categories/pollinator-friendly.jpg'
  },
  culinaryHerbs: {
    name: 'Culinary Herbs',
    description: 'Flavorful plants used in cooking and food preparation.',
    image: '/images/categories/culinary-herbs.jpg'
  }
};

// Function to map plant names to categories
function mapToCategory(plantName, latinName) {
  const name = (plantName + ' ' + (latinName || '')).toLowerCase();
  
  // Map to native plants
  if (name.includes('milkweed') || 
      name.includes('coneflower') || 
      name.includes('lobelia') || 
      name.includes('aster') || 
      name.includes('goldenrod')) {
    return 'nativePlants';
  }
  
  // Map to medicinal herbs
  if (name.includes('echinacea') || 
      name.includes('yarrow') || 
      name.includes('calendula') || 
      name.includes('chamomile') || 
      name.includes('valerian')) {
    return 'medicinalHerbs';
  }
  
  // Map to culinary herbs
  if (name.includes('mint') || 
      name.includes('basil') || 
      name.includes('thyme') || 
      name.includes('sage') || 
      name.includes('oregano') || 
      name.includes('rosemary')) {
    return 'culinaryHerbs';
  }
  
  // Default to pollinator friendly
  return 'pollinatorFriendly';
}

// Function to normalize plant names
function normalizePlantName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .trim();                   // Trim whitespace
}

// Function to extract description from HTML file
async function extractDescriptionFromHTML(plantName) {
  const normalizedName = normalizePlantName(plantName);
  
  // Check for exact match directory
  let plantDir = path.join(plantPagesDir, plantName);
  if (!fs.existsSync(plantDir)) {
    // Try to find a directory that contains the plant name
    const dirs = fs.readdirSync(plantPagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    const matchingDir = dirs.find(dir => 
      dir.toLowerCase().includes(normalizedName) || 
      normalizedName.includes(normalizePlantName(dir))
    );
    
    if (matchingDir) {
      plantDir = path.join(plantPagesDir, matchingDir);
    } else {
      return null; // No matching directory found
    }
  }
  
  // Look for HTML files in the plant directory
  const files = fs.readdirSync(plantDir)
    .filter(file => file.endsWith('.html'));
  
  if (files.length === 0) {
    return null; // No HTML files found
  }
  
  // Read the first HTML file (assuming it contains the plant description)
  const htmlPath = path.join(plantDir, files[0]);
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  // Use cheerio to parse the HTML
  const $ = cheerio.load(htmlContent);
  
  // Extract title and description
  const title = $('h1, h2').first().text().trim();
  
  // Extract paragraphs
  let descriptionText = '';
  $('p').each((i, el) => {
    const text = $(el).text().trim();
    if (text) {
      descriptionText += text + '\n\n';
    }
  });
  
  // Extract lists (commonly used for plant features)
  let features = [];
  $('ul li, ol li').each((i, el) => {
    const text = $(el).text().trim();
    if (text && text.startsWith('*')) {
      features.push(text.substring(1).trim());
    } else if (text) {
      features.push(text);
    }
  });
  
  // Combine all the extracted content
  let fullDescription = '';
  
  if (title && title.toLowerCase() !== plantName.toLowerCase()) {
    fullDescription += `${title}\n\n`;
  }
  
  if (descriptionText) {
    fullDescription += descriptionText;
  }
  
  if (features.length > 0) {
    fullDescription += 'Features:\n';
    features.forEach(feature => {
      fullDescription += `• ${feature}\n`;
    });
  }
  
  return fullDescription.trim();
}

// Function to find a local image for a plant
async function findLocalImage(plantName, organizedImages) {
  const normalizedName = normalizePlantName(plantName);
  
  // Check if we have an organized image for this plant
  if (organizedImages && organizedImages[normalizedName]) {
    const plant = organizedImages[normalizedName];
    if (plant.images && plant.images.length > 0) {
      // Return the web path of the first image
      return plant.images[0].webPath;
    }
  }
  
  return null;
}

// Function to download an image and save it locally
async function downloadImage(url, plantName) {
  try {
    const normalizedName = normalizePlantName(plantName);
    const plantDir = path.join(downloadDir, normalizedName);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(plantDir)) {
      fs.mkdirSync(plantDir, { recursive: true });
    }
    
    // Extract file extension from URL
    const ext = path.extname(url) || '.jpg';
    const filename = `downloaded${ext}`;
    const filePath = path.join(plantDir, filename);
    
    // Download the image
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    
    // Save the image to file
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        resolve(`/images/plants/${normalizedName}/${filename}`);
      });
      writer.on('error', reject);
    });
  } catch (err) {
    console.error(`Error downloading image for ${plantName}:`, err.message);
    return null;
  }
}

// Dictionary of verified plant images by type
const verifiedPlantImages = {
  // Native Plants
  nativePlants: {
    'Butterfly Milkweed': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/a/s/asclepias-tuberosa-butterfly-weed-cjo-12-copy.jpg',
    'Common Milkweed': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/a/s/asclepias-syriaca-common-milkweed-cjo-13-copy.jpg',
    'Purple Coneflower': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/e/c/echinacea-purpurea-purple-coneflower-kj-3-copy.jpg',
    'Black-eyed Susan': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/r/u/rudbeckia-hirta-black-eyed-susan-jl-copy_1.jpg',
    'New England Aster': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/s/y/symphyotrichum-novae-angliae-new-england-aster-mk-01-copy.jpg'
  },
  // Medicinal Herbs
  medicinalHerbs: {
    'Echinacea': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Echinacea_0d8508ef-e4f1-440d-b1d9-c2f5b1f05df9.jpg',
    'Yarrow': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Yarrow.jpg',
    'Calendula': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Calendula_1b749445-cdd9-43ef-8a69-73e886e4fe51.jpg',
    'Chamomile': 'https://cdn.shopify.com/s/files/1/0156/0137/products/German_Chamomile.jpg',
    'Valerian': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Valerian_ad0dfd02-d4ff-4c3e-8b57-5dcfd6547535.jpg'
  },
  // Culinary Herbs
  culinaryHerbs: {
    'Peppermint': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Mint.jpg',
    'Basil': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Basil.jpg',
    'Thyme': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Thyme.jpg',
    'Sage': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Sage.jpg',
    'Oregano': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Oregano.jpg'
  },
  // Pollinator Friendly
  pollinatorFriendly: {
    'Bee Balm': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/m/o/monarda-fistulosa-wild-bergamot-jl-1-copy.jpg',
    'Anise Hyssop': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/a/g/agastache-foeniculum-anise-hyssop-mkk-10-copy.jpg',
    'Wild Bergamot': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/m/o/monarda-fistulosa-wild-bergamot-jl-1-copy.jpg',
    'Blazing Star': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/l/i/liatris-spicata-prairie-blazing-star-jl-1-copy.jpg',
    'Joe Pye Weed': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/e/u/eutrochium-maculatum-spotted-joe-pye-weed-ps-1-copy_1.jpg'
  }
};

// Dictionary of curated descriptions for common plants
const curatedDescriptions = {
  "Butterfly Milkweed": "Butterfly milkweed (Asclepias tuberosa) is a vibrant native perennial that produces clusters of bright orange flowers. It serves as a crucial host plant for monarch butterfly caterpillars and provides nectar for many pollinators. This drought-tolerant plant has a deep taproot and does not transplant easily but thrives in well-drained soils and full sun conditions. Unlike other milkweeds, it produces minimal milky sap. Height: 1-2 feet.",
  
  "Common Milkweed": "Common milkweed (Asclepias syriaca) is a robust native perennial with fragrant mauve to pink flower clusters that bloom in early to mid-summer. It's an essential host plant for monarch butterflies, providing food for their caterpillars and nectar for adults. The plant produces copious milky sap and spreads through both seeds and rhizomes, sometimes aggressively. Its seed pods contain silky floss that carries seeds on the wind. Height: 3-5 feet.",
  
  "Purple Coneflower": "Purple coneflower (Echinacea purpurea) is a resilient native perennial featuring distinctive purple-pink daisy-like flowers with raised, coppery-orange central cones. Blooming from mid-summer to early fall, it attracts numerous pollinators and provides seed for birds in winter. The plant has proven medicinal properties, with roots and flowers used to boost immunity. Drought-tolerant once established, it grows well in average soils with good drainage. Height: 2-4 feet.",
  
  "Bee Balm": "Bee balm (Monarda didyma) is a showy native perennial with whorls of tubular flowers in vibrant red, pink, or purple, arranged in distinctive mop-like heads. Its aromatic foliage has a minty-citrus scent and is used in teas and potpourri. Extremely attractive to bees, butterflies, and hummingbirds, it blooms from mid to late summer. It spreads by rhizomes and prefers moist but well-drained soil in full sun to partial shade. Height: 2-4 feet.",
  
  "Echinacea": "Echinacea (Echinacea purpurea) is a versatile medicinal herb with striking purple-pink flowers featuring prominent spiky central cones. Valued for its immune-boosting properties, the roots, leaves, and flowers contain compounds that stimulate the immune system and reduce inflammation. Native to eastern North America, it's drought-tolerant once established and provides valuable nectar for pollinators from mid-summer into fall. The seed heads also provide food for birds. Height: 2-4 feet.",
  
  "Yarrow": "Yarrow (Achillea millefolium) is an ancient medicinal herb with feathery, aromatic foliage and flat-topped clusters of tiny white flowers. Used traditionally to stop bleeding, reduce fever, and treat inflammation, it contains numerous bioactive compounds. The plant attracts beneficial insects and butterflies while deterring certain pests. Exceptionally hardy and drought-resistant, it thrives in poor soils and full sun. Available in cultivars with yellow, pink, and red flowers. Height: 1-3 feet.",
  
  "Peppermint": "Peppermint (Mentha × piperita) is a vigorous perennial herb known for its high menthol content and distinctive cooling taste. The aromatic leaves are used fresh or dried in teas, desserts, and confections, while the essential oil has numerous medicinal applications including digestive aid and headache relief. Peppermint spreads rapidly via underground runners and grows best in moist, rich soil in partial shade. Purple flower spikes appear in mid to late summer and attract bees. Height: 1-3 feet."
};

// Function to generate a detailed description for a plant
async function generateDescription(plantName, latinName, category) {
  // First, try to extract description from HTML file
  const htmlDescription = await extractDescriptionFromHTML(plantName);
  if (htmlDescription) {
    return htmlDescription;
  }
  
  // Next, check for a curated description
  if (curatedDescriptions[plantName]) {
    return curatedDescriptions[plantName] + ',';
  }
  
  // Generate a category-specific description as a fallback
  const categoryKey = category || mapToCategory(plantName, latinName);
  
  switch (categoryKey) {
    case 'nativePlants':
      return `${plantName} (${latinName || 'Native species'}) is a valuable North American native plant adapted to local growing conditions. It requires less water and maintenance than non-native alternatives while providing essential habitat and food for local wildlife. By incorporating this native plant into your garden, you're supporting biodiversity and ecological balance. Native plants like this one have co-evolved with local insects and birds, making them crucial for sustaining the food web.`;
      
    case 'medicinalHerbs':
      return `${plantName} (${latinName || 'Medicinal herb'}) has been valued for its therapeutic properties throughout history. This herb contains bioactive compounds that may support wellness when used appropriately. While traditional herbalists have used this plant for various applications, it's always important to research proper usage and consult with a healthcare provider before using any plant medicinally. Growing your own medicinal herbs ensures you have access to the freshest, most potent plant material.`;
      
    case 'pollinatorFriendly':
      return `${plantName} (${latinName || 'Beneficial species'}) is an excellent pollinator-supporting plant that provides nectar and pollen for bees, butterflies, and other beneficial insects. By incorporating this species into your garden, you're creating vital habitat for pollinators, which are essential for food production and ecosystem health. The flowers attract a diversity of pollinators, while the plant itself may serve as a host for butterfly caterpillars, supporting the complete lifecycle of these important insects.`;
      
    case 'culinaryHerbs':
      return `${plantName} (${latinName || 'Culinary herb'}) is a flavorful herb used in cooking to enhance dishes with its distinctive taste and aroma. Fresh leaves can be harvested throughout the growing season, and the plant may be dried or preserved for year-round use. Growing your own culinary herbs provides convenient access to fresh flavors while ensuring your herbs are grown without unwanted chemicals. This herb thrives with regular harvesting, which promotes bushier growth and continued production.`;
      
    default:
      return `${plantName} (${latinName || 'Botanical species'}) is a versatile addition to gardens, offering both beauty and practical benefits. This plant contributes to garden diversity and can be incorporated into various landscape designs. Growing a variety of plant species promotes ecological balance and creates a more resilient garden environment. With proper care and placement according to its specific needs, this plant will thrive and bring enjoyment to your garden space.`;
  }
}

// Function to download category images
async function downloadCategoryImages() {
  console.log('Downloading category images...');
  
  const categoryImagesDir = path.join(__dirname, '..', 'public', 'images', 'categories');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(categoryImagesDir)) {
    fs.mkdirSync(categoryImagesDir, { recursive: true });
    console.log(`Created directory: ${categoryImagesDir}`);
  }
  
  // Category image URLs
  const categoryImageUrls = {
    'native-plants.jpg': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/e/c/echinacea-purpurea-purple-coneflower-kj-3-copy.jpg',
    'medicinal-herbs.jpg': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Echinacea_0d8508ef-e4f1-440d-b1d9-c2f5b1f05df9.jpg',
    'pollinator-friendly.jpg': 'https://www.prairienursery.com/media/catalog/product/cache/c9232708bac2847846e765078eaee908/m/o/monarda-fistulosa-wild-bergamot-jl-1-copy.jpg',
    'culinary-herbs.jpg': 'https://cdn.shopify.com/s/files/1/0156/0137/products/Basil.jpg'
  };
  
  // Download each category image
  for (const [filename, url] of Object.entries(categoryImageUrls)) {
    const filePath = path.join(categoryImagesDir, filename);
    
    // Skip if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`Category image ${filename} already exists.`);
      continue;
    }
    
    try {
      // Download the image
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
      });
      
      // Save the image to file
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      console.log(`Downloaded category image: ${filename}`);
    } catch (err) {
      console.error(`Error downloading category image ${filename}:`, err.message);
    }
  }
  
  console.log('Category images download complete.');
}

// Function to get the best image for a plant
async function getImageForPlant(commonName, latinName) {
  try {
    console.log(`Finding image for ${commonName} (${latinName})`);
    
    // First priority: Look for local image in the organized plants directory
    const normalizedName = normalizePlantName(commonName);
    const plantDir = path.join(PUBLIC_IMAGES_DIR, normalizedName);
    
    // Check if a directory exists for this plant
    if (fs.existsSync(plantDir)) {
      const files = fs.readdirSync(plantDir);
      if (files.length > 0) {
        // Return the first image file found
        const imagePath = `/images/plants/${normalizedName}/${files[0]}`;
        console.log(`✅ Found local image for ${commonName}: ${imagePath}`);
        return imagePath;
      }
    }
    
    // Second priority: Try downloading from verified sources
    const category = mapToCategory(commonName, latinName);
    
    // Check verified images for this category
    for (const categoryKey in verifiedPlantImages) {
      if (verifiedPlantImages[categoryKey][commonName]) {
        const imageUrl = verifiedPlantImages[categoryKey][commonName];
        try {
          const downloadedPath = await downloadImage(imageUrl, commonName);
          if (downloadedPath) {
            console.log(`✅ Downloaded image for ${commonName}: ${downloadedPath}`);
            return downloadedPath;
          }
        } catch (err) {
          console.log(`⚠️ Failed to download verified image for ${commonName}: ${err.message}`);
        }
      }
    }
    
    // Third priority: Use placeholder image with plant name
    // This is a temporary solution until AI-generated images are created
    const placeholderUrl = `https://placehold.co/600x400?text=${encodeURIComponent(commonName)}`;
    console.log(`⚠️ Using placeholder for ${commonName}: ${placeholderUrl}`);
    
    // Prepare folder for AI-generated images later
    try {
      if (!fs.existsSync(plantDir)) {
        fs.mkdirSync(plantDir, { recursive: true });
        console.log(`Created directory for future AI image: ${plantDir}`);
      }
    } catch (err) {
      console.error(`Error creating plant directory: ${err.message}`);
    }
    
    // Return the placeholder URL
    return placeholderUrl;
    
  } catch (error) {
    console.error(`❌ Error getting image for ${commonName}:`, error);
    // Final fallback image if all else fails
    return `/images/categories/${mapToCategory(commonName, latinName)}.jpg`;
  }
}

// Function to seed the database with plant data
async function seedPlants(organizedImages) {
  console.log('Starting plant seeding process...');
  
  // Create categories first
  console.log('Creating plant categories...');
  for (const [key, category] of Object.entries(plantCategories)) {
    try {
      await setDoc(doc(db, 'categories', key), {
        name: category.name,
        description: category.description,
        image: category.image
      });
      console.log(`Added category: ${category.name}`);
    } catch (error) {
      console.error(`Error adding category ${category.name}:`, error);
    }
  }
  
  console.log('Categories created successfully.');
  
  // Check if the CSV file exists
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at path: ${csvPath}`);
  }
  
  // Process the plants from the CSV file
  return new Promise((resolve, reject) => {
    const plants = [];
    let processedCount = 0;
    let errorCount = 0;
    
    // Track plants needing images for later AI generation
    const plantsNeedingImages = [];
    
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => plants.push(data))
      .on('end', async () => {
        console.log(`Processing ${plants.length} plants from CSV file...`);
        
        for (const plant of plants) {
          try {
            // Extract common and Latin names
            const commonName = plant['Common'] || plant['Common Name'] || '';
            const latinName = plant['Latin'] || plant['Latin Name'] || plant['Scientific Name'] || '';
            
            // Skip plants without names
            if (!commonName) {
              console.log('Skipping plant with no common name:', plant);
              continue;
            }
            
            console.log(`Processing: ${commonName} (${latinName})`);
            
            // Determine plant category
            const category = mapToCategory(commonName, latinName);
            
            // Check if we need AI-generated images
            const imagePath = await getImageForPlant(commonName, latinName);
            if (imagePath.includes('placehold.co')) {
              plantsNeedingImages.push({
                commonName,
                latinName,
                id: normalizePlantName(commonName) || 
                    `plant-${Math.floor(Math.random() * 10000)}`
              });
            }
            
            // Generate a detailed description
            const description = await generateDescription(commonName, latinName, category);
            
            // Create a unique ID based on the plant name
            const plantId = normalizePlantName(commonName) || 
                          `plant-${Math.floor(Math.random() * 10000)}`;
            
            // Generate a random price between $5 and $20
            const price = (Math.floor(Math.random() * 16) + 5).toFixed(2);
            
            // Generate a random quantity between 10 and 100
            const quantity = Math.floor(Math.random() * 91) + 10;
            
            // Create the product data
            const productData = {
              name: commonName,
              description: description,
              price: price,
              image: imagePath || plantCategories[category].image,
              quantity: quantity,
              category: category,
              latinName: latinName,
              featured: Math.random() < 0.2, // 20% chance of being featured
              id: plantId
            };
            
            // Add the product to Firestore
            await setDoc(doc(db, 'products', plantId), productData);
            console.log(`Added ${commonName} with ID: ${plantId} and image: ${imagePath?.substring(0, 30)}...`);
            processedCount++;
          } catch (error) {
            console.error(`Error processing plant ${plant['Common'] || plant['Common Name']}:`, error);
            errorCount++;
          }
        }
        
        console.log(`Seeding complete! Added ${processedCount} plants to the database.`);
        
        // Output information about plants needing images
        if (plantsNeedingImages.length > 0) {
          console.log(`\n${plantsNeedingImages.length} plants need AI-generated images.`);
          console.log(`Run 'node generate-image-list.js' to create a list of plants that need images,`);
          console.log(`along with prompts for generating them using Microsoft Image Creator.`);
        }
        
        if (errorCount > 0) {
          console.log(`Encountered ${errorCount} errors during seeding.`);
        }
        
        resolve({ processedCount, errorCount, plantsNeedingImages: plantsNeedingImages.length });
      })
      .on('error', (error) => {
        console.error('Error processing CSV:', error);
        reject(error);
      });
  });
}

// Main execution
async function main() {
  try {
    console.log('Starting enhanced local plant seeding process...');
    
    // First download category images
    await downloadCategoryImages();
    
    // Organize existing local images
    console.log('Organizing local plant images...');
    const { organizedImages } = await organizeImages();
    
    // Seed plants using the organized images
    await seedPlants(organizedImages);
    
    console.log('Enhanced local plant seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error in enhanced local plant seeder:', error);
    process.exit(1);
  }
}

// Execute the main function if this script is run directly
if (require.main === module) {
  main();
}

// Export for use in other scripts
module.exports = { seedPlants, downloadCategoryImages, extractDescriptionFromHTML, normalizePlantName }; 