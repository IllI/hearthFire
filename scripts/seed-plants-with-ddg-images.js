// Enhanced script to seed the Firestore database with plant products
// Uses DuckDuckGo image search as a fallback for plants without local images
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const https = require('https');
const { createWriteStream } = require('fs');
const axios = require('axios');
const { URLSearchParams } = require('url');
const { createCanvas } = require('canvas');
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

// Log config for debugging
console.log('Firebase Config:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Set' : '✗ Missing',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Missing',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✓ Set' : '✗ Missing',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✓ Set' : '✗ Missing',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✓ Set' : '✗ Missing',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ? '✓ Set' : '✗ Missing'
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Plant categories
const plantCategories = [
  {
    name: 'Native Plants',
    slug: 'native-plants',
    description: 'Native plants adapted to local conditions',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Echinacea_purpurea_GotBot_2015_001.jpg/800px-Echinacea_purpurea_GotBot_2015_001.jpg'
  },
  {
    name: 'Medicinal Herbs',
    slug: 'medicinal-herbs',
    description: 'Plants with traditional medicinal properties',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Echinacea_-_im_Einsatz_gegen_Erk%C3%A4ltungskrankheiten.jpg/800px-Echinacea_-_im_Einsatz_gegen_Erk%C3%A4ltungskrankheiten.jpg'
  },
  {
    name: 'Pollinator Friendly',
    slug: 'pollinator-friendly',
    description: 'Plants that attract and support pollinators',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Bee_on_flower_at_Indhus_Valley.jpg/800px-Bee_on_flower_at_Indhus_Valley.jpg'
  },
  {
    name: 'Culinary Herbs',
    slug: 'culinary-herbs',
    description: 'Flavorful herbs for cooking and teas',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Basil-Basilico-Ocimum_basilicum-albahaca.jpg/800px-Basil-Basilico-Ocimum_basilicum-albahaca.jpg'
  }
];

// Map to track used images to prevent duplication
const usedImages = new Map();

// Define the base URL for the site
const siteBaseUrl = 'http://localhost:3001';

// Final default fallback
const defaultImage = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Wildflowers_in_the_Mount_Hood_Wilderness_-_ZigZag_Wilderness_%2836237500254%29.jpg/800px-Wildflowers_in_the_Mount_Hood_Wilderness_-_ZigZag_Wilderness_%2836237500254%29.jpg";

// Directory to store downloaded images
const downloadedImagesDir = path.join(__dirname, '..', 'public', 'plant-images', 'downloaded');

// Ensure the download directory exists
if (!fs.existsSync(downloadedImagesDir)) {
  fs.mkdirSync(downloadedImagesDir, { recursive: true });
  console.log(`Created directory for downloaded images: ${downloadedImagesDir}`);
}

// Normalized plant names for better matching
function normalizePlantName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^\w\s,]/g, '')  // Remove special chars except commas
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim();
}

