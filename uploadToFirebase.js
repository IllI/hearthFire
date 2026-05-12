const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Use the service account key from environment variable
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin initialized with service account credentials');
      } catch (parseError) {
        console.error('Error parsing service account key:', parseError);
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms'
        });
        console.log('Firebase Admin initialized with application default credentials');
      }
    } else {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hearthfire-farms'
      });
      console.log('Firebase Admin initialized with application default credentials');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const productsRef = db.collection('products');

// Add cache for images
const imageCache = new Map();

// Rate limiting state for each API independently
let lastBraveApiCall = 0;
let lastUnsplashApiCall = 0;
const MIN_API_INTERVAL = 1500;  // 1.5 seconds to be safe
const BRAVE_RATE_LIMIT_DELAY = 60000;  // 1 minute when Brave is rate limited
const UNSPLASH_RATE_LIMIT_DELAY = 3600000;  // 1 hour when Unsplash is rate limited (403)

// Keep track of which API was rate limited last
let braveRateLimited = false;
let unsplashRateLimited = false;

// Track when we need to request an IP change
let ipChangeNeeded = false;

// Add delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Import the Wix CDN URLs 
const wixImageUrls = require('./wixImageUrls');

// At the beginning of your file, add:
let braveRateLimitBackoff = 5000; // Start with 5 seconds

// Function to get optimal search terms including Latin names
function getOptimalSearchTerms(commonName, latinName) {
  const searchTerms = [];
  
  // Use very specific terms for better image matching
  searchTerms.push(`${commonName} plant photo`);
  
  if (latinName) {
    // Latin names often get very accurate results
    searchTerms.push(`${latinName} plant photo`);
  }
  
  // The plain common name as a backup
  searchTerms.push(commonName);
  
  // Add more descriptive terms for better context
  searchTerms.push(`${commonName} flower garden`);
  
  return searchTerms;
}

// Function to search for images using Brave Search API
async function searchBraveImages(query) {
  // Check cache first
  const cacheKey = `brave:${query}`;
  if (imageCache.has(cacheKey)) {
    console.log(`Using cached Brave image for "${query}"`);
    return imageCache.get(cacheKey);
  }

  const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
  
  if (!BRAVE_API_KEY) {
    console.error('Missing Brave API key in environment variables');
    return null;
  }

  try {
    // Ensure minimum time between API calls
    const now = Date.now();
    const timeSinceLastCall = now - lastBraveApiCall;
    if (timeSinceLastCall < MIN_API_INTERVAL) {
      const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
      console.log(`Waiting ${Math.ceil(waitTime/1000)} seconds before next Brave request...`);
      await delay(waitTime);
    }
    
    console.log(`Searching Brave API for: "${query}"`);
    lastBraveApiCall = Date.now();
    
    // Use the official Brave Search API 
    const searchQuery = encodeURIComponent(query);
    const response = await axios({
      method: 'get',
      url: `https://api.search.brave.com/res/v1/images/search?q=${searchQuery}&safesearch=strict&count=5`,
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      },
      timeout: 10000
    });
    
    if (response.status === 200 && response.data && response.data.results && response.data.results.length > 0) {
      console.log("Sample result structure:", JSON.stringify(response.data.results[0], null, 2));
      
      // Filter out stock photo sites, select only high-quality images
      const filteredResults = response.data.results.filter(result => 
        !result.url.includes('shutterstock') && 
        !result.url.includes('istockphoto') && 
        !result.url.includes('alamy') && 
        !result.url.includes('gettyimages') &&
        !result.url.includes('dreamstime') &&
        !result.url.includes('123rf')
      );
      
      if (filteredResults.length > 0) {
        // Modified code - extract string URL
        const selectedImage = filteredResults[0].properties?.url || 
                              (filteredResults[0].thumbnail ? filteredResults[0].thumbnail.src : null) ||
                              filteredResults[0].url || null;
        
        console.log(`✅ Found Brave image for "${query}": ${selectedImage}`);
        imageCache.set(cacheKey, selectedImage);
        return selectedImage;
      }
    }
  } catch (error) {
    console.log(`⚠️ Brave search API error for "${query}": ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Message: ${JSON.stringify(error.response.data)}`);
      
      // Add exponential backoff for rate limit errors
      if (error.response.status === 429) {
        console.log(`Rate limited! Waiting ${braveRateLimitBackoff/1000} seconds before trying again...`);
        await delay(braveRateLimitBackoff);
        braveRateLimitBackoff = Math.min(braveRateLimitBackoff * 2, 30000); // Double each time, max 30 seconds
      }
    }
  }
  
  return null;
}

