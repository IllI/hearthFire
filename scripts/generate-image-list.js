/**
 * Generate Image List
 * 
 * This script generates a list of plants that need images, along with
 * optimized prompts for generating them using free AI image generators.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

// Define paths
const PLANT_PAGES_DIR = path.join(__dirname, '..', 'plant pages');
const PUBLIC_IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'plants');
const OUTPUT_FILE = path.join(__dirname, 'plants-needing-images.txt');

// Function to normalize plant names
function normalizePlantName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .trim();                   // Trim whitespace
}

// Function to check if a local image exists for a plant
function hasLocalImage(plantName) {
  const normalizedName = normalizePlantName(plantName);
  const potentialImagePath = path.join(PUBLIC_IMAGES_DIR, normalizedName);
  
  // If directory doesn't exist or is empty, consider it as no image
  if (!fs.existsSync(potentialImagePath)) {
    return false;
  }
  
  const files = fs.readdirSync(potentialImagePath);
  return files.length > 0;
}

// Function to generate an ideal prompt for AI image generation
function generateImagePrompt(commonName, latinName) {
  return `A detailed, high-resolution photograph of ${commonName} (${latinName}), showing the whole plant with flowers and foliage in natural sunlight against a blurred garden background. The image should be clear, realistic, and showcase the plant's distinctive features.`;
}

// Main function to generate the list
async function generateImageList() {
  console.log('Generating list of plants needing images...');
  
  try {
    // Ensure public images directory exists
    if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
      fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
    }
    
    // Process the CSV file
    const plantData = [];
    const csvPath = path.join(__dirname, '..', 'plant pages', '2025 Hearthfire Plant List - Sheet1.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }
    
    // Read the CSV file
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => {
        plantData.push(data);
      })
      .on('end', async () => {
        console.log(`CSV file processed, found ${plantData.length} plants.`);
        
        // Check which plants need images
        const plantsNeedingImages = [];
        
        for (const plant of plantData) {
          const commonName = plant['Common Name'] || '';
          const latinName = plant['Latin Name'] || '';
          
          if (!commonName) continue;
          
          // Check if plant already has a local image
          if (!hasLocalImage(commonName)) {
            plantsNeedingImages.push({
              commonName,
              latinName,
              prompt: generateImagePrompt(commonName, latinName)
            });
          }
        }
        
        console.log(`Found ${plantsNeedingImages.length} plants needing images.`);
        
        // Generate the output file
        let outputContent = `# Plants Needing Images (${plantsNeedingImages.length} total)\n\n`;
        outputContent += `This file contains a list of plants that need images, along with suggested prompts\n`;
        outputContent += `for generating them using free AI image generators like Microsoft Image Creator.\n\n`;
        outputContent += `## How to use Microsoft Image Creator:\n`;
        outputContent += `1. Visit https://copilot.microsoft.com/images/creator\n`;
        outputContent += `2. Sign in with your Microsoft account (free)\n`;
        outputContent += `3. Copy one of the prompts below and paste it into the prompt field\n`;
        outputContent += `4. Generate the image and download it\n`;
        outputContent += `5. Save the image to public/images/plants/[plant-name]/[plant-name].jpg\n\n`;
        outputContent += `## Plants and Prompts:\n\n`;
        
        for (let i = 0; i < plantsNeedingImages.length; i++) {
          const plant = plantsNeedingImages[i];
          const normalizedName = normalizePlantName(plant.commonName);
          
          outputContent += `### ${i+1}. ${plant.commonName} (${plant.latinName})\n`;
          outputContent += `Normalized name: ${normalizedName}\n`;
          outputContent += `Save to: public/images/plants/${normalizedName}/${normalizedName}.jpg\n`;
          outputContent += `Prompt:\n\`\`\`\n${plant.prompt}\n\`\`\`\n\n`;
        }
        
        // Write to file
        fs.writeFileSync(OUTPUT_FILE, outputContent);
        
        console.log(`List generated and saved to ${OUTPUT_FILE}`);
        console.log('Follow the instructions in the file to generate and save images.');
      });
  } catch (error) {
    console.error('Error generating image list:', error);
  }
}

// Run the function if script is called directly
if (require.main === module) {
  generateImageList();
} else {
  module.exports = { generateImageList };
} 