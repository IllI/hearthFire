// Enhanced Plant Seeder Script
// Features improved image selection and detailed plant descriptions
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, updateDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
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

// Define site base URL
const siteBaseUrl = 'http://localhost:3000';

// Plant categories
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

// Dictionary of curated plant descriptions
const plantDescriptions = {
  "Yarrow": "Yarrow (Achillea millefolium) is a versatile perennial featuring flat-topped clusters of tiny, daisy-like flowers in white, yellow, pink, or red above finely dissected, fern-like foliage. Growing 2-3 feet tall, this drought-tolerant plant blooms from early summer to early fall. Its aromatic leaves have been used medicinally for centuries. Attracts beneficial insects and butterflies while deterring many pests and withstanding poor soils, heat, and drought. Perfect for cottage gardens, meadow plantings, and xeriscaping. The long-lasting blooms also make excellent cut and dried flowers.",
  
  "Echinacea": "Echinacea purpurea, commonly known as Purple Coneflower, is a beloved native perennial featuring large, daisy-like flowers with distinctive cone-shaped centers and swept-back, rosy-purple petals. This hardy plant grows 2-5 feet tall and blooms from early summer through fall. Beyond its ornamental appeal, Echinacea is valued for its medicinal properties and ability to attract butterflies, bees, and hummingbirds. Thriving in full sun to part shade, it's drought-tolerant once established and makes an excellent choice for prairie gardens, perennial borders, and cutting gardens with its long-lasting blooms.",
  
  "Cutleaf coneflower": "Cutleaf Coneflower (Rudbeckia laciniata) is a tall, dramatic native perennial with uniquely lobed, deeply cut leaves and bright yellow flowers with drooping petals and green-yellow dome-shaped centers. Reaching 3-9 feet tall, this late summer to fall bloomer adds vertical interest to garden backgrounds and naturalized areas. Though less commonly grown than other coneflowers, it's a valuable addition to rain gardens, woodland edges, and cottage-style plantings. Attracts pollinators and birds, which feed on its seeds through winter. Prefers rich, moist soil but adapts to various conditions.",
  
  // Bee Balm varieties
  "Bee Balm": "Bee Balm (Monarda didyma) is a vibrant native perennial featuring whorls of shaggy, tubular flowers in shades of red, pink, or purple atop aromatic foliage. Reaching 2-4 feet tall, it blooms from early to late summer, creating a dramatic display while attracting bees, butterflies, and hummingbirds in abundance. The fragrant leaves have a spicy, citrusy scent and can be used in teas and culinary creations. Thrives in medium to wet soils in full sun to partial shade, making it perfect for cottage gardens, herb gardens, and naturalized areas.",
  
  "Spotted Bee Balm": "Spotted Bee Balm (Monarda punctata) is a distinctive native perennial featuring unique tiered flower structures with pale yellow to lavender tubular blossoms subtended by showy pink-tinged bracts. Growing 1-3 feet tall, its pale green foliage is strongly aromatic and has traditionally been used for tea and medicinal purposes. This drought-tolerant plant thrives in sandy, well-drained soils and full sun, making it perfect for rock gardens and dry meadows. A magnet for specialized native bees, butterflies, and beneficial insects, it adds both ecological value and architectural interest to native plant gardens.",
  
  "Wild Bergamot": "Wild Bergamot (Monarda fistulosa) is a showy native perennial with crown-like clusters of lavender-pink tubular flowers that bloom from mid-summer to early fall. This aromatic member of the mint family reaches 2-4 feet tall with a spreading habit and fragrant gray-green foliage. Highly attractive to bees, butterflies, and hummingbirds, it's also deer-resistant. The leaves can be used for tea with a distinctive oregano-mint flavor. Extremely adaptable to various soil conditions and drought-tolerant once established, it's perfect for prairie gardens, naturalized areas, and pollinator habitats.",
  
  // Mints
  "Mountain Mint": "Mountain Mint (Pycnanthemum virginianum) is a highly aromatic native perennial featuring clusters of tiny white flowers dotted with purple and covered in silvery bracts that create the illusion of a frosted appearance. Growing 2-3 feet tall, it blooms from mid-summer through fall and consistently ranks among the top plants for attracting beneficial insects and pollinators. The intensely minty leaves can be used fresh or dried for tea. Despite its name, it's adaptable to most garden conditions, forming tidy clumps without the aggressive spreading of other mints. Perfect for herb gardens and naturalized areas.",
  
  // Other herbaceous flowers
  "Valerian": "Valerian (Valeriana officinalis) is a tall perennial herb known for its sweetly fragrant clusters of small, pale pink to white flowers that bloom in late spring to early summer atop stems reaching 3-5 feet in height. The plant's root has been used for centuries as a natural sedative and sleep aid. In the garden, its showy flower heads attract beneficial insects and butterflies. Preferring moist, rich soils in partial shade, it's ideal for cottage gardens, herb gardens, and naturalized areas. The vanilla-like fragrance of the flowers contrasts with the distinctive strong smell of the roots.",
  
  "Boneset": "Boneset (Eupatorium perfoliatum) is a robust native perennial featuring flat-topped clusters of fluffy white flowers that bloom from mid-summer through fall. Growing 3-5 feet tall, its most distinctive feature is the way its lance-shaped leaves appear to be pierced by the stem, giving it the appearance of joined or 'perfoliate' leaves. Historically used in herbal medicine, this plant thrives in wet areas, making it ideal for rain gardens, pond edges, and wetland restorations. A magnet for butterflies and beneficial insects, it combines ecological value with architectural presence in the late-season landscape.",
  
  "Mistflower": "Mistflower (Conoclinium coelestinum) is a charming native perennial that produces clouds of small, fluffy blue-purple flowers reminiscent of ageratum from late summer until frost. Forming spreading clumps 1-3 feet tall, its bright green, triangular leaves create an attractive backdrop for the ethereal blooms. Butterflies, especially monarchs, are strongly attracted to this late-season nectar source. Preferring moist, rich soils but adaptable to various conditions, it's perfect for cottage gardens, butterfly gardens, and moist areas. Can spread vigorously in ideal conditions, making it excellent for filling space or naturalizing.",
  
  "Vervain, Blue": "Blue Vervain (Verbena hastata) is an elegant native perennial featuring multiple candelabra-like spikes of tiny, intensely blue-purple flowers that bloom progressively from bottom to top. Reaching 3-5 feet tall with a slender, branching habit, it blooms from midsummer to early fall. The rough, lance-shaped leaves have traditionally been used in herbal medicine. This adaptable plant thrives in average to wet soils, making it perfect for rain gardens, meadows, and wetland edges. Attracts a wide variety of pollinators, especially butterflies and native bees, while being deer-resistant.",
  
  "Stinging Nettle": "Stinging Nettle (Urtica dioica) is a remarkable perennial herb whose nutritional and medicinal benefits far outweigh its notorious defense mechanism. Growing 3-6 feet tall, its deep green, toothed leaves and stems are covered with tiny hairs that inject a mild irritant upon contact. Despite this, it's prized as a nutrient-dense superfood rich in vitamins and minerals, and the young leaves can be cooked as a spinach substitute or made into tea and tinctures. It's also an essential host plant for several butterfly species. Plant in out-of-the-way spots or dedicated herb gardens where its spreading habit won't interfere with high-traffic areas.",
  
  "Anise Hyssop": "Anise Hyssop (Agastache foeniculum) is a versatile perennial herb featuring showy spikes of lavender-blue flowers that bloom from midsummer to early fall above aromatic, anise-scented foliage. Growing 2-4 feet tall, this easy-care plant attracts a multitude of bees, butterflies, and hummingbirds while remaining deer-resistant. The leaves and flowers can be used fresh or dried for a delightful licorice-mint flavored tea. Drought-tolerant once established, it thrives in full sun and well-drained soil, making it perfect for herb gardens, perennial borders, and pollinator habitats.",
  
  "Hibiscus": "Hardy Hibiscus (Hibiscus moscheutos), also known as Rose Mallow, is a showstopping perennial that produces enormous dinner-plate sized flowers in dramatic shades of white, pink, or red with prominent staminal columns. Despite its tropical appearance, this native plant is remarkably cold-hardy. Growing 3-7 feet tall, it blooms from midsummer until frost, with each flower lasting only a day but produced in succession. Preferring consistently moist soil and full sun, it's ideal for rain gardens, pond edges, and bog gardens. Attracts hummingbirds and butterflies while creating bold architectural interest in the late summer landscape.",
  
  "Rose Mallow": "Rose Mallow (Hibiscus moscheutos) is a spectacular native perennial that produces enormous 6-8 inch flowers in shades of white, pink or deep rose with crimson centers. Growing 3-7 feet tall with a shrub-like habit, this bold specimen creates dramatic impact from midsummer until frost. Despite its tropical appearance, it's surprisingly winter-hardy and returns reliably each year, though emerging late in spring. Thrives in consistently moist soils and full sun, making it perfect for rain gardens, pond margins, and wet areas. Attracts hummingbirds and serves as a host plant for specialized hibiscus moths."
};

