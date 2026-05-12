# Hearthfire Farm Database Seeding Scripts

This directory contains scripts for seeding the Firestore database with product data.

## Plant Seeding Scripts

### Enhanced Local Plant Seeder (Recommended)

We've created an improved plant seeding script (`enhanced-local-plant-seeder.js`) that addresses several limitations and implements key enhancements:

1. **Local Image Storage** - Downloads and stores all plant images locally:
   - Uses local images from the `plant pages` directory when available
   - Downloads external images to the public directory for better performance and reliability
   - Creates a consistent storage system organized by plant name

2. **HTML Description Extraction** - Parses HTML files in the plant pages directory:
   - Extracts detailed descriptions from HTML content
   - Properly formats extracted features into cohesive paragraphs
   - Maintains the original content and information structure

3. **Scientific Description Generation** - Creates detailed, accurate plant descriptions:
   - Prioritizes information from HTML files
   - Falls back to curated descriptions for common plants
   - Generates scientifically accurate, category-specific descriptions when needed

4. **Improved Error Handling** - More robust checking and validation throughout the process

### Running the Enhanced Local Seeder

To reset the database and seed with locally stored plant data:
```
cd scripts
node reset-and-seed-local.js
```

Or use the npm script:
```
npm run reset:data:local
```

## Original Plant Seeders

The repository maintains several previous plant seeding implementations for reference:

1. **Basic Plant Seeder** (`seed-plants.js`) - Original implementation with limited descriptions.

2. **Simplified Plant Seeder** (`seed-plants-simplified.js`) - Streamlined version of the original.

3. **DDG Image Seeder** (`seed-plants-with-ddg-images.js`) - Uses external image search.

4. **Enhanced Plant Seeder** (`enhanced-plant-seeder.js`) - Improved descriptions but links to external images.

## Image Management Utility

The `image-manager.js` script provides tools for managing plant images:

```
# Audit all plant images for issues
node image-manager.js audit

# Update a specific plant's image
node image-manager.js update <plantId> <newImageUrl>
```

This utility helps identify and fix problematic images in the database.

## Setup

1. Install dependencies:
   ```
   cd scripts
   npm install
   ```

2. Make sure your Firebase configuration is set up in your project root's `.env.local` file:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
   ```

## Running the Seeding Scripts

To seed the database with plant data:

```
npm run seed:plants               # Original seeding script
npm run seed:plants:simple        # Simplified version
npm run seed:plants:images        # Version with DDG image search
npm run seed:plants:enhanced      # Enhanced version with better descriptions
npm run seed:plants:local         # Enhanced version with local images storage and HTML descriptions
```

## Clearing Data

The `clear-data.js` script allows you to clear collections in your Firestore database:

- Clear both products and categories collections:
  ```
  npm run clear:data
  ```

- Clear only the products collection:
  ```
  npm run clear:products
  ```

- Clear only the categories collection:
  ```
  npm run clear:categories
  ```

- Reset by clearing all data and re-seeding:
  ```
  npm run reset:data               # Reset and seed with original script
  npm run reset:data:simple        # Reset and seed with simplified script
  npm run reset:data:images        # Reset and seed with DDG images script
  npm run reset:data:enhanced      # Reset and seed with enhanced script
  npm run reset:data:local         # Reset and seed with enhanced local script (recommended)
  ```

- Clear specific collections:
  ```
  node clear-data.js collection1 collection2 ...
  ```

## Image Handling in Enhanced Local Seeder

The enhanced local plant seeder implements a comprehensive image management approach:

1. First tries to find local images in the plant pages directory
2. Copies any found local images to the public directory for web access
3. Downloads external images from the verified image dictionary when local images aren't available
4. Stores all images locally for improved performance and reliability
5. Provides a consistent path structure for all plant images

## HTML Description Extraction

The enhanced local seeder intelligently extracts content from HTML files:

1. Searches for exact or partial matching directories in plant pages
2. Parses HTML content using cheerio
3. Extracts meaningful text from paragraphs
4. Converts feature lists (marked with asterisks) into proper paragraphs
5. Ensures descriptions are well-formatted and informative

## Notes

- Plant categories are automatically determined based on plant characteristics:
  - Native Plants
  - Medicinal Herbs
  - Pollinator Friendly
  - Culinary Herbs
- Category images are also downloaded and stored locally
- All plants receive scientifically accurate, detailed descriptions 