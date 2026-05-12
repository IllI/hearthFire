const fs = require('fs');
const path = require('path');

// Paths to our helper scripts
const apiHelperPath = '/api-helper.js';
const adminFixPath = '/admin-fix.js';

// Directory where the exported Next.js files are
const outDir = path.join(process.cwd(), 'out');

// Function to recursively find HTML files in the admin directory
function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Only recurse into admin directories
      if (file === 'admin' || dir.includes('admin')) {
        findHtmlFiles(filePath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to inject our scripts into the HTML files
function injectScripts(htmlFile) {
  try {
    // Read the HTML file
    let html = fs.readFileSync(htmlFile, 'utf8');
    
    // Check if the scripts are already injected
    if (html.includes(apiHelperPath) && html.includes(adminFixPath)) {
      console.log(`Scripts already injected in ${htmlFile}`);
      return;
    }
    
    // Inject the scripts before the closing head tag
    html = html.replace('</head>', 
      `  <script src="${apiHelperPath}"></script>
  <script src="${adminFixPath}"></script>
</head>`);
    
    // Write the updated HTML back to the file
    fs.writeFileSync(htmlFile, html);
    
    console.log(`✓ Injected scripts into ${htmlFile}`);
  } catch (error) {
    console.error(`Error injecting scripts into ${htmlFile}:`, error);
  }
}

// Copy our helper scripts to the out directory
function copyHelperScripts() {
  try {
    // Ensure the api-helper.js file is copied
    const apiHelperSource = path.join(outDir, 'api-helper.js');
    if (fs.existsSync(apiHelperSource)) {
      console.log('✓ api-helper.js already exists');
    } else {
      console.error('❌ api-helper.js not found in out directory');
      process.exit(1);
    }
    
    // Ensure the admin-fix.js file is copied
    const adminFixSource = path.join(outDir, 'admin-fix.js');
    if (fs.existsSync(adminFixSource)) {
      console.log('✓ admin-fix.js already exists');
    } else {
      console.error('❌ admin-fix.js not found in out directory');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error copying helper scripts:', error);
    process.exit(1);
  }
}

// Main function
async function main() {
  try {
    console.log('Patching admin pages with API helper scripts...');
    
    // Copy the helper scripts
    copyHelperScripts();
    
    // Find all HTML files in the admin directory
    const htmlFiles = findHtmlFiles(outDir).filter(file => 
      file.includes('admin') || file.includes('/admin/'));
    
    console.log(`Found ${htmlFiles.length} admin HTML files to patch`);
    
    // Inject the scripts into each HTML file
    htmlFiles.forEach(injectScripts);
    
    console.log('✓ Patching complete!');
  } catch (error) {
    console.error('Error patching admin pages:', error);
    process.exit(1);
  }
}

main(); 