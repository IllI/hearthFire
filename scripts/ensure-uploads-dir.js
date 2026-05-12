const fs = require('fs');
const path = require('path');

console.log('Ensuring uploads directories exist...');

// Define base directories for uploads
const baseDir = path.join(process.cwd(), 'public');
const uploadsDir = path.join(baseDir, 'uploads');
const subdirectories = [
  'products',
  'general'
];

// Create base uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  console.log(`Creating base uploads directory: ${uploadsDir}`);
  fs.mkdirSync(uploadsDir, { recursive: true });
} else {
  console.log(`Base uploads directory already exists: ${uploadsDir}`);
}

// Create each subdirectory
for (const subdir of subdirectories) {
  const fullPath = path.join(uploadsDir, subdir);
  if (!fs.existsSync(fullPath)) {
    console.log(`Creating subdirectory: ${fullPath}`);
    fs.mkdirSync(fullPath, { recursive: true });
  } else {
    console.log(`Subdirectory already exists: ${fullPath}`);
  }
}

// Create a .gitkeep file in each directory to ensure they're included in Git
for (const subdir of subdirectories) {
  const gitkeepPath = path.join(uploadsDir, subdir, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    console.log(`Creating .gitkeep in: ${subdir}`);
    fs.writeFileSync(gitkeepPath, '');
  }
}

// Create a README file
const readmePath = path.join(uploadsDir, 'README.md');
const readmeContent = `# Uploads Directory

This directory contains uploaded files for the HearthFire Farm application.

## Structure
- \`/products\`: Product images uploaded through the admin interface
- \`/general\`: General uploads for the application

**Note:** These directories are preserved in Git with \`.gitkeep\` files, but the actual 
uploaded files should be excluded from version control (via .gitignore).
`;

if (!fs.existsSync(readmePath)) {
  console.log('Creating README.md file');
  fs.writeFileSync(readmePath, readmeContent);
}

console.log('✅ Uploads directories setup completed successfully'); 