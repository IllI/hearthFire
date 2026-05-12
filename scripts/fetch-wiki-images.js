/**
 * Wikipedia Image Fetcher
 * 
 * SYSTEMATIC SOURCE:
 * Uses the MediaWiki API to find high-quality images for plants based on their Latin names.
 * This covers general species images which are excellent for most herbs and botanicals.
 *
 * Usage: node scripts/fetch-wiki-images.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}
const db = admin.firestore();

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '93d42a3af8827220fb00930836b61a44';

// Helper: fetch JSON from URL
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Helper: fetch binary image data
function fetchImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = [];
            res.on('data', c => data.push(c));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}

// Upload to ImgBB
async function uploadToImgBB(imageBuffer, imageName) {
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

// Get image URL from Wikipedia API
async function getWikiImage(latinName) {
    // 1. Try exact Latin name
    let url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(latinName)}&prop=pageimages&format=json&pithumbsize=600`;
    let data = await fetchJson(url);
    let pages = data.query.pages;
    let pageId = Object.keys(pages)[0];

    if (pageId === '-1') {
        // 2. Try just the genus if species fails? No, better to try common name maybe?
        // Let's stick to valid Latin names for now.
        return null;
    }

    if (pages[pageId].thumbnail) {
        return pages[pageId].thumbnail.source;
    }
    return null;
}

async function main() {
    console.log('=== Wikipedia Image Fetcher ===\n');

    // Get products missing images that failed previous attempts
    // (We could re-scan DB, but let's use the list of known missing ones or just scan DB to be safe)

    const snapshot = await db.collection('products').get();
    const products = [];
    snapshot.forEach(doc => {
        const p = doc.data();
        if (!p.image || p.image === '') {
            if (p.latinName && p.latinName.length > 2) {
                products.push({ id: doc.id, name: p.name, latinName: p.latinName });
            }
        }
    });

    console.log(`Found ${products.length} products still missing images.\n`);

    const results = { success: [], failed: [] };

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        console.log(`[${i + 1}/${products.length}] ${p.name} (${p.latinName})`);

        try {
            // 1. Get Wiki Image
            let wikiUrl = await getWikiImage(p.latinName);
            if (!wikiUrl) {
                // Fallback: try cleaning latin name (remove var. etc if needed)
                // e.g. "Brassica rapa var. rosularis" -> "Brassica rapa" (maybe too generic)
                // or "Matricaria recutita" -> "Matricaria chamomilla" (synonym)
                if (p.latinName === 'Matricaria recutita') wikiUrl = await getWikiImage('Matricaria chamomilla');
                // Add other manual overrides if needed
            }

            if (!wikiUrl) {
                console.log(`  ❌ No image found on Wikipedia`);
                results.failed.push(p.name);
                continue;
            }

            console.log(`  📷 Found Wiki URL: ${wikiUrl}`);

            // 2. Download
            const imgBuffer = await fetchImage(wikiUrl);

            // 3. Upload to ImgBB
            console.log(`  📤 Uploading to ImgBB...`);
            const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const imgbbUrl = await uploadToImgBB(imgBuffer, slug);
            console.log(`  ✅ ImgBB URL: ${imgbbUrl}`);

            // 4. Update DB
            await db.collection('products').doc(p.id).update({
                image: imgbbUrl,
                images: [imgbbUrl],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            results.success.push({ name: p.name, url: imgbbUrl });

            // Polite delay
            await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
            results.failed.push(p.name);
        }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Success: ${results.success.length}`);
    results.success.forEach(r => console.log(`  + ${r.name}`));
    console.log(`\nFailed: ${results.failed.length}`);
    results.failed.forEach(r => console.log(`  - ${r}`));

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
