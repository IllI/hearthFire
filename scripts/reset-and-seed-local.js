/**
 * Reset Database and Run Enhanced Local Plant Seeder
 * 
 * This script clears the database and runs the enhanced local plant seeder.
 * It also organizes images and generates a list of plants needing images.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { organizeImages } = require('./organize-local-images');
const { generateImageList } = require('./generate-image-list');

console.log('Starting database reset and local plant seeding process...');

// Clear the database
try {
  console.log('Clearing database collections...');
  execSync('node clear-data.js', { stdio: 'inherit' });
  console.log('Database cleared successfully.');
} catch (error) {
  console.error('Error clearing database:', error.message);
  process.exit(1);
}

// Organize images
try {
  console.log('\nOrganizing local plant images...');
  organizeImages();
  console.log('Images organized successfully.');
} catch (error) {
  console.error('Error organizing images:', error.message);
  // Continue even if image organization fails
}

// Run the enhanced local plant seeder
try {
  console.log('\nRunning enhanced local plant seeder...');
  execSync('node enhanced-local-plant-seeder.js', { stdio: 'inherit' });
  console.log('Plants seeded successfully.');
} catch (error) {
  console.error('Error seeding plants:', error.message);
  process.exit(1);
}

// Generate the image list for any plants needing images
try {
  console.log('\nGenerating list of plants needing images...');
  generateImageList();
  
  // Check if the image list file exists and has content
  const imageListPath = path.join(__dirname, 'plants-needing-images.txt');
  if (fs.existsSync(imageListPath)) {
    console.log('\nPlants needing images list generated successfully.');
    console.log(`You can find the list at: ${imageListPath}`);
    console.log('Follow the instructions in the file to generate and save images using Microsoft Image Creator.');
  }
} catch (error) {
  console.error('Error generating image list:', error.message);
  // Continue even if image list generation fails
}

console.log('\nDatabase reset and seed process complete!');
console.log('To view the products page, run: cd .. && npm run dev');
console.log('Then visit: http://localhost:3000/products'); 