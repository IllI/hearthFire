# ImgBB Integration for HearthFire Farm

This document explains how image uploads work in the HearthFire Farm application.

## Overview

Instead of using local file storage or Firebase Storage, this application uses [ImgBB](https://imgbb.com/) as a free image hosting service for product images uploaded through the admin panel.

## Benefits

- **Free Tier Available**: ImgBB offers a generous free tier that should be sufficient for your needs
- **No Server Storage Issues**: Images are stored on ImgBB's servers, eliminating storage concerns with Firebase Functions
- **CDN Delivery**: ImgBB serves images through a fast CDN
- **Compatible with Existing System**: Works with your external image URLs from the seeded products

## How It Works

1. When you upload an image in the admin panel, it's sent to our `/api/imgbb-upload` endpoint
2. This endpoint processes the file and uploads it to ImgBB using your API key
3. ImgBB returns URLs for the uploaded image, which are stored in your product records
4. These images are served directly from ImgBB's servers

## Configuration

The ImgBB API key is set in the following locations:

1. `.env.local` file for local development:
   ```
   IMGBB_API_KEY=1ee847a5b670d770d31ba388e577f9b8
   ```

2. Firebase Functions config for production:
   ```
   firebase functions:config:set imgbb.apikey="1ee847a5b670d770d31ba388e577f9b8"
   ```

## API Responses

ImgBB returns several URLs for each uploaded image:

- **url**: The direct URL to the image
- **display_url**: An optimized version for web display (what we use)
- **thumb_url**: A thumbnail version
- **delete_url**: A URL that can be used to delete the image if needed

## Usage Limits

The free tier of ImgBB includes:
- Image uploads up to 32 MB
- No explicit rate limiting, but excessive use might be throttled
- Images stored indefinitely unless your account is inactive

For complete and current information, please check the [ImgBB website](https://imgbb.com/).

## Usage in Code

The integration is used in these main components:

- `/pages/admin/products/index.js` - For product listing page
- `/pages/admin/products/SimpleEdit.js` - For simple product editor
- `/components/ProductForm.js` - For the product form component

All of these components use the `/api/imgbb-upload.js` endpoint to handle the image uploads.

## Troubleshooting

If you encounter issues with image uploads:

1. Check the browser console and server logs for error messages
2. Verify that your ImgBB API key is correct in both environment variables and Firebase config
3. Ensure your image file sizes are reasonable (under 10 MB is recommended)

For persistent issues, you may need to check your ImgBB account dashboard to verify API usage limits. 