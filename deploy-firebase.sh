#!/bin/bash
# Deployment script for Firebase Functions with Sharp fix

echo "Starting deployment process..."

# Build the Next.js app
echo "Building Next.js app..."
npm run build

# Copy files to functions folder
echo "Copying build files to functions folder..."
node scripts/copy-next-build.js

# Navigate to functions directory
echo "Navigating to functions directory..."
cd functions

# Ensure postinstall script is executable
echo "Making postinstall script executable..."
chmod +x postinstall.js

# Install dependencies
echo "Installing dependencies for Firebase Functions..."
npm install

# Manually reinstall Sharp for Linux
echo "Reinstalling Sharp for Linux platform..."
npm uninstall sharp
npm install --platform=linux --arch=x64 sharp

# Return to project root
echo "Returning to project root..."
cd ..

# Deploy to Firebase
echo "Deploying to Firebase..."
firebase deploy

echo "Deployment completed!" 