const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

// Clear the out directory if it exists
try {
  fs.removeSync(path.join(process.cwd(), 'out'));
  console.log('✓ Cleaned out directory');
} catch (err) {
  console.log('No out directory to clean');
}

// Build and export the Next.js app
console.log('Building and exporting Next.js app...');
try {
  execSync('next build && next export', { stdio: 'inherit' });
  console.log('✓ Next.js app built and exported successfully');
} catch (err) {
  console.error('Error building and exporting Next.js app:', err);
  process.exit(1);
}

// Create a copy of index.html for all API routes to make them accessible
// This is just a placeholder, real API functionality will be handled by functions
console.log('Creating API route placeholders...');
try {
  const apiDir = path.join(process.cwd(), 'out', 'api');
  fs.ensureDirSync(apiDir);
  
  // Create a simple API response file
  fs.writeFileSync(
    path.join(apiDir, 'index.html'),
    `<!DOCTYPE html>
<html>
<head>
  <title>API Endpoint</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <h1>This API route is served by Firebase Functions</h1>
  <p>Static export placeholder.</p>
</body>
</html>`
  );
  
  console.log('✓ API placeholders created');
} catch (err) {
  console.error('Error creating API placeholders:', err);
}

console.log('✓ Export completed successfully'); 