// Function to search for images on Unsplash
async function searchUnsplashImages(query) {
  // Skip Unsplash if it was recently rate limited
  if (unsplashRateLimited) {
    console.log('Skipping Unsplash API due to recent rate limit');
    return null;
  }

  // Check cache first
  if (imageCache.has(`unsplash:${query}`)) {
    console.log(`Using cached Unsplash image for "${query}"`);
    return imageCache.get(`unsplash:${query}`);
  }

  if (!process.env.UNSPLASH_ACCESS_KEY) {
    console.warn('No Unsplash access key found. Using fallback image instead.');
    return null;
  }

  try {
    // Ensure minimum time between API calls
    const now = Date.now();
    const timeSinceLastCall = now - lastUnsplashApiCall;
    if (timeSinceLastCall < MIN_API_INTERVAL) {
      const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
      console.log(`Waiting ${Math.ceil(waitTime/1000)} seconds before next Unsplash request...`);
      await delay(waitTime);
    }
    
    console.log(`Trying Unsplash search query: "${query}"...`);
    lastUnsplashApiCall = Date.now();
    
    const response = await axios({
      method: 'get',
      url: 'https://api.unsplash.com/search/photos',
      headers: {
        'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
      },
      params: {
        query: query,
        per_page: 10,
        content_filter: 'high',
        orientation: 'landscape'
      },
      timeout: 10000
    });

    // Reset rate limited flag on successful response
    unsplashRateLimited = false;

    if (response.data && response.data.results && response.data.results.length > 0) {
      // Look through results to find a good match - check alt description and description for relevance
      const filteredResults = response.data.results.filter(result => {
        const description = (result.description || '').toLowerCase();
        const altDescription = (result.alt_description || '').toLowerCase();
        const tags = result.tags || [];
        const lowerQuery = query.toLowerCase();
        
        // Check if any part of the query appears in description or alt text
        const queryParts = lowerQuery.split(' ');
        const matchesDescription = queryParts.some(part => 
          description.includes(part) || altDescription.includes(part)
        );
        
        // Check if any tags match parts of our query
        const matchesTags = tags.some(tag => {
          const tagName = (tag.title || '').toLowerCase();
          return queryParts.some(part => tagName.includes(part));
        });
        
        return matchesDescription || matchesTags;
      });
      
      // Use filtered results if available, otherwise use the first result
      const bestResult = filteredResults.length > 0 ? filteredResults[0] : response.data.results[0];
      const imageUrl = bestResult.urls.regular;
      
      console.log(`Found valid image URL from Unsplash: ${imageUrl}`);
      
      // Cache the result
      imageCache.set(`unsplash:${query}`, imageUrl);
      return imageUrl;
    } else {
      console.log('No results found from Unsplash API');
    }
  } catch (error) {
    if (error.response) {
      console.error(`Unsplash API error (${error.response.status}):`, error.response.data || error.message);
      
      if (error.response.status === 429 || error.response.status === 403) {
        // Mark Unsplash as rate limited for an hour
        unsplashRateLimited = true;
        setTimeout(() => { unsplashRateLimited = false; }, UNSPLASH_RATE_LIMIT_DELAY);
      }
    } else {
      console.error(`Error searching Unsplash for "${query}":`, error.message);
    }
  }
  
  // If we get here, return null to use category fallback
  return null;
}

