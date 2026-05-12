const fs = require('fs');
const path = require('path');

// Paths to our helper scripts
const apiHelperPath = '/api-helper.js';
const adminFixPath = '/admin-fix.js';

// Directory where the exported Next.js files are
const outDir = path.join(process.cwd(), 'out');

// List of admin pages to patch
const adminPages = [
  'admin/orders.html',
  'admin/products.html',
  'admin/products/index.html',
  'admin/products/edit/[id].html',
  'admin/products/edit-v2/[id].html',
  'admin/products/new.html',
  'admin/products/SimpleEdit.html'
];

// Function to inject our scripts into the HTML files
function injectScripts(htmlPath) {
  const fullPath = path.join(outDir, htmlPath);
  
  // Skip if file doesn't exist
  if (!fs.existsSync(fullPath)) {
    console.log(`File does not exist: ${fullPath}`);
    return;
  }
  
  try {
    // Read the HTML file
    let html = fs.readFileSync(fullPath, 'utf8');
    
    // Check if the scripts are already injected
    if (html.includes(apiHelperPath) && html.includes(adminFixPath)) {
      console.log(`Scripts already injected in ${fullPath}`);
      return;
    }
    
    // Inject the scripts before the closing head tag
    if (html.includes('</head>')) {
      html = html.replace('</head>', 
        `  <script src="${apiHelperPath}"></script>
  <script src="${adminFixPath}"></script>
</head>`);
      
      // Write the updated HTML back to the file
      fs.writeFileSync(fullPath, html);
      console.log(`✓ Injected scripts into ${fullPath}`);
    } else {
      console.warn(`Could not find </head> tag in ${fullPath}`);
    }
  } catch (error) {
    console.error(`Error injecting scripts into ${fullPath}:`, error);
  }
}

// Main function
function main() {
  console.log('Patching remaining admin pages...');
  
  // Process each page
  adminPages.forEach(injectScripts);
  
  console.log('✓ Patching complete!');
}

main(); 