// Function to normalize plant names for better matching
function normalizePlantName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^\w\s,]/g, '')  // Remove special chars except commas
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim();
}

// Function to find local images for plants
function findLocalImage(commonName) {
  try {
    // Normalize the plant name for better matching
    const normalizedName = normalizePlantName(commonName);
    
    // Check for direct match in plant directories
    const plantDir = path.join(__dirname, '..', 'plant pages', commonName);
    const imageDir = path.join(plantDir, 'images');
    const imagePath = path.join(imageDir, 'image1.jpg');
    
    if (fs.existsSync(imagePath)) {
      console.log(`✅ Found direct match image for ${commonName}`);
      // Convert to API path for serving
      return `${siteBaseUrl}/api/plant-images/${encodeURIComponent(commonName)}/images/image1.jpg`;
    }
    
    // Check plant pages directory for partial matches
    const plantPagesDir = path.join(__dirname, '..', 'plant pages');
    if (fs.existsSync(plantPagesDir)) {
      const directories = fs.readdirSync(plantPagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name !== 'images') // Exclude the general images directory
        .map(dirent => dirent.name);
      
      // Look for directory names that might match our plant
      for (const dir of directories) {
        const dirLower = dir.toLowerCase();
        
        // Check if directory name contains our plant name or vice versa
        if (dirLower.includes(normalizedName) || normalizedName.includes(dirLower)) {
          const potentialImagePath = path.join(plantPagesDir, dir, 'images', 'image1.jpg');
          if (fs.existsSync(potentialImagePath)) {
            console.log(`✅ Found partial match image for ${commonName} in ${dir}`);
            return `${siteBaseUrl}/api/plant-images/${encodeURIComponent(dir)}/images/image1.jpg`;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error finding local image for ${commonName}:`, error);
    return null;
  }
}

// Dictionary of verified plant images for when local images aren't available
const verifiedPlantImages = {
  // Categorized by plant types
  
  // Coneflowers
  "echinacea": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Echinacea_purpurea_001.JPG/800px-Echinacea_purpurea_001.JPG",
  "coneflower": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Echinacea_purpurea_%27Magnus%27_Flower_2800px.jpg/800px-Echinacea_purpurea_%27Magnus%27_Flower_2800px.jpg",
  "rudebeckia": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Prairie_Coneflower%2C_Yellow_Coneflower_-_Ratibida_columnifera.jpg/800px-Prairie_Coneflower%2C_Yellow_Coneflower_-_Ratibida_columnifera.jpg",
  "black eyed susan": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Black-eyed_Susan_%28Rudbeckia_hirta%29_-_Guelph%2C_Ontario.jpg/800px-Black-eyed_Susan_%28Rudbeckia_hirta%29_-_Guelph%2C_Ontario.jpg",
  "cutleaf coneflower": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Rudbeckia_laciniata.jpg/800px-Rudbeckia_laciniata.jpg",
  
  // Monarda varieties
  "bee balm": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Monarda_didyma_-_Harilik_monarda.jpg/800px-Monarda_didyma_-_Harilik_monarda.jpg",
  "monarda": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Monarda_fistulosa_2.jpg/800px-Monarda_fistulosa_2.jpg",
  "wild bergamot": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Wild_bergamot_%28Monarda_fistulosa%29_RP.jpg/800px-Wild_bergamot_%28Monarda_fistulosa%29_RP.jpg",
  "spotted bee balm": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Monarda_punctata_--_Prairie_Moon_Nursery.jpg/800px-Monarda_punctata_--_Prairie_Moon_Nursery.jpg",
  
  // Milkweed varieties
  "milkweed": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Asclepias_syriaca_2018-07-08_5191.jpg/800px-Asclepias_syriaca_2018-07-08_5191.jpg",
  "butterfly milkweed": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Butterfly_Milkweed_Asclepias_tuberosa_3008px.jpg/800px-Butterfly_Milkweed_Asclepias_tuberosa_3008px.jpg",
  "whorled milkweed": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Asclepias_verticillata.jpg/800px-Asclepias_verticillata.jpg",
  "rose milkweed": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Asclepias_incarnata.jpg/800px-Asclepias_incarnata.jpg",
  "poke milkweed": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Asclepias_exaltata_2.JPG/800px-Asclepias_exaltata_2.JPG",
  
  // Mints
  "mountain mint": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Pycnanthemum_virginianum.jpg/800px-Pycnanthemum_virginianum.jpg",
  "mint": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Mentha_piperita_-_Köhler–s_Medizinal-Pflanzen-093.jpg/800px-Mentha_piperita_-_Köhler–s_Medizinal-Pflanzen-093.jpg",
  "peppermint": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Mentha_×_piperita_-_blossom_%28aka%29.jpg/800px-Mentha_×_piperita_-_blossom_%28aka%29.jpg",
  "spearmint": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Mentha_spicata.jpg/800px-Mentha_spicata.jpg",
  
  // Herbs
  "sage": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Salvia_officinalis0.jpg/800px-Salvia_officinalis0.jpg",
  "thyme": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Thymus_vulgaris0.jpg/800px-Thymus_vulgaris0.jpg",
  "anise hyssop": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Agastache_foeniculum_kz7.jpg/800px-Agastache_foeniculum_kz7.jpg",
  "valerian": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Valeriana_officinalis-Valériane_officinale.jpg/800px-Valeriana_officinalis-Valériane_officinale.jpg",
  "catnip": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Catnip_flowers.jpg/800px-Catnip_flowers.jpg",
  "oregano": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Origanum_vulgare_-_harilik_pune.jpg/800px-Origanum_vulgare_-_harilik_pune.jpg",
  "marjoram": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Origanum_majorana_001.JPG/800px-Origanum_majorana_001.JPG",
  "rosemary": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Rosmarinus_officinalis0.jpg/800px-Rosmarinus_officinalis0.jpg",
  
  // Other notable plants
  "hibiscus": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Swamp_Rose_Mallow_%28Hibiscus_moscheutos%29_-_Kitchener%2C_Ontario_02.jpg/800px-Swamp_Rose_Mallow_%28Hibiscus_moscheutos%29_-_Kitchener%2C_Ontario_02.jpg",
  "rose mallow": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Hibiscus_moscheutos_%27Luna_Red%27_Flowers_3008px.jpg/800px-Hibiscus_moscheutos_%27Luna_Red%27_Flowers_3008px.jpg",
  "rattlesnake master": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Eryngium_yuccifolium_UMFS_2.jpg/800px-Eryngium_yuccifolium_UMFS_2.jpg",
  "blue vervain": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Verbena_hastata.jpg/800px-Verbena_hastata.jpg",
  "stinging nettle": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Brennnessel_1.JPG/800px-Brennnessel_1.JPG",
  "passionflower": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Passionflower_April_2006_Cimarron_River_Valley_in_Cushing_Oklahoma.jpg/800px-Passionflower_April_2006_Cimarron_River_Valley_in_Cushing_Oklahoma.jpg",
  "indigo": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Baptisia_australis_02.jpg/800px-Baptisia_australis_02.jpg",
  "wild indigo": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Baptisia_australis_02.jpg/800px-Baptisia_australis_02.jpg"
};

// Get the best image for a plant
async function getImageForPlant(commonName, latinName) {
  try {
    console.log(`Finding image for ${commonName} (${latinName})`);
    
    // First priority: Look for local image in the plant pages directory
    const localImage = findLocalImage(commonName);
    if (localImage) {
      console.log(`✅ Using local image for ${commonName}`);
      return localImage;
    }
    
    // Second priority: Check our verified images dictionary
    const normalizedCommonName = normalizePlantName(commonName);
    const normalizedLatinName = normalizePlantName(latinName);
    
    // Try direct match on common name
    if (verifiedPlantImages[normalizedCommonName]) {
      console.log(`✅ Using verified image for exact match: ${normalizedCommonName}`);
      return verifiedPlantImages[normalizedCommonName];
    }
    
    // Try matching parts of the common name against our verified images
    for (const [key, imageUrl] of Object.entries(verifiedPlantImages)) {
      if (normalizedCommonName.includes(key) || key.includes(normalizedCommonName)) {
        console.log(`✅ Using verified image for partial match: ${key}`);
        return imageUrl;
      }
      
      // Try matching Latin name as well
      if (normalizedLatinName && (normalizedLatinName.includes(key) || key.includes(normalizedLatinName))) {
        console.log(`✅ Using verified image for Latin name match: ${key}`);
        return imageUrl;
      }
    }
    
    // Third priority: Use a category-appropriate default image
    const category = getPlantCategory(commonName, latinName);
    const categoryImages = {
      'native-plants': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Echinacea_purpurea_GotBot_2015_001.jpg/800px-Echinacea_purpurea_GotBot_2015_001.jpg',
      'medicinal-herbs': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Echinacea_-_im_Einsatz_gegen_Erk%C3%A4ltungskrankheiten.jpg/800px-Echinacea_-_im_Einsatz_gegen_Erk%C3%A4ltungskrankheiten.jpg',
      'pollinator-friendly': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Bee_on_flower_at_Indhus_Valley.jpg/800px-Bee_on_flower_at_Indhus_Valley.jpg',
      'culinary-herbs': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Basil-Basilico-Ocimum_basilicum-albahaca.jpg/800px-Basil-Basilico-Ocimum_basilicum-albahaca.jpg'
    };
    
    console.log(`Using category default image for ${category}`);
    return categoryImages[category];
  } catch (error) {
    console.error(`❌ Error getting image for ${commonName}:`, error);
    // Final fallback image if all else fails
    return "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/No-Image-Placeholder.svg/800px-No-Image-Placeholder.svg.png";
  }
}

// Generate a unique, accurate description for each plant
function generateDescription(commonName, latinName) {
  // Check if we have a specific description for this plant
  if (plantDescriptions[commonName]) {
    return plantDescriptions[commonName];
  }
  
  // Check for partial matches in the descriptions
  for (const [key, description] of Object.entries(plantDescriptions)) {
    // Check if the key is part of the common name (case insensitive)
    if (commonName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(commonName.toLowerCase())) {
      return description;
    }
    
    // If we have a Latin name, check that too
    if (latinName && (latinName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(latinName.toLowerCase()))) {
      return description;
    }
  }
  
  // No specific description found, generate a generic but informative one
  // based on the plant category and name
  const category = getPlantCategory(commonName, latinName);
  let genericDescription = '';
  
  switch (category) {
    case 'native-plants':
      genericDescription = `${commonName} (${latinName}) is a valuable native plant that supports local ecosystems and wildlife. This adaptable perennial adds natural beauty to gardens while requiring minimal maintenance once established. Perfect for naturalized areas, rain gardens, and native plant landscapes.`;
      break;
    case 'medicinal-herbs':
      genericDescription = `${commonName} (${latinName}) is a versatile medicinal herb with a long history of traditional use. Its healing properties make it valuable for herbal preparations, while its attractive appearance adds beauty to garden spaces. This resilient plant grows well in herb gardens, sunny borders, and naturalized settings.`;
      break;
    case 'pollinator-friendly':
      genericDescription = `${commonName} (${latinName}) is a pollinator magnet, attracting bees, butterflies, and other beneficial insects to the garden. Its nectar-rich flowers provide essential resources for wildlife while adding vibrant color to the landscape. Ideal for butterfly gardens, meadow plantings, and eco-friendly landscapes.`;
      break;
    case 'culinary-herbs':
      genericDescription = `${commonName} (${latinName}) is a flavorful culinary herb that enhances a variety of dishes with its distinctive taste. Easy to grow in gardens or containers, it offers both practical and ornamental value. This versatile herb thrives in well-drained soil and sunny locations, perfect for kitchen gardens, raised beds, or mixed borders.`;
      break;
    default:
      genericDescription = `${commonName} (${latinName}) is a wonderful addition to any garden, offering beautiful blooms and ecological benefits. This adaptable plant attracts beneficial wildlife while adding visual interest to the landscape. Incorporate it into perennial borders, naturalized areas, or themed garden spaces for best effect.`;
  }
  
  return genericDescription;
}

// Seed database with plants from CSV
async function seedPlants() {
  console.log('Starting to seed plants from the CSV file with enhanced images and descriptions...');
  
  try {
    // Add categories first
    for (const category of plantCategories) {
      try {
        const categoryData = {
          name: category.name,
          slug: category.slug,
          description: category.description,
          image: category.image
        };
        
        const docRef = await addDoc(collection(db, 'categories'), categoryData);
        console.log(`Added category: ${category.name} with ID: ${docRef.id}`);
        
        // Add a small delay between writes to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error adding category ${category.name}:`, error);
      }
    }
    
    // Process the CSV file
    const plantData = [];
    const csvPath = path.join(__dirname, '..', 'plant pages', '2025 Hearthfire Plant List - Sheet1.csv');
    
    console.log('Looking for CSV file at:', csvPath);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }
    
    // Read the CSV file and process each plant
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
            const imageUrl = await getImageForPlant(commonName, latinName);
            
            // Get plant category
            const category = getPlantCategory(commonName, latinName);
            
            // Generate a unique description
            const description = generateDescription(commonName, latinName);
            
            // Create product data
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
            
            // Add product to Firestore
            const docRef = await addDoc(collection(db, 'products'), productData);
            console.log(`Added plant: ${commonName} with ID: ${docRef.id}`);
            console.log(`- Image: ${imageUrl.substring(0, 60)}...`);
            console.log(`- Category: ${category}`);
            
            // Add a delay between writes to avoid overwhelming Firestore
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Error processing plant:`, error);
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