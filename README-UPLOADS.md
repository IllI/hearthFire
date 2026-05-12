# HearthFire Farm File Upload System

## Overview

This document explains how file uploads work in the HearthFire Farm application.

## How It Works

The application uses a simple but effective approach for handling product image uploads:

1. Files are uploaded to the `/public/uploads` directory during development
2. These files become static assets that are deployed with the application
3. When you run `firebase deploy --only hosting`, the uploaded files are included in the deployment

## Benefits

This approach has several advantages:

- **No third-party dependencies** - We don't rely on external services like Google Cloud Storage
- **Free to use** - Hosting static files is included in your Firebase hosting plan
- **Simple implementation** - Files are treated as static assets, just like other site content
- **Reliable performance** - Files are served by Firebase's CDN for fast global access

## Directory Structure

- `/public/uploads/products` - Product images uploaded through the admin interface
- `/public/uploads/general` - General uploads (if needed)

## How to Use

Simply upload images through the admin interface. They will be:
1. Stored in the `/public/uploads/products` directory
2. Accessible via URLs like `/uploads/products/filename.jpg`
3. Automatically included in deployments when you run `firebase deploy --only hosting`

## Build Process

Our build process includes a script (`scripts/ensure-uploads-dir.js`) that:
1. Creates the necessary upload directories if they don't exist
2. Adds `.gitkeep` files to ensure the directory structure is preserved in Git
3. Creates a README file for documentation

## Local Development

During local development, uploaded files will be immediately available at `/uploads/...` paths.

## Production Environment

In production, uploaded files will be automatically deployed when you:
1. Run `npm run build` to build the application
2. Run `firebase deploy --only hosting` to deploy the changes

## Git and Version Control

The upload directory structure is included in Git, but actual uploaded files are excluded via `.gitignore`. This keeps your repository size manageable while still ensuring the necessary directories exist for new clones of the repository.

## Troubleshooting

If you encounter issues with file uploads:

1. Check that the `/public/uploads/products` directory exists
2. Ensure permissions allow writing to this directory
3. After uploading, verify you can access the file at `/uploads/products/filename.jpg`
4. Make sure to deploy your changes with `firebase deploy --only hosting`

For any persistent issues, check the console logs in your browser and the server logs for more details. 