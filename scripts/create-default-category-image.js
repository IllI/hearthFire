/**
 * Create Default Category Image
 * 
 * This script creates a default category image that will be used as a fallback
 * if any specific category image is not found.
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Define paths
const CATEGORIES_DIR = path.join(__dirname, '..', 'public', 'images', 'categories');

// Create directory if it doesn't exist
if (!fs.existsSync(CATEGORIES_DIR)) {
  fs.mkdirSync(CATEGORIES_DIR, { recursive: true });
  console.log(`Created directory: ${CATEGORIES_DIR}`);
}

// Define the image dimensions
const width = 800;
const height = 600;

// Create a canvas
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Fill the background with a gradient
const gradient = ctx.createLinearGradient(0, 0, width, height);
gradient.addColorStop(0, '#4a7c59');
gradient.addColorStop(1, '#255f35');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

// Draw some plant-like shapes
ctx.fillStyle = '#8BC34A';

// Draw stylized plant
const drawStylizedPlant = (x, y, scale) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  // Stem
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -100);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#2E7D32';
  ctx.stroke();
  
  // Leaves
  for (let i = 0; i < 5; i++) {
    ctx.save();
    
    // Position leaves along stem
    ctx.translate(0, -20 - i * 15);
    
    // Alternate leaf direction
    const direction = i % 2 === 0 ? 1 : -1;
    
    // Draw leaf
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      15 * direction, -10,
      30 * direction, -15,
      40 * direction, -5
    );
    ctx.bezierCurveTo(
      30 * direction, 5,
      15 * direction, 10,
      0, 0
    );
    
    // Fill leaf with gradient
    const leafGradient = ctx.createLinearGradient(0, 0, 40 * direction, 0);
    leafGradient.addColorStop(0, '#4CAF50');
    leafGradient.addColorStop(1, '#81C784');
    ctx.fillStyle = leafGradient;
    ctx.fill();
    
    ctx.restore();
  }
  
  // Flower/bloom at top
  ctx.beginPath();
  ctx.arc(0, -110, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#9C27B0';
  ctx.fill();
  
  // Petals around flower
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 20;
    const y = Math.sin(angle) * 20;
    
    ctx.beginPath();
    ctx.ellipse(-5 + x, -110 + y, 10, 15, angle, 0, Math.PI * 2);
    ctx.fillStyle = '#E1BEE7';
    ctx.fill();
  }
  
  ctx.restore();
};

// Draw multiple plants
drawStylizedPlant(width / 2 - 100, height, 0.8);
drawStylizedPlant(width / 2, height, 1);
drawStylizedPlant(width / 2 + 100, height, 0.9);

// Add text
ctx.font = 'bold 48px Arial';
ctx.fillStyle = 'white';
ctx.textAlign = 'center';
ctx.fillText('Hearthfire Farm', width / 2, 100);

ctx.font = '36px Arial';
ctx.fillText('Plant Collection', width / 2, 150);

// Add a soft vignette effect
ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
ctx.beginPath();
ctx.rect(0, 0, width, height);
const vignetteGradient = ctx.createRadialGradient(
  width / 2, height / 2, width / 4,
  width / 2, height / 2, width
);
vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
ctx.fillStyle = vignetteGradient;
ctx.fill();

// Save the image
const outputPath = path.join(CATEGORIES_DIR, 'default.jpg');
const out = fs.createWriteStream(outputPath);
const stream = canvas.createJPEGStream({ quality: 0.95 });
stream.pipe(out);

out.on('finish', () => {
  console.log(`✅ Default category image created and saved to ${outputPath}`);
});

out.on('error', (err) => {
  console.error('Error creating default category image:', err);
}); 