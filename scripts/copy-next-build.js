/**
 * This script copies the Next.js build output to the Firebase functions directory
 * and ensures all necessary dependencies are available
 */

const fs = require('fs-extra');
const path = require('path');

// Define paths
const rootDir = path.join(__dirname, '..');
const nextBuildDir = path.join(rootDir, '.next');
const publicDir = path.join(rootDir, 'public');
const functionsDir = path.join(rootDir, 'functions');
const functionsNextDir = path.join(functionsDir, '.next');
const functionsPublicDir = path.join(functionsDir, 'public');

// Define files to preserve
const preserveFiles = [
  'package.json',
  'package-lock.json',
  'index.js',
  'warmer.js'
];

// Fixes Windows paths in next.config.js and other files
async function fixWindowsPaths(directory) {
  console.log(`Fixing Windows paths in ${directory}...`);
  
  // Function to walk through directory and fix files
  async function processDirectory(dir) {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        await processDirectory(fullPath);
      } else if (stat.isFile() && 
                (fullPath.endsWith('.js') || 
                 fullPath.endsWith('.json') || 
                 fullPath.endsWith('.map'))) {
        try {
          let content = await fs.readFile(fullPath, 'utf8');
          
          // Replace Windows paths with forward slashes and no drive letter
          const updatedContent = content.replace(/[A-Z]:\\[^"'\s\\]+/g, (match) => {
            return match.replace(/\\/g, '/').replace(/^[A-Z]:/i, '');
          });
          
          if (content !== updatedContent) {
            await fs.writeFile(fullPath, updatedContent, 'utf8');
            console.log(`Fixed Windows paths in: ${fullPath}`);
          }
        } catch (err) {
          console.log(`Error processing file ${fullPath}: ${err.message}`);
        }
      }
    }
  }
  
  await processDirectory(directory);
}

async function copyNextBuild() {
  try {
    console.log('Copying Next.js build to functions directory...');
    
    // Check if .next directory exists
    if (!fs.existsSync(path.join(process.cwd(), '.next'))) {
      console.error('Error: .next directory not found. Please run "npm run build" first.');
      process.exit(1);
    }
    
    // Create the functions/.next directory if it doesn't exist
    const functionsNextDir = path.join(process.cwd(), 'functions', '.next');
    fs.ensureDirSync(functionsNextDir);
    
    // Copy the .next directory to functions/.next
    await fs.copy(
      path.join(process.cwd(), '.next'),
      functionsNextDir,
      {
        filter: (src) => {
          // Skip cache directories to reduce size
          return !src.includes('cache');
        }
      }
    );
    
    // Copy necessary files for Next.js to work in functions
    const filesToCopy = [
      'next.config.js',
      'public'  // Removed 'package.json' from this list to prevent overwriting
    ];
    
    for (const file of filesToCopy) {
      const src = path.join(process.cwd(), file);
      const dest = path.join(process.cwd(), 'functions', file);
      
      if (fs.existsSync(src)) {
        if (fs.lstatSync(src).isDirectory()) {
          await fs.copy(src, dest);
        } else {
          await fs.copyFile(src, dest);
        }
      }
    }
    
    console.log('✅ Next.js build copied to functions directory successfully');
  } catch (error) {
    console.error('Error copying Next.js build:', error);
    process.exit(1);
  }
}

copyNextBuild(); 