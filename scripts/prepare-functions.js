const fs = require('fs');
const path = require('path');

// Ensure the .next directory exists
if (!fs.existsSync(path.join(__dirname, '../.next'))) {
  console.error('Error: .next directory not found. Please run npm run build first.');
  process.exit(1);
}

// Create the functions directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, '../functions'))) {
  fs.mkdirSync(path.join(__dirname, '../functions'), { recursive: true });
}

// Generate a file with the path to the Next.js build - USE RELATIVE PATHS
const nextConfigPath = path.join(__dirname, '../functions/next-config.js');
fs.writeFileSync(
  nextConfigPath,
  `module.exports = { 
  // Using relative paths that will work in cloud environment
  nextPath: '.next',
  publicPath: 'public'
};`,
  'utf8'
);

console.log('Created next-config.js for functions with relative paths.'); 