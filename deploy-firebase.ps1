# PowerShell Deployment script for Firebase Functions with Sharp fix

Write-Output "Starting deployment process..."

# Build the Next.js app
Write-Output "Building Next.js app..."
npm run build

# Copy files to functions folder
Write-Output "Copying build files to functions folder..."
node scripts/copy-next-build.js

# Navigate to functions directory
Write-Output "Navigating to functions directory..."
Push-Location functions

# Install dependencies
Write-Output "Installing dependencies for Firebase Functions..."
npm install

# Manually reinstall Sharp for Linux
Write-Output "Reinstalling Sharp for Linux platform..."
npm uninstall sharp
npm install --platform=linux --arch=x64 sharp

# Return to project root
Write-Output "Returning to project root..."
Pop-Location

# Deploy to Firebase
Write-Output "Deploying to Firebase..."
firebase deploy

Write-Output "Deployment completed!" 