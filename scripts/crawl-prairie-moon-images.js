/**
 * Prairie Moon Image Crawler
 * 
 * For each product missing an image, this script:
 * 1. Fetches the Prairie Moon product page by searching for the Latin name
 * 2. Extracts the main product image URL 
 * 3. Downloads the image and uploads it to ImgBB
 * 4. Updates the product in Firebase with the ImgBB URL
 *
 * Usage: node scripts/crawl-prairie-moon-images.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const admin = require('firebase-admin');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}
const db = admin.firestore();

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '93d42a3af8827220fb00930836b61a44';

// Helper: fetch a URL with timeout
function fetchUrl(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, {
            timeout: timeoutMs,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
                return;
            }
            let data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(data), headers: res.headers }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    });
}

// Helper: convert Latin name to Prairie Moon URL slug
function latinNameToSlug(latinName) {
    return latinName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function commonNameToSlug(name) {
    return name.toLowerCase().trim()
        .replace(/,\s*/g, '-')  // "Milkweed, Tall Green" -> "milkweed-tall-green"
        .replace(/'/g, '')       // Remove apostrophes
        .replace(/\./g, '')      // Remove periods
        .replace(/\s+/g, '-')    // Spaces to hyphens
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-');    // Collapse multiple hyphens
}

// Search Prairie Moon for a plant and return the main product image URL
async function findPrairieMoonImage(name, latinName) {
    // Strategy 1: Try direct product page URL (latin-name-common-name)
    const latinSlug = latinNameToSlug(latinName);
    const commonSlug = commonNameToSlug(name);

    // Prairie Moon URL patterns to try
    const urlsToTry = [
        `https://www.prairiemoon.com/${latinSlug}-${commonSlug}`,
        `https://www.prairiemoon.com/${latinSlug}-${commonSlug}-prairie-moon-nursery`,
        `https://www.prairiemoon.com/${latinSlug}`,
    ];

    for (const pageUrl of urlsToTry) {
        try {
            const response = await fetchUrl(pageUrl);
            if (response.status === 200) {
                const html = response.data.toString();

                // Look for main product images in the HTML
                // Pattern: {Name}_main.jpg or {Name}_main_270x360.jpg (unescaped paths in HTML)
                const mainImageRegex = /graphics\/00000001\/[^"'\s\\]*_main[^"'\s\\]*\.jpg/gi;
                const matches = html.match(mainImageRegex);

                if (matches && matches.length > 0) {
                    // Prefer the larger version without specific dimensions, or the 270x360 version
                    let bestMatch = matches[0];
                    for (const m of matches) {
                        // Prefer 270x360 (good quality but not too big)
                        if (m.includes('_main_270x360')) {
                            bestMatch = m;
                            break;
                        }
                        // Or the full-size main image (without dimensions in the name)
                        if (m.includes('_main.jpg') || m.includes('_main_483x730') || m.includes('_main_548x730')) {
                            bestMatch = m;
                        }
                    }
                    const fullUrl = `https://www.prairiemoon.com/mm5/${bestMatch}`;
                    return { imageUrl: fullUrl, source: pageUrl };
                }

                // Fallback: look for any main product image in escaped JSON paths
                const escapedMainRegex = /graphics\\\/00000001\\\/[^"'\s]*_main[^"'\s]*\.jpg/gi;
                const escapedMatches = html.match(escapedMainRegex);
                if (escapedMatches && escapedMatches.length > 0) {
                    let bestMatch = escapedMatches[0].replace(/\\\//g, '/');
                    for (const m of escapedMatches) {
                        const clean = m.replace(/\\\//g, '/');
                        if (clean.includes('_main_270x360') || clean.includes('_main.jpg')) {
                            bestMatch = clean;
                            break;
                        }
                    }
                    const fullUrl = `https://www.prairiemoon.com/mm5/${bestMatch}`;
                    return { imageUrl: fullUrl, source: pageUrl };
                }

                // Last resort: look for the first significant product image (not logo, not placeholder)
                const anyProductImage = /graphics\/00000001\/[^"'\s\\]*(?:flower|plant|seed|field)[^"'\s\\]*\.jpg/gi;
                const anyMatches = html.match(anyProductImage);
                if (anyMatches && anyMatches.length > 0) {
                    const fullUrl = `https://www.prairiemoon.com/mm5/${anyMatches[0]}`;
                    return { imageUrl: fullUrl, source: pageUrl };
                }
            }
        } catch (e) {
            // URL not found or error, try next
            continue;
        }
    }

    // Strategy 2: Try search and look for image in results HTML
    try {
        const searchTerm = latinName.replace(/\s+/g, '+');
        const searchUrl = `https://www.prairiemoon.com/search-results.html?Search=${searchTerm}`;
        const searchResponse = await fetchUrl(searchUrl);
        if (searchResponse.status === 200) {
            const html = searchResponse.data.toString();
            // Look for product images in search results
            const mainImageRegex = /graphics\/00000001\/[^"'\s\\]*_main_270x360[^"'\s\\]*\.jpg/gi;
            const matches = html.match(mainImageRegex);
            if (matches && matches.length > 0) {
                const fullUrl = `https://www.prairiemoon.com/mm5/${matches[0]}`;
                return { imageUrl: fullUrl, source: searchUrl };
            }
        }
    } catch (e) {
        // Search failed
    }

    return null;
}

// Upload image buffer to ImgBB
async function uploadToImgBB(imageBuffer, imageName) {
    const fetch = require('node-fetch');
    const formData = new FormData();
    formData.append('image', imageBuffer.toString('base64'));
    formData.append('name', imageName);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();
    if (result.success) {
        return result.data.url;
    }
    throw new Error(`ImgBB upload failed: ${JSON.stringify(result)}`);
}

async function main() {
    console.log('=== Prairie Moon Image Crawler ===\n');

    // Get products missing images
    const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tmp_missing_images.json'), 'utf8'));
    console.log(`Found ${products.length} products without images.\n`);

    const results = { success: [], failed: [], skipped: [] };

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`\n[${i + 1}/${products.length}] ${product.name} (${product.latinName})`);

        try {
            // Step 1: Find Prairie Moon image
            console.log(`  🔍 Searching Prairie Moon...`);
            const imageResult = await findPrairieMoonImage(product.name, product.latinName);

            if (!imageResult) {
                console.log(`  ⚠️  No image found on Prairie Moon`);
                results.failed.push({ name: product.name, reason: 'No image found' });
                continue;
            }

            console.log(`  📷 Found: ${imageResult.imageUrl.split('/').pop()}`);

            // Step 2: Download the image
            console.log(`  📥 Downloading...`);
            const imgResponse = await fetchUrl(imageResult.imageUrl);
            if (imgResponse.status !== 200) {
                console.log(`  ❌ Download failed (HTTP ${imgResponse.status})`);
                results.failed.push({ name: product.name, reason: `Download failed: ${imgResponse.status}` });
                continue;
            }

            // Step 3: Upload to ImgBB
            console.log(`  📤 Uploading to ImgBB...`);
            const slugName = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
            const imgbbUrl = await uploadToImgBB(imgResponse.data, slugName);
            console.log(`  ✅ ImgBB URL: ${imgbbUrl}`);

            // Step 4: Update product in Firebase
            console.log(`  🔄 Updating product in database...`);
            await db.collection('products').doc(product.id).update({
                image: imgbbUrl,
                images: [imgbbUrl],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`  ✅ Product updated!`);
            results.success.push({ name: product.name, id: product.id, imgbbUrl });

            // Be polite — wait between requests
            await new Promise(r => setTimeout(r, 1500));

        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
            results.failed.push({ name: product.name, reason: error.message });
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('=== SUMMARY ===\n');
    console.log(`✅ Successfully added images: ${results.success.length}`);
    results.success.forEach(r => console.log(`   - ${r.name}`));
    console.log(`\n❌ Failed/No image found: ${results.failed.length}`);
    results.failed.forEach(r => console.log(`   - ${r.name}: ${r.reason}`));

    // Save results
    fs.writeFileSync(
        path.join(__dirname, 'prairie-moon-results.json'),
        JSON.stringify(results, null, 2)
    );
    console.log('\nResults saved to scripts/prairie-moon-results.json');

    process.exit(0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