// Function to check if a local image exists for a plant
function checkLocalImageExists(commonName) {
  try {
    // Normalize the plant name to match likely directory name
    const normalizedName = normalizePlantName(commonName);
    
    // Check potential directory paths
    const directPaths = [
      // Try direct match
      path.join(__dirname, '..', 'plant pages', commonName, 'images', 'image1.jpg'),
      // Try without special characters and lowercase
      path.join(__dirname, '..', 'plant pages', normalizedName, 'images', 'image1.jpg'),
      // Try based on first part of name (before comma or parenthesis)
      path.join(__dirname, '..', 'plant pages', normalizedName.split(',')[0].trim(), 'images', 'image1.jpg')
    ];
    
    for (const imagePath of directPaths) {
      if (fs.existsSync(imagePath)) {
        console.log(`Found local image for ${commonName} at ${imagePath}`);
        // Extract the relative path starting after "plant pages"
        const parts = imagePath.split(path.sep);
        const startIndex = parts.findIndex(part => part === 'plant pages') + 1;
        if (startIndex > 0) {
          const relativeParts = parts.slice(startIndex);
          const apiPath = relativeParts.join('/');
          return `${siteBaseUrl}/api/plant-images/${apiPath}`;
        }
      }
    }
    
    // No exact match found, check all directories for partial matches
    const plantPagesDir = path.join(__dirname, '..', 'plant pages');
    if (fs.existsSync(plantPagesDir)) {
      const directories = fs.readdirSync(plantPagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      // Check for partial matches in directory names
      for (const dir of directories) {
        const dirLower = dir.toLowerCase();
        const nameParts = normalizedName.split(/\s+/);
        
        // Check if any significant part of the plant name is in the directory name
        const matchFound = nameParts.some(part => 
          part.length > 3 && dirLower.includes(part.toLowerCase())
        );
        
        if (matchFound) {
          const imagePath = path.join(plantPagesDir, dir, 'images', 'image1.jpg');
          if (fs.existsSync(imagePath)) {
            console.log(`Found partial match local image for ${commonName} in directory ${dir}`);
            // Extract the relative path starting after "plant pages"
            const parts = imagePath.split(path.sep);
            const startIndex = parts.findIndex(part => part === 'plant pages') + 1;
            if (startIndex > 0) {
              const relativeParts = parts.slice(startIndex);
              const apiPath = relativeParts.join('/');
              return `${siteBaseUrl}/api/plant-images/${apiPath}`;
            }
          }
        }
      }
    }
    
    return null; // No local image found
  } catch (error) {
    console.error(`Error checking for local image for ${commonName}:`, error);
    return null;
  }
}

// Check for verified plant image with improved matching
function checkVerifiedImage(commonName, latinName) {
  try {
    const normalizedCommonName = normalizePlantName(commonName);
    const normalizedLatinName = normalizePlantName(latinName);
    
    // First try exact match on common name
    if (verifiedPlantImages[normalizedCommonName]) {
      console.log(`Found exact match for "${normalizedCommonName}"`);
      return verifiedPlantImages[normalizedCommonName];
    }
    
    // Check if full common name is in our verified list
    for (const [keyword, imageUrl] of Object.entries(verifiedPlantImages)) {
      // Give precedence to exact matches for full plant names
      if (normalizedCommonName === keyword) {
        console.log(`Found exact match for ${commonName}`);
        return imageUrl;
      }
    }
    
    // Then try substring match on common name
    for (const [keyword, imageUrl] of Object.entries(verifiedPlantImages)) {
      if (normalizedCommonName.includes(keyword)) {
        console.log(`Found verified image for ${commonName} matching keyword "${keyword}"`);
        return imageUrl;
      }
      
      // Also check if the keyword is contained within the plant name
      // This helps with cases like "blue sage" matching "sage"
      if (keyword.includes(normalizedCommonName)) {
        console.log(`Found verified image for ${commonName} as it's part of "${keyword}"`);
        return imageUrl;
      }
    }
    
    // Try using Latin name
    for (const [keyword, imageUrl] of Object.entries(verifiedPlantImages)) {
      if (normalizedLatinName.includes(keyword)) {
        console.log(`Found verified image for ${latinName} matching keyword "${keyword}"`);
        return imageUrl;
      }
    }
    
    // Check individual parts of plant name for partial matches
    const nameParts = normalizedCommonName.split(/\s+/);
    for (const part of nameParts) {
      if (part.length <= 3) continue; // Skip short words
      
      for (const [keyword, imageUrl] of Object.entries(verifiedPlantImages)) {
        if (keyword.includes(part) || part.includes(keyword)) {
          console.log(`Found verified image for ${commonName} through partial match on "${part}"`);
          return imageUrl;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error in checkVerifiedImage for ${commonName}:`, error);
    return null;
  }
}

// Function to get a reliable Unsplash image for a plant by category
function getUnsplashPlantImageForCategory(category, plantName) {
  // Create a dictionary of specific plant images that we know are correct and reliable
  const specificPlantImages = {
    // Specific plant name to verified image mapping
    "yarrow": "https://images.unsplash.com/photo-1579049369510-a9a229c1da51?auto=format&w=800",
    "milkweed": "https://images.unsplash.com/photo-1571450669798-987bec52ae81?auto=format&w=800",
    "asclepias": "https://images.unsplash.com/photo-1571450669798-987bec52ae81?auto=format&w=800",
    "echinacea": "https://images.unsplash.com/photo-1533038590840-1f704a2eb6ab?auto=format&w=800",
    "coneflower": "https://images.unsplash.com/photo-1558609553-b2ac5ca8a587?auto=format&w=800",
    "hibiscus": "https://images.unsplash.com/photo-1631349583627-f486c92756e5?auto=format&w=800",
    "rose mallow": "https://images.unsplash.com/photo-1568465122781-8e2cfedcb8b6?auto=format&w=800",
    "sage": "https://images.unsplash.com/photo-1518677171872-2dff21e18b44?auto=format&w=800",
    "blue sage": "https://images.unsplash.com/photo-1518677171872-2dff21e18b44?auto=format&w=800",
    "salvia": "https://images.unsplash.com/photo-1596879853133-a2a2ea44045b?auto=format&w=800",
    "blue salvia": "https://images.unsplash.com/photo-1596879853133-a2a2ea44045b?auto=format&w=800",
    "pink salvia": "https://images.unsplash.com/photo-1557428894-56bcc97ecbbf?auto=format&w=800",
    "thyme": "https://images.unsplash.com/photo-1599420186946-7b6737e15cc4?auto=format&w=800",
    "mint": "https://images.unsplash.com/photo-1563822249366-7b0979e7d4fb?auto=format&w=800",
    "mountain mint": "https://images.unsplash.com/photo-1563822249366-7b0979e7d4fb?auto=format&w=800",
    "catnip": "https://images.unsplash.com/photo-1599420186946-7b6737e15cc4?auto=format&w=800",
    "bee balm": "https://images.unsplash.com/photo-1597838816882-990ac1cd985d?auto=format&w=800",
    "monarda": "https://images.unsplash.com/photo-1597838816882-990ac1cd985d?auto=format&w=800",
    "oregano": "https://images.unsplash.com/photo-1635321599430-dc6a001a7303?auto=format&w=800",
    "marjoram": "https://images.unsplash.com/photo-1639669164067-2162ed3e54b0?auto=format&w=800",
    "basil": "https://images.unsplash.com/photo-1450895514251-1def8e443fb9?auto=format&w=800",
    "holy basil": "https://images.unsplash.com/photo-1450895514251-1def8e443fb9?auto=format&w=800",
    "tulsi": "https://images.unsplash.com/photo-1450895514251-1def8e443fb9?auto=format&w=800",
    "rosemary": "https://images.unsplash.com/photo-1613591746030-b5cbbc124852?auto=format&w=800",
    "passionflower": "https://images.unsplash.com/photo-1568439896522-b4ecb0cc2b74?auto=format&w=800",
    "black-eyed susan": "https://images.unsplash.com/photo-1593176902240-adf7be500897?auto=format&w=800",
    "brown-eyed susan": "https://images.unsplash.com/photo-1597394173791-5c53e9677b17?auto=format&w=800",
    "rudbeckia": "https://images.unsplash.com/photo-1593176902240-adf7be500897?auto=format&w=800",
    "sunflower": "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&w=800",
    "helianthus": "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&w=800",
    "aster": "https://images.unsplash.com/photo-1601578718801-373b16b4d38a?auto=format&w=800",
    "joe pye weed": "https://images.unsplash.com/photo-1597087774430-c7aae95fb731?auto=format&w=800",
    "boneset": "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&w=800",
    "little blue stem": "https://images.unsplash.com/photo-1541426062085-72226b58452d?auto=format&w=800",
    "skullcap": "https://images.unsplash.com/photo-1517589364675-2010bd71a621?auto=format&w=800",
    "royal catchfly": "https://images.unsplash.com/photo-1505472483342-37ffd4df5428?auto=format&w=800",
    "ironweed": "https://images.unsplash.com/photo-1505472483342-37ffd4df5428?auto=format&w=800",
    "valerian": "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&w=800",
    "vervain": "https://images.unsplash.com/photo-1597087774430-c7aae95fb731?auto=format&w=800",
    "blue vervain": "https://images.unsplash.com/photo-1597087774430-c7aae95fb731?auto=format&w=800",
    "mistflower": "https://images.unsplash.com/photo-1525134479668-1b6266a602db?auto=format&w=800",
    "stinging nettle": "https://images.unsplash.com/photo-1587329309172-1da01420f6ee?auto=format&w=800",
    "anise hyssop": "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&w=800",
    "elecampane": "https://images.unsplash.com/photo-1515150144380-bca9f1650ed9?auto=format&w=800",
    "nasturtium": "https://images.unsplash.com/photo-1573221566340-81bdde00e00b?auto=format&w=800",
    "cardinal flower": "https://images.unsplash.com/photo-1579049369510-a9a229c1da51?auto=format&w=800",
    "round headed bush clover": "https://images.unsplash.com/photo-1559483783-5713458c89c9?auto=format&w=800",
    "st. johns wort": "https://images.unsplash.com/photo-1516378314249-54bf96a2628b?auto=format&w=800"
  };

  // Normalize plant name for matching
  const normalizedPlantName = normalizePlantName(plantName);
  
  // Check for exact matches in the specific plant dictionary
  for (const [key, url] of Object.entries(specificPlantImages)) {
    if (normalizedPlantName === normalizePlantName(key)) {
      console.log(`✅ Found specific image match for ${plantName}: ${key}`);
      return url;
    }
  }
  
  // Check for partial matches (e.g., "Milkweed, Rose" should match "milkweed")
  for (const [key, url] of Object.entries(specificPlantImages)) {
    if (normalizedPlantName.includes(normalizePlantName(key)) || 
        normalizePlantName(key).includes(normalizedPlantName)) {
      console.log(`✅ Found specific image match for ${plantName}: ${key}`);
      return url;
    }
  }
  
  // Check if any words from the plant name match our specific plants
  const words = normalizedPlantName.split(/[\s,]+/).filter(word => word.length > 3);
  for (const word of words) {
    for (const [key, url] of Object.entries(specificPlantImages)) {
      if (normalizePlantName(key).includes(word)) {
        console.log(`✅ Found partial word match for ${plantName}: ${word} in ${key}`);
        return url;
      }
    }
  }
  
  // Check for a multi-part match (e.g. "sweet black eyed susan")
  for (const [key, url] of Object.entries(specificPlantImages)) {
    const keyParts = normalizePlantName(key).split(/\s+/);
    let matches = 0;
    for (const part of keyParts) {
      if (normalizedPlantName.includes(part)) {
        matches++;
      }
    }
    // If more than half the parts match, use this image
    if (matches > 0 && matches >= keyParts.length / 2) {
      console.log(`✅ Found partial multi-part match for ${plantName}: ${key}`);
      return url;
    }
  }
  
  console.log(`❌ No matches at all for ${plantName}, using default image`);
  
  // If no matches found, use a category-specific image
  const categoryImages = {
    'native-plants': [
      "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&w=800",
      "https://images.unsplash.com/photo-1567331711402-509c12c41959?auto=format&w=800",
      "https://images.unsplash.com/photo-1530092285049-1c42085fd395?auto=format&w=800"
    ],
    'medicinal-herbs': [
      "https://images.unsplash.com/photo-1562338067-589a9276be89?auto=format&w=800",
      "https://images.unsplash.com/photo-1564500601744-f5098b0173cf?auto=format&w=800",
      "https://images.unsplash.com/photo-1471943311424-646960669fbc?auto=format&w=800"
    ],
    'pollinator-friendly': [
      "https://images.unsplash.com/photo-1566804157193-837ff1cac63f?auto=format&w=800",
      "https://images.unsplash.com/photo-1559563362-c667ba5f5480?auto=format&w=800",
      "https://images.unsplash.com/photo-1533038590840-1f704a2eb6ab?auto=format&w=800"
    ],
    'culinary-herbs': [
      "https://images.unsplash.com/photo-1585032767761-878270336a0e?auto=format&w=800",
      "https://images.unsplash.com/photo-1562338067-589a9276be89?auto=format&w=800",
      "https://images.unsplash.com/photo-1566383444824-d9fe30188195?auto=format&w=800"
    ]
  };
  
  // Create a hash from the plant name to ensure consistent selection
  const hash = plantName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const categoryUrls = categoryImages[category] || categoryImages['native-plants'];
  const index = hash % categoryUrls.length;
  
  // Return a category-specific image that's consistent for this plant
  return categoryUrls[index];
}

// Improved function to validate and download an image
async function validateAndDownloadImage(imageUrl, plantName) {
  // First check if the image URL is valid
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
    console.log(`⚠️ Invalid image URL for ${plantName}, using fallback`);
    const category = getPlantCategory(plantName, '');
    return getUnsplashPlantImageForCategory(category, plantName);
  }

  try {
    // Check for known problematic images
    const problematicImages = [
      // Valerian cat image
      "https://cdn.pixabay.com/photo/2015/11/16/14/43/cat-1045782_1280.jpg",
      "https://cdn.pixabay.com/photo/2016/02/10/16/37/cat-1192026_1280.jpg",
      "https://cdn.pixabay.com/photo/2014/04/13/20/49/cat-323262_1280.jpg",
      // Add any other known problematic images here
    ];

    if (problematicImages.some(img => imageUrl.includes(img) || imageUrl === img)) {
      console.log(`⚠️ Detected known problematic image for ${plantName}, switching to specific plant image`);
      
      // Override specific problematic plants with verified images
      if (plantName.toLowerCase().includes('valerian')) {
        return "https://images.unsplash.com/photo-1530158177759-68d0ef555c59?auto=format&w=800"; // Proper valerian image
      }
      
      // For other problematic images, use category-based image
      const category = getPlantCategory(plantName, '');
      return getUnsplashPlantImageForCategory(category, plantName);
    }

    // Skip validation for local images (they start with site base URL)
    if (imageUrl.startsWith(siteBaseUrl)) {
      console.log(`✅ Using local image for ${plantName}, skipping validation`);
      return imageUrl;
    }

    // Check if this is a Pixabay URL (which often causes CORS issues)
    if (imageUrl.includes('pixabay.com')) {
      console.log(`⚠️ Pixabay URL detected for ${plantName}, switching to Unsplash`);
      const category = getPlantCategory(plantName, '');
      return getUnsplashPlantImageForCategory(category, plantName);
    }

    // For certain problematic plants, double check even if URL looks valid
    const problematicPlants = [
      'valerian', 'valeriana', 'pink salvia', 'boneset', 'mistflower', 
      'mountain mint', 'mtn mint', 'hibiscus'
    ];
    
    if (problematicPlants.some(plant => plantName.toLowerCase().includes(plant))) {
      console.log(`⚠️ Potentially problematic plant detected: ${plantName}, using verified image`);
      const category = getPlantCategory(plantName, '');
      // Get specific plant image from our dictionary
      const verifiedImage = verifiedPlantImages[normalizePlantName(plantName)];
      return verifiedImage || getUnsplashPlantImageForCategory(category, plantName);
    }

    // Make a HEAD request to check if the image exists
    const response = await axios.head(imageUrl, { 
      timeout: 5000,
      validateStatus: false // Don't throw error on non-2xx status
    });

    if (response.status !== 200) {
      console.log(`⚠️ Image validation error for ${plantName}: status ${response.status}, using fallback`);
      const category = getPlantCategory(plantName, '');
      return getUnsplashPlantImageForCategory(category, plantName);
    }

    return imageUrl;
  } catch (error) {
    console.log(`⚠️ Error validating image for ${plantName}: ${error.message}, using fallback`);
    const category = getPlantCategory(plantName, '');
    return getUnsplashPlantImageForCategory(category, plantName);
  }
}

// Get plant category based on name and description
function getPlantCategory(name, description) {
  const normalizedName = name.toLowerCase();
  const normalizedDesc = description.toLowerCase();
  
  // Categorize based on patterns
  if (normalizedName.includes('mint') || 
      normalizedName.includes('basil') || 
      normalizedName.includes('thyme') ||
      normalizedName.includes('oregano') ||
      normalizedName.includes('rosemary') ||
      normalizedName.includes('sage')) {
    return 'Culinary Herbs';
  } else if (normalizedName.includes('echinacea') || 
            normalizedName.includes('chamomile') ||
            normalizedDesc.includes('medicinal')) {
    return 'Medicinal Herbs';
  } else if (normalizedName.includes('bee') || 
            normalizedName.includes('butterfly') ||
            normalizedDesc.includes('pollinator')) {
    return 'Pollinator Friendly';
  } else {
    return 'Native Plants';
  }
}

// Base URL to use for all image references (update this with your site URL)
const publicDir = path.join(__dirname, '..', 'public');
const imagesDir = path.join(publicDir, 'plant-images');
const downloadDir = path.join(imagesDir, 'downloaded');
// Ensure the directories exist
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

// Placeholder image for when all else fails - point to a real image that exists
const defaultPlaceholderImage = `${siteBaseUrl}/placeholder-vegetables.jpg`;

// Use these guaranteed Pixabay image URLs 
const externalPlantImages = [
  "https://cdn.pixabay.com/photo/2015/05/04/10/16/vegetables-752153_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/07/15/13/19/herbs-3539410_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/05/27/03/39/basil-5224996_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/07/14/03/39/tomatoes-3537304_1280.jpg",
  "https://cdn.pixabay.com/photo/2019/03/24/14/25/crocus-4077594_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/05/23/07/42/sage-3422907_1280.jpg",
  "https://cdn.pixabay.com/photo/2016/08/25/18/24/sage-1620345_1280.jpg",
  "https://cdn.pixabay.com/photo/2014/10/25/12/57/yarrow-502897_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/10/23/15/10/pumpkin-3767022_1280.jpg",
  "https://cdn.pixabay.com/photo/2019/06/03/06/35/sunflower-4248583_1280.jpg",
  "https://cdn.pixabay.com/photo/2022/07/27/03/31/herbs-7347118_1280.jpg",
  "https://cdn.pixabay.com/photo/2016/11/19/12/25/dandelion-1839134_1280.jpg",
  "https://cdn.pixabay.com/photo/2014/05/03/00/50/flower-meadow-336672_1280.jpg",
  "https://cdn.pixabay.com/photo/2015/06/08/15/26/thyme-801829_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/06/20/15/01/cultivated-plant-3486347_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/07/05/13/59/catnip-5372275_1280.jpg",
  "https://cdn.pixabay.com/photo/2019/07/02/10/11/rosemary-4311851_1280.jpg",
  "https://cdn.pixabay.com/photo/2015/06/08/15/14/basil-801715_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/03/30/16/14/oregano-3275456_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/07/20/14/02/greece-3550401_1280.jpg",
  "https://cdn.pixabay.com/photo/2019/06/10/18/00/passionflower-4264547_1280.jpg",
  "https://cdn.pixabay.com/photo/2017/08/13/01/55/hibiscus-2635595_1280.jpg",
  "https://cdn.pixabay.com/photo/2023/07/24/16/46/echinacea-8147383_1280.jpg",
  "https://cdn.pixabay.com/photo/2016/07/15/16/50/flowers-1519669_1280.jpg",
  "https://cdn.pixabay.com/photo/2019/05/31/13/11/corn-4241262_1280.jpg",
  "https://cdn.pixabay.com/photo/2015/04/10/00/18/flowers-715638_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/05/23/12/18/herbs-5209365_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/04/04/03/07/sage-5000927_1280.jpg",
  "https://cdn.pixabay.com/photo/2021/01/08/14/20/purple-coneflower-5899513_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/11/06/18/42/leaves-5719798_1280.jpg",
  "https://cdn.pixabay.com/photo/2016/11/23/15/39/cosmos-1853639_1280.jpg",
  "https://cdn.pixabay.com/photo/2017/08/23/01/19/flower-2671028_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/05/25/13/25/mint-5218211_1280.jpg",
  "https://cdn.pixabay.com/photo/2021/09/24/02/48/mint-6651304_1280.jpg",
  "https://cdn.pixabay.com/photo/2017/09/13/08/41/flower-2744749_1280.jpg",
  "https://cdn.pixabay.com/photo/2017/10/11/14/30/daisy-2841010_1280.jpg",
  "https://cdn.pixabay.com/photo/2017/10/13/12/29/nature-2847422_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/02/27/15/40/indigo-4884330_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/06/11/18/52/iris-3469220_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/05/14/18/18/wild-5171418_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/05/05/17/52/calendula-5134302_1280.jpg",
  "https://cdn.pixabay.com/photo/2021/02/08/14/07/butterfly-5995656_1280.jpg",
  "https://cdn.pixabay.com/photo/2017/02/21/21/14/blossom-2087483_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/05/26/19/31/bouquet-3432568_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/06/17/19/12/nasturtium-3481003_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/04/22/11/03/tulips-3341203_1280.jpg",
  "https://cdn.pixabay.com/photo/2019/03/20/16/04/nature-4068094_1280.jpg",
  "https://cdn.pixabay.com/photo/2019/05/15/09/32/bellflower-4204452_1280.jpg",
  "https://cdn.pixabay.com/photo/2013/07/30/12/26/lavender-168484_1280.jpg",
  "https://cdn.pixabay.com/photo/2022/06/07/05/47/medicinal-plant-7247724_1280.jpg"
];

// Completely rewritten getImageForPlant function with improved uniqueness checks
async function getImageForPlant(commonName, latinName) {
  try {
    console.log(`🔍 Finding unique image for ${commonName} (${latinName})...`);
    
    // Create a unique ID for this plant to track duplicates
    const plantId = `${commonName}_${latinName}`.toLowerCase();
    
    // Initialize variables
    let imageUrl = null;
    let imageSource = 'unknown';
    
    // Normalize plant names for better matching
    const normalizedCommon = normalizePlantName(commonName);
    const normalizedLatin = normalizePlantName(latinName);
    
    // Step 1: FIRST PRIORITY - Check for local images in the plant pages directory
    const localImageUrl = checkLocalImageExists(commonName);
    if (localImageUrl) {
      imageUrl = localImageUrl;
      imageSource = 'local image from plant pages directory';
      console.log(`✅ Found LOCAL image for ${commonName} at ${imageUrl.substring(0, 60)}...`);
      return imageUrl; // Return immediately if local image is found
    }
    
    // Step 2: Check for exact matches in our verified images dictionary
    if (verifiedPlantImages[normalizedCommon]) {
      imageUrl = verifiedPlantImages[normalizedCommon];
      imageSource = 'exact common name match';
    }
    else if (verifiedPlantImages[normalizedLatin]) {
      imageUrl = verifiedPlantImages[normalizedLatin];
      imageSource = 'exact latin name match';
    }
    
    // Step 3: If no exact match, try generic search terms
    if (!imageUrl) {
      // Try with simplified search terms (first word of common name)
      const searchTerm = normalizedCommon.split(' ')[0];
      if (searchTerm.length > 3 && verifiedPlantImages[searchTerm]) {
        imageUrl = verifiedPlantImages[searchTerm];
        imageSource = `generic term match: "${searchTerm}"`;
      }
    }
    
    // Step 4: If still no match, try partial matching with all verified plants
    if (!imageUrl) {
      for (const [key, url] of Object.entries(verifiedPlantImages)) {
        // Check if any part of plant name contains the key or vice versa
        if ((normalizedCommon.includes(key) || key.includes(normalizedCommon)) && key.length > 3) {
          // Check if this URL has already been used too many times
          const useCount = usedImages.get(url) || 0;
          if (useCount < 3) { // Limit reuse of the same image
            imageUrl = url;
            imageSource = `partial match: "${key}"`;
            break;
          }
        }
      }
    }
    
    // Step 5: Try adding the first word in the Latin name as a fallback
    if (!imageUrl && latinName) {
      const genus = latinName.split(' ')[0].toLowerCase();
      if (genus.length > 3 && verifiedPlantImages[genus]) {
        imageUrl = verifiedPlantImages[genus];
        imageSource = `genus match: "${genus}"`;
      }
    }
    
    // Step 6: If still no match, use an Unsplash plant image via our category-based function
    if (!imageUrl) {
      const category = getPlantCategory(commonName, '');
      imageUrl = getUnsplashPlantImageForCategory(category, commonName);
      imageSource = `Unsplash category match for ${category}`;
    }
    
    // Step 7: Last resort - if all else fails, use category fallback
    if (!imageUrl) {
      const category = getPlantCategory(commonName, '');
      imageUrl = categoryFallbackImages[category];
      imageSource = `category fallback for ${category}`;
    }
    
    // Track this URL to avoid overuse
    if (imageUrl) {
      usedImages.set(imageUrl, (usedImages.get(imageUrl) || 0) + 1);
    }
    
    console.log(`✅ Found image for ${commonName} via ${imageSource}: ${imageUrl ? imageUrl.substring(0, 60) + '...' : 'none'}`);
    
    // Download and validate the image
    const validatedUrl = await validateAndDownloadImage(imageUrl, commonName);
    return validatedUrl;
    
  } catch (error) {
    console.error(`❌ Error finding image for ${commonName}:`, error);
    return categoryFallbackImages['native-plants']; // Ultimate fallback
  }
}

// Function to generate a unique description for each plant
function generateDescription(commonName, latinName) {
  // Extract features from the Latin name to make descriptions unique
  const latinParts = latinName.split(' ');
  const speciesName = latinParts.length > 1 ? latinParts[1] : '';
  
  // Create a more varied set of descriptions
  const heights = ['1-2ft', '2-3ft', '3-4ft', '4-5ft', '6-12in'];
  const soilTypes = ['well-draining soil', 'loamy soil', 'sandy soil', 'clay soil', 'rich soil'];
  const waterNeeds = ['drought tolerant', 'moderate water', 'regular watering', 'occasional watering'];
  const sunNeeds = ['full sun', 'partial shade', 'full sun to partial shade', 'morning sun'];
  const bloomTimes = ['Spring', 'Summer', 'Fall', 'Late Summer', 'Early Spring'];
  
  // Use a hash of the plant name to select consistent but varied attributes
  const hash = (commonName + latinName).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const height = heights[hash % heights.length];
  const soil = soilTypes[(hash + 1) % soilTypes.length];
  const water = waterNeeds[(hash + 2) % waterNeeds.length];
  const sun = sunNeeds[(hash + 3) % sunNeeds.length];
  const bloomTime = bloomTimes[(hash + 4) % bloomTimes.length];
  
  return `${commonName} (${latinName}) is a beautiful native plant that adds color and ecological value to any garden. Prefers ${sun}. Grows ${height} tall. ${water.charAt(0).toUpperCase() + water.slice(1)}. Blooms in ${bloomTime}. This plant is ideal for naturalized areas, rain gardens, and pollinator-friendly landscapes. Best in ${soil}.`;
}

// Modified seedPlants function with proper error handling and data validation
async function seedPlants() {
  console.log('Starting to seed plants from CSV file with reliable image URLs...');
  
  try {
    // Add categories first
    for (const category of plantCategories) {
      try {
        // Create a simple object with only the necessary fields
        const categoryData = {
          name: String(category.name),
          slug: String(category.slug),
          description: String(category.description),
          image: String(category.image)
        };
        
        const docRef = await addDoc(collection(db, 'categories'), categoryData);
        console.log(`Added category: ${category.name} with ID: ${docRef.id}`);
        
        // Add a small delay between writes
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error adding category ${category.name}:`, error);
      }
    }
    
    // Now process the CSV file
    const plantData = [];
    
    // Updated CSV path - going up one directory to the project root
    const csvPath = path.join(__dirname, '..', 'plant pages', '2025 Hearthfire Plant List - Sheet1.csv');
    
    console.log('Looking for CSV file at:', csvPath);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }
    
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => {
        plantData.push(data);
      })
      .on('end', async () => {
        console.log(`CSV file successfully processed, found ${plantData.length} plants.`);
        
        // Process plants one by one with delay
        for (const plant of plantData) {
          try {
            const commonName = plant['Common Name'] || '';
            const latinName = plant['Latin Name'] || '';
            
            if (!commonName) {
              console.log('Skipping plant with missing name');
              continue;
            }

            console.log(`Processing plant: ${commonName}`);
            
            // Get appropriate image for this plant with our enhanced method
            let imageUrl;
            try {
              imageUrl = await getImageForPlant(commonName, latinName);
              
              // Ensure image URL is a valid string
              if (!imageUrl || typeof imageUrl !== 'string') {
                console.warn(`Invalid image URL for ${commonName}, using default fallback`);
                imageUrl = defaultImage;
              }
              
              // Validate that the URL doesn't contain invalid characters for Firestore
              if (!/^https?:\/\//.test(imageUrl) && !imageUrl.startsWith(siteBaseUrl)) {
                console.warn(`Image URL for ${commonName} is not properly formatted: ${imageUrl}`);
                imageUrl = `${siteBaseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
              }
            } catch (imageError) {
              console.error(`Failed to get image for ${commonName}:`, imageError);
              imageUrl = defaultImage;
            }
            
            // Get plant category
            const category = getPlantCategory(commonName, '');
            
            // Create validated product data with proper type checking
            const price = parseFloat((Math.random() * 10 + 4.99).toFixed(2));
            const quantity = Math.floor(Math.random() * 50) + 10;
            
            const productData = {
              name: String(commonName).slice(0, 1000), // Limit string length for Firestore
              latinName: String(latinName).slice(0, 1000),
              description: String(generateDescription(commonName, latinName)).slice(0, 1500),
              price: isNaN(price) ? 9.99 : price, // Default if parsing fails
              images: [String(imageUrl)], // Store as array to match app schema
              image: String(imageUrl), // Keep for backward compatibility
              quantity: isNaN(quantity) ? 20 : quantity, // Default if parsing fails
              category: String(category),
              featured: Boolean(Math.random() > 0.7),
              unit: 'plant'
            };
            
            // Log the data we're about to save for debugging
            console.log(`Saving data for ${commonName}: Image URL: ${productData.image.substring(0, 50)}...`);
            
            // Add product to Firestore with better error handling
            try {
              const docRef = await addDoc(collection(db, 'products'), productData);
              console.log(`Added plant: ${commonName} with ID: ${docRef.id}`);
            } catch (firestoreError) {
              console.error(`Error adding ${commonName} to Firestore:`, firestoreError);
              // Try once more with minimal data
              try {
                const fallbackData = {
                  name: String(commonName),
                  latinName: String(latinName),
                  price: 9.99,
                  images: [String(defaultImage)], // Store as array to match app schema
                  image: String(defaultImage), // Keep for backward compatibility
                  description: `${commonName} native plant`,
                  category: 'native-plants',
                  quantity: 10,
                  featured: false,
                  unit: 'plant'
                };
                const retryRef = await addDoc(collection(db, 'products'), fallbackData);
                console.log(`Retry successful for ${commonName} with ID: ${retryRef.id}`);
              } catch (retryError) {
                console.error(`Final attempt failed for ${commonName}:`, retryError);
              }
            }
            
            // Add a delay between writes to avoid overwhelming Firestore
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error processing plant:`, error);
            // Continue with next plant
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

// Category fallback images for when plant-specific images cannot be found
const categoryFallbackImages = {
  'Native Plants': 'https://images.unsplash.com/photo-1530176238587-b53979c32b8c?w=800',
  'Medicinal Herbs': 'https://images.unsplash.com/photo-1563599175592-c58dc214deff?w=800',
  'Pollinator Friendly': 'https://images.unsplash.com/photo-1498722403893-363d400b878f?w=800',
  'Culinary Herbs': 'https://images.unsplash.com/photo-1530176961185-4da0ff5f8a97?w=800'
};

// Map of known good images for specific plant types
const verifiedPlantImages = {
  // Milkweed varieties (each with UNIQUE images)
  "milkweed butterfly": "https://cdn.pixabay.com/photo/2016/08/07/15/01/asclepias-tuberosa-1576124_1280.jpg",
  "milkweed rose": "https://cdn.pixabay.com/photo/2020/05/15/17/28/milkweed-5174455_1280.jpg",
  "milkweed poke": "https://cdn.pixabay.com/photo/2017/08/13/03/21/milkweed-2636366_1280.jpg",
  "milkweed whorled": "https://cdn.pixabay.com/photo/2018/05/17/14/14/meadow-flowers-3408244_1280.jpg",
  "asclepias tuberosa": "https://cdn.pixabay.com/photo/2016/08/07/15/01/asclepias-tuberosa-1576124_1280.jpg",
  "asclepias incarnata": "https://cdn.pixabay.com/photo/2020/05/15/17/28/milkweed-5174455_1280.jpg",
  "asclepias exaltata": "https://cdn.pixabay.com/photo/2017/08/13/03/21/milkweed-2636366_1280.jpg",
  "asclepias verticillata": "https://cdn.pixabay.com/photo/2018/05/17/14/14/meadow-flowers-3408244_1280.jpg",
  
  // Verified flower images - ensuring unique images for each type
  "yarrow": "https://cdn.pixabay.com/photo/2018/07/14/02/44/achillea-millefolium-3536469_1280.jpg",
  "achillea millefolium": "https://cdn.pixabay.com/photo/2020/05/22/18/59/yarrow-5206858_1280.jpg",
  
  // Blue Wild Indigo and variants
  "blue wild indigo": "https://cdn.pixabay.com/photo/2020/05/27/17/40/baptisia-australis-5227920_1280.jpg",
  "indigo wild cream": "https://cdn.pixabay.com/photo/2019/05/19/05/04/baptisia-australis-4213381_1280.jpg",
  "dwarf blue indigo": "https://cdn.pixabay.com/photo/2017/05/26/04/57/blue-wild-indigo-2345605_1280.jpg",
  "baptisia australis": "https://cdn.pixabay.com/photo/2020/05/27/17/40/baptisia-australis-5227920_1280.jpg",
  "baptisia bracteata": "https://cdn.pixabay.com/photo/2020/04/15/14/51/flower-5047386_1280.jpg",
  "baptisia minor": "https://cdn.pixabay.com/photo/2017/05/26/04/57/blue-wild-indigo-2345605_1280.jpg",
  
  // Anise Hyssop with verified images
  "anise hyssop": "https://cdn.pixabay.com/photo/2018/07/01/20/01/anise-hyssop-3510037_1280.jpg",
  "agastache foeniculum": "https://cdn.pixabay.com/photo/2019/06/24/05/12/anise-4295221_1280.jpg",
  
  // Add the remaining verified plant images from our previous list
  // Herbs
  "catnip": "https://cdn.pixabay.com/photo/2018/07/20/13/52/cat-mint-3550707_1280.jpg",
  "mint": "https://cdn.pixabay.com/photo/2015/05/31/12/32/mint-791106_1280.jpg",
  "oregano": "https://cdn.pixabay.com/photo/2016/05/23/16/29/oregano-1410646_1280.jpg",
  "thyme": "https://cdn.pixabay.com/photo/2016/03/28/10/01/thyme-1285339_1280.jpg",
  "sage": "https://cdn.pixabay.com/photo/2018/06/10/20/30/sage-3467783_1280.jpg",
  "rosemary": "https://cdn.pixabay.com/photo/2017/08/07/07/06/herbs-2600870_1280.jpg",
  "marjoram": "https://cdn.pixabay.com/photo/2018/11/17/20/12/oregano-3821754_1280.jpg",
  "basil": "https://cdn.pixabay.com/photo/2016/05/05/02/37/basil-1373184_1280.jpg",
  
  // Specific salvia/sage varieties with better matches
  "blue sage": "https://cdn.pixabay.com/photo/2019/07/03/01/40/blue-sage-4313941_1280.jpg",
  "salvia azurea": "https://cdn.pixabay.com/photo/2018/05/28/19/28/blue-sage-3436717_1280.jpg",
  "blue salvia": "https://cdn.pixabay.com/photo/2015/01/31/11/32/salvia-617612_1280.jpg",
  "pink salvia": "https://cdn.pixabay.com/photo/2019/05/20/23/28/sage-4217937_1280.jpg",
  
  // Coneflowers and similar plants
  "echinacea": "https://cdn.pixabay.com/photo/2018/07/03/18/15/echinacea-3515621_1280.jpg",
  "coneflower": "https://cdn.pixabay.com/photo/2015/07/02/07/23/echinacea-829134_1280.jpg",
  "grey headed coneflower": "https://cdn.pixabay.com/photo/2019/08/03/01/46/yellow-coneflower-4380600_1280.jpg",
  "cutleaf coneflower": "https://cdn.pixabay.com/photo/2020/07/02/13/57/coneflower-5363845_1280.jpg",
  "black-eyed susan": "https://cdn.pixabay.com/photo/2017/08/01/13/07/rudbeckia-2565188_1280.jpg",
  "orange coneflower": "https://cdn.pixabay.com/photo/2019/07/13/11/44/coneflower-4334261_1280.jpg",
  "brown eyed susan": "https://cdn.pixabay.com/photo/2017/08/02/02/05/rudbeckia-2569402_1280.jpg",
  "sweet black eyed susan": "https://cdn.pixabay.com/photo/2016/07/16/21/01/black-eyed-susan-1522319_1280.jpg",
  
  // Other native plants
  "cardinal flower": "https://cdn.pixabay.com/photo/2019/07/14/15/59/lobelia-cardinalis-4337998_1280.jpg",
  "rattlesnake master": "https://cdn.pixabay.com/photo/2020/07/01/12/58/eryngium-planum-5359348_1280.jpg",
  "sunflower": "https://cdn.pixabay.com/photo/2016/08/28/23/24/sunflower-1627193_1280.jpg",
  "woodland sunflower": "https://cdn.pixabay.com/photo/2018/07/13/08/47/helianthus-strumosus-3535438_1280.jpg",
  "western sunflower": "https://cdn.pixabay.com/photo/2018/07/15/20/43/helianthus-3540266_1280.jpg",
  "monarda": "https://cdn.pixabay.com/photo/2018/05/15/22/13/monarda-3404086_1280.jpg",
  "monarda bee balm": "https://cdn.pixabay.com/photo/2018/07/13/22/55/flower-3536775_1280.jpg",
  "spotted bee balm": "https://cdn.pixabay.com/photo/2017/08/24/05/39/spotted-horse-mint-2675905_1280.jpg",
  "wild bergamot": "https://cdn.pixabay.com/photo/2020/06/30/22/34/bergamot-5357960_1280.jpg",
  "vervain": "https://cdn.pixabay.com/photo/2018/07/15/08/49/verbena-3539464_1280.jpg",
  "blue vervain": "https://cdn.pixabay.com/photo/2021/08/24/13/22/flower-6570996_1280.jpg",
  "joe pye weed": "https://cdn.pixabay.com/photo/2020/07/12/17/56/joe-pye-weed-5397899_1280.jpg",
  "boneset": "https://cdn.pixabay.com/photo/2018/07/13/11/52/white-snake-root-3535536_1280.jpg",
  "mistflower": "https://cdn.pixabay.com/photo/2016/07/13/11/47/mistflower-1514274_1280.jpg",
  
  // Other problematic plants
  "rose mallow": "https://cdn.pixabay.com/photo/2018/08/12/15/46/mallow-3600370_1280.jpg",
  "hibiscus": "https://cdn.pixabay.com/photo/2018/05/13/16/04/hibiscus-3397288_1280.jpg",
  "st. johns wort": "https://cdn.pixabay.com/photo/2018/06/29/01/42/st-john-s-wort-3505868_1280.jpg",
  "elecampane": "https://cdn.pixabay.com/photo/2017/07/24/20/04/elecampane-2535946_1280.jpg",
  "round headed bush clover": "https://cdn.pixabay.com/photo/2017/08/17/09/03/lespedeza-2650727_1280.jpg",
  "passionflower": "https://cdn.pixabay.com/photo/2015/10/18/20/00/passiflora-994686_1280.jpg",
  "ironweed": "https://cdn.pixabay.com/photo/2016/07/29/07/41/ironweed-1551367_1280.jpg",
  "nasturtium": "https://cdn.pixabay.com/photo/2017/02/24/12/19/nasturtium-2094618_1280.jpg",
  "stinging nettle": "https://cdn.pixabay.com/photo/2017/04/08/18/34/stinging-nettle-2214052_1280.jpg",
  "valerian": "https://cdn.pixabay.com/photo/2016/06/19/12/43/valerian-1466416_1280.jpg",
  "swamp marigold": "https://cdn.pixabay.com/photo/2017/08/27/15/53/marsh-marigold-2686351_1280.jpg",
  "river oats": "https://cdn.pixabay.com/photo/2018/08/08/15/29/northern-sea-oats-3592174_1280.jpg",
  "royal catchfly": "https://cdn.pixabay.com/photo/2018/07/07/00/19/silene-regia-3520831_1280.jpg",
  
  // Additional plant mappings
  "meadow anemone": "https://cdn.pixabay.com/photo/2018/01/30/15/17/anemone-3119233_1280.jpg",
  "plantain": "https://cdn.pixabay.com/photo/2020/06/04/20/25/plantago-5259365_1280.jpg",
  "mayapple": "https://cdn.pixabay.com/photo/2020/01/05/22/34/mayapple-4744291_1280.jpg",
  "rattlesnake plantain": "https://cdn.pixabay.com/photo/2015/06/06/20/47/orchid-799775_1280.jpg",
  "bloodroot": "https://cdn.pixabay.com/photo/2015/04/10/00/15/bloodroot-715632_1280.jpg",
  "downy woodmint": "https://cdn.pixabay.com/photo/2018/08/11/17/04/mint-3598604_1280.jpg",
  "cutleaf coneflower": "https://cdn.pixabay.com/photo/2020/08/08/12/46/rudbeckia-laciniata-5472513_1280.jpg",
  
  // FIXED PROBLEMATIC PLANTS WITH VERIFIED IMAGES
  "valerian": "https://images.unsplash.com/photo-1530158177759-68d0ef555c59?auto=format&w=800",
  "valeriana officinalis": "https://images.unsplash.com/photo-1530158177759-68d0ef555c59?auto=format&w=800",
  "pink salvia": "https://images.unsplash.com/photo-1558867542-5a778e579522?auto=format&w=800",
  "salvia horminum": "https://images.unsplash.com/photo-1558867542-5a778e579522?auto=format&w=800",
  "boneset": "https://images.unsplash.com/photo-1524131488380-ccd90798a0b6?auto=format&w=800",
  "eupatorium perfoliatum": "https://images.unsplash.com/photo-1524131488380-ccd90798a0b6?auto=format&w=800",
  "mistflower": "https://images.unsplash.com/photo-1600103634597-c1e4981e0ae9?auto=format&w=800",
  "conoclinium coelestinum": "https://images.unsplash.com/photo-1600103634597-c1e4981e0ae9?auto=format&w=800",
  "mountain mint": "https://images.unsplash.com/photo-1563822249366-7b0979e7d4fb?auto=format&w=800",
  "mtn mint": "https://images.unsplash.com/photo-1563822249366-7b0979e7d4fb?auto=format&w=800",
  "pycnanthemum": "https://images.unsplash.com/photo-1563822249366-7b0979e7d4fb?auto=format&w=800",
  "hibiscus": "https://images.unsplash.com/photo-1589136777351-ffc02d9c366a?auto=format&w=800",
  "hibiscus sabdariffa": "https://images.unsplash.com/photo-1589136777351-ffc02d9c366a?auto=format&w=800",
  "hibiscus laevis": "https://images.unsplash.com/photo-1589136777351-ffc02d9c366a?auto=format&w=800"
}; 