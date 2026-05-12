const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

const SEARCH_TERMS = [
  'post-ceremony',
  'Post-Ceremony',
  'ceremony',
  'Ceremony is a beginning',
  'Integration Support'
];

async function walkDir(dir) {
  let results = [];
  const items = await readdir(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stats = await stat(itemPath);
    
    if (stats.isDirectory()) {
      // Skip node_modules and .next directories
      if (item === 'node_modules' || item === '.next' || item === '.git') continue;
      results = results.concat(await walkDir(itemPath));
    } else {
      // Only check JS/JSX/TS/TSX files
      if (/\.(js|jsx|ts|tsx)$/.test(item)) {
        results.push(itemPath);
      }
    }
  }
  
  return results;
}

async function searchFiles() {
  console.log('Searching for ceremony page files...');
  const files = await walkDir('.');
  
  for (const file of files) {
    try {
      const content = await readFile(file, 'utf8');
      
      // Check if any search term exists in the file
      const match = SEARCH_TERMS.some(term => content.includes(term));
      
      if (match) {
        console.log(`Found match in: ${file}`);
        // Print a few lines of context around the match
        SEARCH_TERMS.forEach(term => {
          const index = content.indexOf(term);
          if (index !== -1) {
            const start = Math.max(0, index - 100);
            const end = Math.min(content.length, index + 100);
            console.log(`--- Match for "${term}": ${content.substring(start, end).replace(/\n/g, ' ')} ---`);
          }
        });
      }
    } catch (err) {
      console.error(`Error reading file ${file}:`, err);
    }
  }
}

searchFiles()
  .then(() => console.log('Search complete!'))
  .catch(err => console.error('Error:', err)); 