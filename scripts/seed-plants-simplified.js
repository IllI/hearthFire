// Simplified script to seed the Firestore database with plant products
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
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

// Simplified plant categories
const plantCategories = [
  {
    name: 'Native Plants',
    slug: 'native-plants',
    description: 'Native plants adapted to local conditions',
    image: 'https://images.unsplash.com/photo-1567331711402-509c12c41959?auto=format&w=800'
  },
  {
    name: 'Medicinal Herbs',
    slug: 'medicinal-herbs',
    description: 'Plants with traditional medicinal properties',
    image: 'https://images.unsplash.com/photo-1562338067-589a9276be89?auto=format&w=800'
  },
  {
    name: 'Pollinator Friendly',
    slug: 'pollinator-friendly',
    description: 'Plants that attract and support pollinators',
    image: 'https://images.unsplash.com/photo-1559563362-c667ba5f5480?auto=format&w=800'
  },
  {
    name: 'Culinary Herbs',
    slug: 'culinary-herbs',
    description: 'Flavorful herbs for cooking and teas',
    image: 'https://images.unsplash.com/photo-1585032767761-878270336a0e?auto=format&w=800'
  }
];

// Reliable plant image map with well-tested URLs
const plantImages = {
  // Native wildflowers
  "echinacea": "https://images.unsplash.com/photo-1533038590840-1f704a2eb6ab?auto=format&w=800",
  "coneflower": "https://images.unsplash.com/photo-1533038590840-1f704a2eb6ab?auto=format&w=800",
  "black-eyed susan": "https://images.unsplash.com/photo-1593176902240-adf7be500897?auto=format&w=800",
  "rudbeckia": "https://images.unsplash.com/photo-1593176902240-adf7be500897?auto=format&w=800",
  
  // Larger flowers
  "sunflower": "https://images.unsplash.com/photo-1551129901-096894c99afd?auto=format&w=800",
  "aster": "https://images.unsplash.com/photo-1571261354271-93fc13968a33?auto=format&w=800",
  "calico": "https://images.unsplash.com/photo-1571261354271-93fc13968a33?auto=format&w=800",
  "frost": "https://images.unsplash.com/photo-1571261354271-93fc13968a33?auto=format&w=800",
  
  // Herb varieties
  "mint": "https://images.unsplash.com/photo-1628556270448-4d4e4148e4cb?auto=format&w=800",
  "mountain mint": "https://images.unsplash.com/photo-1628556270448-4d4e4148e4cb?auto=format&w=800",
  "catnip": "https://images.unsplash.com/photo-1628556270448-4d4e4148e4cb?auto=format&w=800",
  "slender": "https://images.unsplash.com/photo-1628556270448-4d4e4148e4cb?auto=format&w=800",
  "oregano": "https://images.unsplash.com/photo-1620057657132-4daded6913d5?auto=format&w=800",
  "thyme": "https://images.unsplash.com/photo-1599108859519-8eb4e4fb69e3?auto=format&w=800",
  "sage": "https://images.unsplash.com/photo-1608198491498-cd202162c59c?auto=format&w=800",
  
  // Specialized plants
  "milkweed": "https://images.unsplash.com/photo-1530092285049-1c42085fd395?auto=format&w=800",
  "asclepias": "https://images.unsplash.com/photo-1530092285049-1c42085fd395?auto=format&w=800",
  "butterfly": "https://images.unsplash.com/photo-1530092285049-1c42085fd395?auto=format&w=800",
  "bee balm": "https://images.unsplash.com/photo-1597383384562-b7b7f738d418?auto=format&w=800",
  "monarda": "https://images.unsplash.com/photo-1597383384562-b7b7f738d418?auto=format&w=800",
  "bergamot": "https://images.unsplash.com/photo-1597383384562-b7b7f738d418?auto=format&w=800",
  
  // Joe Pye varieties
  "joe pye": "https://images.unsplash.com/photo-1625509405984-5516e2949cf0?auto=format&w=800",
  "eutrochium": "https://images.unsplash.com/photo-1625509405984-5516e2949cf0?auto=format&w=800",
  
  // Other native plants
  "vervain": "https://images.unsplash.com/photo-1632837315527-239665f6ebb4?auto=format&w=800",
  "yarrow": "https://images.unsplash.com/photo-1595925889916-1f58de8e74dd?auto=format&w=800",
  "achillea": "https://images.unsplash.com/photo-1595925889916-1f58de8e74dd?auto=format&w=800",
  "rattlesnake": "https://images.unsplash.com/photo-1505472483342-375ee7136082?auto=format&w=800",
  "valerian": "https://images.unsplash.com/photo-1599421294023-e9ed48518be7?auto=format&w=800",
  
  // Grasses and sedges
  "grass": "https://images.unsplash.com/photo-1560785043-86d924772836?auto=format&w=800",
  "oats": "https://images.unsplash.com/photo-1611467615931-dd41ac50ef4a?auto=format&w=800",
  "river": "https://images.unsplash.com/photo-1611467615931-dd41ac50ef4a?auto=format&w=800",
  "clover": "https://images.unsplash.com/photo-1501673618753-60910c5b6136?auto=format&w=800",
  "headed": "https://images.unsplash.com/photo-1501673618753-60910c5b6136?auto=format&w=800",
  "bush": "https://images.unsplash.com/photo-1501673618753-60910c5b6136?auto=format&w=800"
};

