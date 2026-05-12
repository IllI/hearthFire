// Helper script to clear collections and run enhanced plant seeder
const { execSync } = require('child_process');
const path = require('path');

console.log('Starting database reset and enhanced seeding process...');

try {
  // Execute the clear-collections script first
  console.log('Clearing existing collections...');
  execSync('node clear-data.js', { 
    stdio: 'inherit',
    cwd: __dirname
  });
  
  // Then run the enhanced plant seeder
  console.log('Running enhanced plant seeder...');
  execSync('node enhanced-plant-seeder.js', { 
    stdio: 'inherit',
    cwd: __dirname
  });
  
  console.log('✅ Database reset and enhanced seeding completed successfully!');
} catch (error) {
  console.error('❌ Error during reset and seeding process:', error.message);
  process.exit(1);
} 