/**
 * Organize Local Images
 * 
 * This script finds and organizes all plant images from the plant pages directory,
 * copying them to the public directory for easy access by the web application.
 * 
 * It creates a structured image repository and generates a report of all images found.
 */

const fs = require('fs');
const path = require('path');
const fsPromises = fs.promises;

// Define paths
const PLANT_PAGES_DIR = path.join(__dirname, '..', 'plant pages');
const PUBLIC_IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'plants');
const ORGANIZED_IMAGES_JSON = path.join(__dirname, 'organized-images.json');

// Image extensions to look for
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Function to normalize plant names
function normalizePlantName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .trim();                   // Trim whitespace
}

// Function to check if a file is an image
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

// Function to create directory if it doesn't exist
async function ensureDirExists(dir) {
  try {
    await fsPromises.access(dir);
  } catch (err) {
    await fsPromises.mkdir(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Function to copy a file
async function copyFile(src, dest) {
  try {
    await fsPromises.copyFile(src, dest);
    return true;
  } catch (err) {
    console.error(`Error copying ${src} to ${dest}:`, err);
    return false;
  }
}

// Function to scan a directory for plant images
async function scanForPlantImages(directory) {
  try {
    const items = await fsPromises.readdir(directory, { withFileTypes: true });
    
    let results = [];
    
    for (const item of items) {
      const fullPath = path.join(directory, item.name);
      
      if (item.isDirectory()) {
        // If it's a directory, recursively scan it
        const subDirResults = await scanForPlantImages(fullPath);
        results = results.concat(subDirResults);
      } else if (isImageFile(item.name)) {
        // Extract plant name from directory path
        const pathParts = directory.split(path.sep);
        // Get the last directory name as the plant name
        // (assuming images are in plant-specific directories)
        const plantDirName = pathParts[pathParts.length - 1];
        
        if (plantDirName !== 'plant pages') {
          results.push({
            plantName: plantDirName,
            normalizedName: normalizePlantName(plantDirName),
            imagePath: fullPath,
            fileName: item.name
          });
        }
      }
    }
    
    return results;
  } catch (err) {
    console.error(`Error scanning directory ${directory}:`, err);
    return [];
  }
}

// Main function to organize images
async function organizeImages() {
  console.log('Starting image organization process...');
  
  // Ensure the public images directory exists
  await ensureDirExists(PUBLIC_IMAGES_DIR);
  
  // Scan for all plant images in the plant pages directory
  console.log('Scanning for plant images...');
  const allImages = await scanForPlantImages(PLANT_PAGES_DIR);
  
  console.log(`Found ${allImages.length} plant images.`);
  
  // Organize results by plant
  const organizedImages = {};
  const copyOperations = [];
  
  for (const imageInfo of allImages) {
    const { plantName, normalizedName, imagePath, fileName } = imageInfo;
    
    // Create plant-specific directory in public images
    const plantImagesDir = path.join(PUBLIC_IMAGES_DIR, normalizedName);
    await ensureDirExists(plantImagesDir);
    
    // Determine destination path
    const destPath = path.join(plantImagesDir, fileName);
    
    // Add copy operation to queue
    copyOperations.push({
      plantName,
      normalizedName,
      src: imagePath,
      dest: destPath,
      fileName
    });
    
    // Track in organized images object
    if (!organizedImages[normalizedName]) {
      organizedImages[normalizedName] = {
        plantName,
        normalizedName,
        images: []
      };
    }
    
    // Add relative path for web access
    const webPath = `/images/plants/${normalizedName}/${fileName}`;
    organizedImages[normalizedName].images.push({
      fileName,
      webPath,
      fullPath: destPath
    });
  }
  
  // Execute all copy operations
  console.log(`Copying ${copyOperations.length} images to public directory...`);
  let successCount = 0;
  
  for (const op of copyOperations) {
    const success = await copyFile(op.src, op.dest);
    if (success) successCount++;
    process.stdout.write(`Progress: ${successCount}/${copyOperations.length}\r`);
  }
  
  console.log(`\nSuccessfully copied ${successCount} out of ${copyOperations.length} images.`);
  
  // Save organized images data to JSON file
  console.log('Saving organized images data...');
  await fsPromises.writeFile(
    ORGANIZED_IMAGES_JSON, 
    JSON.stringify(organizedImages, null, 2)
  );
  
  console.log(`Image organization complete! Results saved to ${ORGANIZED_IMAGES_JSON}`);
  console.log(`Images are now available in the public directory: ${PUBLIC_IMAGES_DIR}`);
  
  // Print summary of plants with images
  console.log('\nPlants with local images:');
  Object.keys(organizedImages).sort().forEach(plantKey => {
    const plant = organizedImages[plantKey];
    console.log(`- ${plant.plantName} (${plant.images.length} images)`);
  });
  
  return { 
    totalPlants: Object.keys(organizedImages).length,
    totalImages: successCount,
    organizedImages
  };
}

// If script is run directly, execute the organization process
if (require.main === module) {
  organizeImages()
    .then(result => {
      console.log(`\nOrganization complete! Found images for ${result.totalPlants} plants.`);
    })
    .catch(err => {
      console.error('Error organizing images:', err);
      process.exit(1);
    });
} else {
  // Export for use in other scripts
  module.exports = {
    organizeImages,
    PUBLIC_IMAGES_DIR,
    ORGANIZED_IMAGES_JSON
  };
} 