// Safe and reliable category fallback images
const categoryFallbackImages = {
  "native-plants": "https://images.unsplash.com/photo-1567331711402-509c12c41959?auto=format&w=800",
  "medicinal-herbs": "https://images.unsplash.com/photo-1562338067-589a9276be89?auto=format&w=800",
  "pollinator-friendly": "https://images.unsplash.com/photo-1566804157193-837ff1cac63f?auto=format&w=800",
  "culinary-herbs": "https://images.unsplash.com/photo-1585032767761-878270336a0e?auto=format&w=800"
};

// Default fallback image (super reliable)
const defaultImage = "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&w=800";

// Base URL for your local image hosting
const siteBaseUrl = 'http://localhost:3001';

// Function to normalize plant name for directory lookup
function normalizeNameForDirectory(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Remove special characters
    .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
    .trim();
}

// Function to check if a local image exists for a plant
function checkLocalImageExists(commonName) {
  try {
    // Normalize the plant name to match likely directory name
    const normalizedName = normalizeNameForDirectory(commonName);
    
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

// Function to determine plant category based on name
function getPlantCategory(commonName, latinName) {
  const name = (commonName || '').toLowerCase() + ' ' + (latinName || '').toLowerCase();
  
  if (name.includes('mint') || name.includes('mentha') || 
      name.includes('sage') || name.includes('salvia') || 
      name.includes('thyme') || name.includes('thymus') || 
      name.includes('oregano') || name.includes('origanum') || 
      name.includes('rosemary') || name.includes('basil') ||
      name.includes('lavender') || name.includes('ocimum') ||
      name.includes('catnip') || name.includes('nepeta')) {
    return 'culinary-herbs';
  }
  
  if (name.includes('milkweed') || name.includes('asclepias') || 
      name.includes('butterfly') || name.includes('bee balm') || 
      name.includes('monarda') || name.includes('coneflower') || 
      name.includes('echinacea') || name.includes('sunflower') ||
      name.includes('helianthus') || name.includes('lobelia') || 
      name.includes('bergamot') || name.includes('cardinal') ||
      name.includes('vervain') || name.includes('verbena') ||
      name.includes('goldenrod')) {
    return 'pollinator-friendly';
  }
  
  if (name.includes('echinacea') || name.includes('valerian') || 
      name.includes('skullcap') || name.includes('scutellaria') || 
      name.includes('nettle') || name.includes('tulsi') ||
      name.includes('hypericum') || name.includes('elder') ||
      name.includes('yarrow') || name.includes('achillea') ||
      name.includes('lemon balm')) {
    return 'medicinal-herbs';
  }
  
  return 'native-plants';
}

// Updated image matching function with local image priority
function getImageForPlant(commonName, latinName) {
  try {
    // First, check if we have a local image
    const localImageUrl = checkLocalImageExists(commonName);
    if (localImageUrl) {
      console.log(`Using local image for ${commonName}: ${localImageUrl}`);
      return localImageUrl;
    }
    
    // If no local image, fall back to previous logic
    console.log(`No local image found for ${commonName}, using Unsplash fallback`);
    
    // Convert names to lowercase for matching
    const commonNameLower = (commonName || '').toLowerCase();
    const latinNameLower = (latinName || '').toLowerCase();
    
    // Try to find a match in our image map using common name
    for (const [keyword, imageUrl] of Object.entries(plantImages)) {
      if (commonNameLower.includes(keyword)) {
        console.log(`Matched ${commonName} to image for "${keyword}"`);
        return imageUrl;
      }
    }
    
    // Try using Latin name if common name didn't match
    for (const [keyword, imageUrl] of Object.entries(plantImages)) {
      if (latinNameLower.includes(keyword)) {
        console.log(`Matched ${latinName} to image for "${keyword}"`);
        return imageUrl;
      }
    }
    
    // If no specific match found, use category fallback
    const category = getPlantCategory(commonName, latinName);
    console.log(`No direct match for ${commonName}, using category ${category} fallback`);
    return categoryFallbackImages[category];
  } catch (error) {
    console.error(`Error matching image for ${commonName}:`, error);
    // Always return a valid image URL if something goes wrong
    return defaultImage;
  }
}

// Generate basic plant description
function generateDescription(commonName, latinName) {
  return `${commonName} (${latinName}) is a beautiful native plant that adds color and ecological value to any garden. Full sun. 3-4ft tall. Drought tolerant. Blooms in Fall. This plant is ideal for naturalized areas, rain gardens, and pollinator-friendly landscapes.`;
}

// Seed database with plants from CSV
async function seedPlants() {
  console.log('Starting to seed plants from CSV file (simplified version)...');
  
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

            // Get appropriate image for this plant
            const imageUrl = getImageForPlant(commonName, latinName);
            
            // Get plant category
            const category = getPlantCategory(commonName, latinName);
            
            // Create simplified product data with validated types
            const productData = {
              name: String(commonName),
              latinName: String(latinName),
              description: generateDescription(commonName, latinName),
              price: parseFloat((Math.random() * 10 + 4.99).toFixed(2)),
              image: String(imageUrl),
              quantity: Math.floor(Math.random() * 50) + 10,
              category: String(category),
              featured: Math.random() > 0.7,
              unit: 'plant'
            };
            
            // Add product to Firestore
            const docRef = await addDoc(collection(db, 'products'), productData);
            console.log(`Added plant: ${commonName} with ID: ${docRef.id}`);
            
            // Add a delay between writes to avoid overwhelming Firestore
            await new Promise(resolve => setTimeout(resolve, 500));
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