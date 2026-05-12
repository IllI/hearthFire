/**
 * Download Category Images
 * 
 * This script downloads high-quality images for each plant category
 * to use as fallbacks when specific plant images aren't available.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Define paths
const PUBLIC_IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const CATEGORIES_DIR = path.join(PUBLIC_IMAGES_DIR, 'categories');

// Define category image URLs - high quality, royalty-free images
const CATEGORY_IMAGES = {
  'native-plants': 'https://images.unsplash.com/photo-1530176238587-b53132214c54?q=80&w=1000&auto=format&fit=crop',
  'medicinal-herbs': 'https://images.unsplash.com/photo-1515586000433-45406d8e6662?q=80&w=1000&auto=format&fit=crop',
  'pollinator-friendly': 'https://images.unsplash.com/photo-1559563362-c667ba5f5480?q=80&w=1000&auto=format&fit=crop',
  'culinary-herbs': 'https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?q=80&w=1000&auto=format&fit=crop'
};

// Function to download an image
async function downloadImage(url, filename) {
  try {
    console.log(`Downloading image from ${url}...`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(CATEGORIES_DIR)) {
      fs.mkdirSync(CATEGORIES_DIR, { recursive: true });
      console.log(`Created directory: ${CATEGORIES_DIR}`);
    }
    
    // Generate file path
    const filePath = path.join(CATEGORIES_DIR, filename);
    
    // Download the image
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    
    // Save the image
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Image saved to ${filePath}`);
        resolve(filePath);
      });
      writer.on('error', err => {
        console.error(`Error saving image: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Error downloading image: ${error.message}`);
    throw error;
  }
}

// Main function to download all category images
async function downloadCategoryImages() {
  console.log('Starting category image download...');
  
  try {
    // Download each category image
    for (const [category, url] of Object.entries(CATEGORY_IMAGES)) {
      const filename = `${category}.jpg`;
      await downloadImage(url, filename);
    }
    
    console.log('✅ All category images downloaded successfully!');
  } catch (error) {
    console.error('❌ Error downloading category images:', error);
  }
}

// Run the function
downloadCategoryImages(); 