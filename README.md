# HearthFire Farm Plant Database

A dynamic plant database system for HearthFire Farm, featuring automated content generation, image management, and rich plant descriptions.

## Features

- **Automated Content Generation**: Fully automated system to generate rich plant descriptions and find appropriate images
- **Local Image Management**: Organizes and indexes local plant images for fast access
- **Category System**: Plants are automatically categorized based on their properties
- **Search & Filter**: Easily find plants by name, category, or characteristics
- **Responsive Design**: Works beautifully on all devices

## Quick Start

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Set up environment variables**:
   - Copy `.env.local.example` to `.env.local`
   - Add your Firebase credentials
   - (Optional) Add image API keys for enhanced image sourcing

3. **Run the development server**:
   ```
   npm run dev
   ```

4. **View the application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser

## Content Management Scripts

### Automated Plant Generator

The fastest way to populate your database with high-quality content:

```
cd scripts
npm run seed:plants:auto
```

This script:
- Processes plants from your CSV file
- Generates detailed descriptions based on plant types
- Finds appropriate images using local sources and image APIs
- Creates proper category assignments
- Adds everything to your Firebase database

### Image Management

Several options for managing plant images:

1. **Organize Local Images**:
   ```
   npm run organize:images
   ```

2. **Update a Single Plant Image**:
   ```
   npm run update:image <plant-id> <image-url>
   ```

3. **List Plants Needing Images**:
   ```
   npm run image:manager list
   ```

## Advanced Configuration

### Image API Integration

For the best automated image sourcing, add one or more of these free API keys to your `.env.local` file:

```
# Unsplash API (https://unsplash.com/developers)
UNSPLASH_ACCESS_KEY=your_key_here

# Pexels API (https://www.pexels.com/api/)
PEXELS_API_KEY=your_key_here

# Pixabay API (https://pixabay.com/api/docs/)
PIXABAY_API_KEY=your_key_here
```

### Database Reset Commands

To start fresh with new data:

```
npm run reset:data:auto  # Full reset with automated content
```

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the ISC License. 