// Helper function to get the direct image URL from Wikimedia Commons API
async function getWikimediaImageUrl(filename) {
  const cacheKey = `wikimedia:${filename}`;
  if (imageCache.has(cacheKey)) {
    const cachedUrl = imageCache.get(cacheKey);
    // Return cached URL only if it's not null (i.e., not a cached failure)
    if (cachedUrl) {
      console.log(`Using cached Wikimedia URL for ${filename}`);
      return cachedUrl;
    } else {
      console.log(`Using cached failure for ${filename}, skipping API call.`);
      return null;
    }
  }

  try {
    // --- FIX: Encode the filename before using it in the URL --- 
    const encodedFilename = encodeURIComponent(filename);
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodedFilename}&prop=imageinfo&iiprop=url&format=json&origin=*`;
    // --------------------------------------------------------
    
    console.log(`Querying Wikimedia API for direct URL of: File:${filename}`); // Log original filename
    
    const response = await axios.get(apiUrl, { timeout: 15000 }); // Added timeout

    if (response.data.query && response.data.query.pages) {
      const pages = response.data.query.pages;
      const pageId = Object.keys(pages)[0];

      if (pageId !== '-1' && pages[pageId].imageinfo && pages[pageId].imageinfo.length > 0) {
        const imageUrl = pages[pageId].imageinfo[0].url;
        console.log(`✅ Found Wikimedia direct URL: ${imageUrl}`);
        imageCache.set(cacheKey, imageUrl); // Cache the success
        return imageUrl;
      } else {
        // File genuinely not found or lacks image info
        console.log(`⚠️ File ${filename} not found or has no imageinfo on Wikimedia Commons.`);
      }
    } else {
      // Unexpected API response format
      console.log(`⚠️ Unexpected API response structure for ${filename}.`);
    }

  } catch (error) {
    console.error(`❌ Error fetching Wikimedia URL for ${filename}:`, error.message);
     if (error.response) {
        // Log details if available
        console.error('API Response Status:', error.response.status);
        // Avoid logging potentially huge data responses
        // console.error('API Response Data:', error.response.data); 
     }
  }

  // Explicitly cache the failure (null) before returning
  console.log(`Caching failure for ${filename}`);
  imageCache.set(cacheKey, null);
  return null;
}

// Function to determine plant category based on name
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
                'peppermint', 'spearmint', 'rosemary', 'basil', 'cilantro', 'parsley', 'dill']
    },
    // Pollinator friendly
    {
      category: 'pollinator-friendly',
      matches: ['bee balm', 'monarda', 'milkweed', 'asclepias', 'butterfly', 'coneflower',
                'sunflower', 'aster', 'vervain', 'bergamot', 'indigo', 'ironweed', 'joe pye',
                'cardinal', 'lobelia', 'royal catchfly', 'silene', 'passionflower', 'coreopsis',
                'mistflower', 'swamp marigold', 'bush clover', 'woodmint']
    },
     // Vegetables should be identified more broadly
    {
        category: 'vegetables',
        matches: ['tomato', 'pepper', 'broccoli', 'cabbage', 'kale', 'collards', 'lettuce', 'spinach', 'beets', 'pac choi', 'broccolini']
    }
  ];

  // Check for category matches
  for (const rule of categoryRules) {
    const isMatch = rule.matches.some(match =>
      normalizedCommonName.includes(match) || (normalizedLatinName && normalizedLatinName.includes(match))
    );

    if (isMatch) {
      return rule.category;
    }
  }

  // Default to native plants if no specific category matches
   console.log(`Defaulting to 'native-plants' category for ${commonName}`);
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
      description += 'valuable native plant that supports local ecosystems and wildlife. This adaptable perennial adds natural beauty to gardens while requiring minimal maintenance once established.';
      break;
    case 'medicinal-herbs':
      description += 'versatile medicinal herb with a long history of traditional use. Its healing properties make it valuable for herbal preparations, while its attractive appearance adds beauty to garden spaces.';
      break;
    case 'pollinator-friendly':
      description += 'pollinator magnet, attracting bees, butterflies, and other beneficial insects to the garden. Its nectar-rich flowers provide essential resources for wildlife while adding vibrant color to the landscape.';
      break;
    case 'culinary-herbs':
      description += 'flavorful culinary herb that enhances a variety of dishes with its distinctive taste. Easy to grow in gardens or containers, it offers both practical and ornamental value.';
      break;
    case 'vegetables':
       description += 'popular vegetable choice, perfect for home gardens. Easy to grow and nutritious, it provides fresh produce for various culinary uses.';
       break;
    default:
      description += 'wonderful addition to any garden, offering beautiful blooms and ecological benefits. This adaptable plant attracts beneficial wildlife while adding visual interest to the landscape.';
  }

  return description;
}

// Use a reliable, scientific source for plant images
const PLANT_IMAGE_BASE = 'https://plants.sc.egov.usda.gov/ImageLibrary/standard/';

// Replace the existing plantImageMap with one that uses verified direct URLs
const plantImageMap = {
  // Pollinators and Native Plants
  'yarrow': 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Achillea_millefolium_inflorescence.jpg',
  'anise hyssop': 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Agastache_foeniculum_Northern_Plains_2.jpg',
  'milkweed, poke': 'https://upload.wikimedia.org/wikipedia/commons/7/76/Asclepias_exaltata_1.jpg',
  'milkweed, rose': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Asclepias_incarnata_flower.jpg',
  'milkweed, butterfly': 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Asclepias_tuberosa_2017-06-15_3583.jpg',
  'milkweed, whorled': 'https://upload.wikimedia.org/wikipedia/commons/c/c2/Asclepias_verticillata_%2814956276351%29.jpg',
  'blue wild indigo': 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Baptisia_australis_kz02.jpg',
  'indigo wild cream': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Baptisia_bracteata.jpg',
  'dwarf blue indigo': 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Baptisia_australis_var._minor_%2743449436602%27.jpg',
  'swamp marigold': 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Bidens-aristosa-flower.jpg',
  'downy woodmint': 'https://upload.wikimedia.org/wikipedia/commons/6/65/Blephilia_ciliata_by_Jeff_Pippen.jpg',
  'river oats': 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Chasmanthium_latifolium_-_j.f._rock.jpg',
  'mistflower': 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Conoclinium_coelestinum_-_Blue_Mistflower.jpg',
  'coreopsis, lanceleaf': 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Coreopsis_lanceolata.jpg',
  'echinacea': 'https://upload.wikimedia.org/wikipedia/commons/4/48/Echinacea_purpurea_Magnus_a1.jpg',
  'rattlesnake master': 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Eryngium_yuccifolium_UMFS_1.jpg',
  'boneset': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Eupatorium_perfoliatum_-_Boneset.jpg',
  'joe pye weed, little': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Eutrochium_dubium_Little_Joe.jpg',
  'joe pye weed, hollow': 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Eutrochium_fistulosum_-_Hollow_Joe-Pye_Weed.jpg',
  'joe pye weed': 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Eutrochium_fistulosum_-_Hollow_Joe-Pye_Weed.jpg',
  'joe pye weed, sweet': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Eutrochium_purpureum_11zz.jpg',
  'sunflower, woodland': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Helianthus_divaricatus_flower.jpg',
  'sunflower, western': 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Helianthus_occidentalis_-_Franklin_County%2C_Ohio%2C_USA_-_August_29%2C_2011.jpg',
  'rose mallow': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Hibiscus_moscheutos_%27Southern_Belle%27_White_Flower_2000px.jpg',
  'hibiscus': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Hibiscus_sabdariffa_2.jpg',
  'st. johns wort, dotted': 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Hypericum_punctatum_Gucker.jpg',
  'elecampane': 'https://upload.wikimedia.org/wikipedia/commons/8/84/Inula_helenium_MdE_6.jpg',
  'round headed bush clover': 'https://upload.wikimedia.org/wikipedia/commons/2/21/Roundhead_Lespedeza_-_Lespedeza_capitata_%287989259674%29.jpg',
  'cardinal flower': 'https://upload.wikimedia.org/wikipedia/commons/9/93/Lobelia_cardinalis_Great_Blue_Lobelia_Wild_Pink_Impatiens_2000px.jpg',
  'peppermint': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Mentha_%C3%97_piperita_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-091.jpg',
  'spearmint': 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Mentha_spicata_-_spearmint_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-092.jpg',
  'monarda, bee balm': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Monarda_didyma_-_Beebalm.jpg',
  'monarda, wild bergamot': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Monarda_fistulosa_Oswego_Tea_Wild_Bergamot_2000px.jpg',
  'spotted bee balm': 'https://upload.wikimedia.org/wikipedia/commons/4/44/Spotted_beebalm%2C_Monarda_punctata.jpg',
  'catnip': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Nepeta_cataria_catnip.jpg',
  'holy basil, tulsi': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Ocimum_tenuiflorum_tulsi.jpg',
  'marjoram': 'https://upload.wikimedia.org/wikipedia/commons/6/68/Origanum_majorana_20210423.jpg',
  'oregano': 'https://upload.wikimedia.org/wikipedia/commons/1/13/Origanum_vulgare_-_oregano_-_Echter_Dost_-_Wilder_Majoran_3.jpg',
  'passionflower': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Passiflora_incarnata_Maypop_1.jpg',
  'mtn. mint, clustered': 'https://upload.wikimedia.org/wikipedia/commons/5/57/Pycnanthemum_muticum_03.jpg',
  'mtn. mint, slender': 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Pycnanthemum-tenuifolium-flower.jpg',
  'mtn. mint, hairy': 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Pycnanthemum_verticillatum_var._pilosum.jpg',
  'mtn mint': 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Pycnanthemum_virginianum_-_Virginia_Mountain_Mint.jpg',
  'grey headed coneflower': 'https://upload.wikimedia.org/wikipedia/commons/5/52/Ratibida_pinnata_-_Yellow_Coneflower.jpg',
  'rosemary': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Rosmarinus_officinalis0.jpg',
  'orange coneflower': 'https://upload.wikimedia.org/wikipedia/commons/2/23/Rudbeckia_fulgida_Goldstrum_kz01.jpg',
  'black eyed susan': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Rudbeckia_hirta_Black-Eyed_Susan.jpg',
  'cutleaf coneflower': 'https://upload.wikimedia.org/wikipedia/commons/5/51/Rudbeckia_laciniata_-_cutleaf_coneflower_9-1-2005.jpg',
  'sweet black eyed susan': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Rudbeckia_subtomentosa_Sweet_Coneflower_Flower_Closeup_2000px.jpg',
  'brown eyed susan': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Rudbeckia_triloba_-_Three-lobed_Coneflower.jpg',
  'blue sage': 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Salvia_azurea_GotBot_2015_001.jpg',
  'blue salvia': 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Salvia_azurea_GotBot_2015_001.jpg',
  'pink salvia': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Salvia_coccinea.jpg',
  'sage': 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Thymus_vulgaris_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-267.jpg',
  'little blue stem': 'https://upload.wikimedia.org/wikipedia/commons/8/80/Little_bluestem_Schizachyrium_scoparium_Plant_2000px.jpg',
  'skullcap, hoary': 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Scutellaria_incana_2015-07-09_0021.jpg',
  'skullcap, mad dog': 'https://upload.wikimedia.org/wikipedia/commons/5/50/Scutellaria_lateriflora_Mad-dog_Skullcap_2000px.jpg',
  'royal catchfly': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Royal_catchfly_close_800px.jpg',
  'calico aster': 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Symphyotrichum_lateriflorum.jpg',
  'frost aster': 'https://upload.wikimedia.org/wikipedia/commons/5/51/Symphyotrichum_pilosum.jpg',
  'shorts aster': 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Symphyotrichum_shortii.jpg',
  'thyme': 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Thymus_vulgaris_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-267.jpg',
  'nasturtium': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Tropaeolum_majus_Flame_Flower_2000px.jpg',
  'stinging nettle': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Urtica_dioica1.jpg',
  'valerian': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Valeriana_officinalis_01.jpg',
  'blue vervain': 'https://upload.wikimedia.org/wikipedia/commons/0/03/Blue_Vervain_Verbena_hastata_Flower_2000px.jpg',
  'common ironweed': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Vernonia_fasciculata_Missouri_Ironweed.jpg',
  'ironweed, missouri': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Vernonia_fasciculata_Missouri_Ironweed.jpg',

  // Herbs
  'chamomile': 'https://upload.wikimedia.org/wikipedia/commons/2/22/Matricaria_chamomilla_2015.jpg',
  'calendula': 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Calendula_May_2010-1.jpg',
  'borage': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Borago_officinalis_001.jpg',
  'cilantro': 'https://upload.wikimedia.org/wikipedia/commons/5/51/Coriander_leaves.jpg',
  'dill': 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Anethum_graveolens_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-009.jpg',
  'parsley': 'https://upload.wikimedia.org/wikipedia/commons/0/09/Petroselinum_crispum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-213.jpg',

  // Vegetables
  'tomato': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Tomato_je.jpg',
  'tomato (brandywine)': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Brandywine_Tomatoes.jpg',
  'tomato (cherokee purple)': 'https://upload.wikimedia.org/wikipedia/commons/3/31/Cherokee_Purple_tomatoes.jpg',
  'tomato (black krim)': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Black_Krim_Tomato.JPG',
  'pepper': 'https://upload.wikimedia.org/wikipedia/commons/d/da/Bell_pepper.jpg',
  'jalapeno pepper': 'https://upload.wikimedia.org/wikipedia/commons/9/94/Jalapeno_pepper_-_Studio_shot.jpg',
  'bell pepper': 'https://upload.wikimedia.org/wikipedia/commons/8/86/Bell_pepper_overview_edit1.jpg',
  'broccoli': 'https://upload.wikimedia.org/wikipedia/commons/0/03/Broccoli_in_a_dish_1.jpg',
  'broccolini': 'https://upload.wikimedia.org/wikipedia/commons/3/33/Broccolini_bunches.JPG',
  'cabbage': 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Red_cabbage_and_white_cabbage.jpg',
  'napa cabbage': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Napa_cabbage.jpg',
  'kale': 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Kale-Bundle.jpg',
  'collards': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Collard-Greens-Bundle.jpg',
  'lettuce': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Romaine_lettuce_salad.jpg',
  'spinach': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Spinach-Bundle.jpg',
  'beets': 'https://upload.wikimedia.org/wikipedia/commons/3/32/Beets_%282336632162%29.jpg',
  'beets (chiogga)': 'https://upload.wikimedia.org/wikipedia/commons/7/74/Chioggia_beets.jpg',
  'beets (golden)': 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Golden_Beets.jpg',
  'pac choi': 'https://upload.wikimedia.org/wikipedia/commons/c/c2/Bok_choy_for_sale.jpg',
};

// Update categoryImages to also use direct URLs
const categoryImages = {
  'medicinal-herbs': 'https://upload.wikimedia.org/wikipedia/commons/4/48/Echinacea_purpurea_Magnus_a1.jpg', 
  'culinary-herbs': 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Thymus_vulgaris_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-267.jpg',
  'pollinator-friendly': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Rudbeckia_hirta_Black-Eyed_Susan.jpg',
  'vegetables': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Tomato_je.jpg',
  'native-plants': 'https://upload.wikimedia.org/wikipedia/commons/8/80/Little_bluestem_Schizachyrium_scoparium_Plant_2000px.jpg'
};

// Function to find the best image for a plant
async function findBestImage(commonName, latinName) {
  console.log(`Finding image for: ${commonName} (${latinName || 'No Latin name'})`);
  
  // Create optimal search terms for better results
  const searchTerms = getOptimalSearchTerms(commonName, latinName);
  let imageUrl = null;
  let source = '';
  
  // Try each search term with Brave API until we find an image
  for (const term of searchTerms) {
    imageUrl = await searchBraveImages(term);
    if (imageUrl) {
      source = `brave-api:${term}`;
      break;
    }
  }
  
  // If Brave API failed to find an image, try Unsplash as backup
  if (!imageUrl) {
    console.log(`No Brave API results for ${commonName}, trying Unsplash...`);
    imageUrl = await searchUnsplashImages(commonName + ' plant');
    if (imageUrl) {
      source = 'unsplash-api';
    }
  }
  
  // If both APIs failed, use category fallback
  if (!imageUrl) {
    const category = getPlantCategory(commonName, latinName);
    console.log(`Using category fallback for ${commonName} (category: ${category})`);
    
    // Try to get a category image from Brave
    imageUrl = await searchBraveImages(`${category} plants`);
    source = `category-fallback:${category}`;
    
    // If that fails too, use a generic plant image
    if (!imageUrl) {
      imageUrl = await searchBraveImages('garden plant');
      source = 'generic-fallback';
    }
  }
  
  return { url: imageUrl, source: source };
}

async function uploadProducts() {
  console.log('Starting to upload products to Firebase...');

  const results = [];
  const csvPath = path.join(process.cwd(), 'plant pages', '2025 Hearthfire Plant List - Sheet1.csv');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }

  // Validate image map keys (optional, good practice)
  console.log('Validating image map keys...');
  const uniqueFilenames = new Set(Object.values(plantImageMap));
  console.log(`Plant image map contains ${Object.keys(plantImageMap).length} entries with ${uniqueFilenames.size} unique filenames.`);


  // FIRST: Clear out existing products before starting the upload process
  try {
    console.log('\n==== CLEARING DATABASE ====');
    console.log('Deleting all existing products from Firebase...');
    const snapshot = await productsRef.get();
    console.log(`Found ${snapshot.docs.length} existing products to delete.`);

    if (snapshot.docs.length > 0) {
      // Delete in batches to avoid timeouts
      const batchSize = 50;
      const batches = [];

      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const docs = snapshot.docs.slice(i, i + batchSize);
        docs.forEach(doc => batch.delete(doc.ref));
        batches.push(batch.commit());
      }

      await Promise.all(batches);
      console.log(`✅ Successfully deleted ${snapshot.docs.length} existing products`);
    } else {
      console.log('No existing products to delete.');
    }
  } catch (error) {
    console.error('❌ Error clearing existing products:', error);
    throw new Error('Failed to clear database. Upload aborted.');
  }

  console.log('\n==== STARTING UPLOAD PROCESS ====');

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let successCount = 0;
          let skipCount = 0;
          let apiDirectCount = 0;
          let apiWordCount = 0;
          let apiTermCount = 0;
          let fallbackApiFailedCount = 0;
          let fallbackNoMatchCount = 0;
          let placeholderCount = 0;


          console.log(`Processing ${results.length} products from CSV...`);

          // Process each plant in the CSV
          for (const plant of results) {
            const commonName = plant['Common Name'];
            const latinName = plant['Latin Name'];

            if (!commonName) {
              console.log('Skipping plant with no common name');
              skipCount++;
              continue;
            }

            console.log(`\n==== Processing: ${commonName} (${latinName || 'No Latin name'}) ====`);

            // Find the best image for this plant using the updated function
            const { url: finalImageUrl, source: imageSource } = await findBestImage(commonName, latinName);

             // Track image source counts
             switch (imageSource) {
                case 'direct-match': apiDirectCount++; break;
                case 'word-match': apiWordCount++; break;
                case 'term-match': apiTermCount++; break;
                case 'category-fallback': fallbackNoMatchCount++; break;
            }


            console.log(`Using image for ${commonName}: ${finalImageUrl} (Source: ${imageSource})`);

            // Generate description if not provided
            const description = plant['Description'] || generateDescription(commonName, latinName);

            // Create product data
            const productData = {
              name: commonName,
              latinName: latinName || '',
              description: description,
              price: 9.99, // Assuming default price
              image: finalImageUrl, // Use the fetched URL
              images: [finalImageUrl], // Use the fetched URL in the array too
              imageSource: imageSource, // Track how the image was found
              quantity: plant['Quantity'] ? parseInt(plant['Quantity']) : 0,
              category: getPlantCategory(commonName, latinName),
              featured: false,
              unit: 'each', // Assuming default unit
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            try {
              const docRef = await productsRef.add(productData);
              console.log(`✅ Added ${commonName} with ID: ${docRef.id}`);
              successCount++;

              // Optional delay to prevent hitting API rate limits aggressively if many fallbacks occur
               await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay


            } catch (error) {
              console.error(`❌ Failed to add ${commonName}:`, error);
              skipCount++;
            }
          }

          console.log(`\n=== Upload Summary ===`);
          console.log(`Total products processed: ${results.length}`);
          console.log(`Successfully uploaded: ${successCount}`);
          console.log(`Skipped/failed: ${skipCount}`);
          console.log(`--- Image Source Breakdown ---`);
          console.log(`API Direct Match: ${apiDirectCount}`);
          console.log(`API Word Match: ${apiWordCount}`);
          console.log(`API Term Match: ${apiTermCount}`);
          console.log(`Fallback (No Match): ${fallbackNoMatchCount}`);
          console.log(`Fallback (API Failed): ${fallbackApiFailedCount}`);
          console.log(`Placeholder (Critical Failure): ${placeholderCount}`);


          resolve();
        } catch (error) {
          console.error('Error during upload process:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('Error reading CSV:', error);
        reject(error);
      });
  });
}

// Run the upload
uploadProducts()
  .then(() => console.log('✅ Upload completed successfully!'))
  .catch(error => {
    console.error('❌ Error during upload:', error);
    process.exit(1);
  }); 