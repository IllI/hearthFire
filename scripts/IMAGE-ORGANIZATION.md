# Image Organization for Hearthfire Farm

This document explains the image organization system implemented for the Hearthfire Farm plant database.

## Overview

The image organization process involves:

1. Scanning the `plant pages` directory for all plant images
2. Copying those images to a structured directory in the public folder
3. Creating a consistent naming convention for all images
4. Generating a JSON index of all organized images
5. Making all images accessible via consistent web paths

## How It Works

The `organize-local-images.js` script handles the image organization process:

```
npm run organize:images
```

This script:

1. Scans through all subdirectories in the `plant pages` directory
2. Identifies image files (jpg, jpeg, png, gif, webp)
3. Extracts plant name information from directory paths
4. Creates normalized plant name folders in `/public/images/plants/`
5. Copies the images to the appropriate plant folders
6. Generates a JSON index of all organized images at `scripts/organized-images.json`

## Image Access

After organization, images can be accessed through consistent web paths:

```
/images/plants/[normalized-plant-name]/[filename]
```

For example:
- `/images/plants/purple-coneflower/image1.jpg`
- `/images/plants/bee-balm/photo1.png`

## Integration with Plant Seeder

The enhanced local plant seeder (`enhanced-local-plant-seeder.js`) integrates with this system:

1. It first organizes all local images (if not already done)
2. Uses the organized images JSON index to find appropriate images for each plant
3. Falls back to downloading external images when no local images are available
4. Stores all downloaded images using the same directory structure
5. Uses consistent web paths in the database entries

## Benefits of Local Image Storage

1. **Performance** - Eliminates external dependencies for images
2. **Reliability** - No broken links if external sources change
3. **Consistency** - Uniform image path structure
4. **Offline capability** - All images available without internet access
5. **Control** - Full control over image optimization and delivery

## Manual Image Addition

To manually add images for a plant:

1. Create a directory with the plant's name in the `plant pages` directory
2. Add image files to this directory
3. Run the image organization script again:
   ```
   npm run organize:images
   ```
4. Update the database with the new image paths if needed

## Image Organization Output

When you run the script, it will output:
- A list of all plant directories processed
- The total number of images found and copied
- Any errors encountered during processing
- A summary of plants with local images

This information helps track which plants have images and which might need additional images.

## Image Quality Guidelines

For best results, plant images should:
- Be at least 800x600 pixels in resolution
- Show the plant clearly, ideally in bloom
- Have good lighting and focus
- Be in JPG or PNG format for best web compatibility
- Be under 500KB in size for optimal loading

## Troubleshooting

If images aren't appearing correctly:

1. Check that the image organization script ran successfully
2. Verify the image paths in the `organized-images.json` file
3. Ensure the public directory and its contents are properly served by your web server
4. Check for any console errors related to image loading in the browser
5. Verify that the database entries contain the correct image paths 