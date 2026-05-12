/**
 * Prairie Moon Image Crawler - Round 2
 * Targeted crawl for specific native plants with manually researched URL patterns.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
}
const db = admin.firestore();
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '93d42a3af8827220fb00930836b61a44';

function fetchUrl(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            timeout: timeoutMs,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
                return;
            }
            let data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(data) }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

async function uploadToImgBB(imageBuffer, imageName) {
    const formData = new FormData();
    formData.append('image', imageBuffer.toString('base64'));
    formData.append('name', imageName);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const result = await response.json();
    if (result.success) return result.data.url;
    throw new Error(`ImgBB upload failed: ${JSON.stringify(result)}`);
}

// Find image from a Prairie Moon product page HTML
function findMainImage(html) {
    // Look for main product images in unescaped HTML
    const unescaped = html.match(/graphics\/00000001\/[^"'\s\\>]+_main[^"'\s\\>]*\.jpg/gi) || [];
    // Look in escaped JSON data too
    const escaped = html.match(/graphics\\\/00000001\\\/[^"'\s]+_main[^"'\s]*\.jpg/gi) || [];
    const cleaned = escaped.map(m => m.replace(/\\\//g, '/'));

    const all = [...unescaped, ...cleaned].filter(m => !m.includes('NO-IMG'));

    // Prefer 270x360 for a good balance of quality and size
    for (const img of all) {
        if (img.includes('_main_270x360')) return 'https://www.prairiemoon.com/mm5/' + img;
    }
    // Then try 483x730 for higher res
    for (const img of all) {
        if (img.includes('_main_483x730') || img.includes('_main_548x730')) return 'https://www.prairiemoon.com/mm5/' + img;
    }
    // Then any _main
    if (all.length > 0) return 'https://www.prairiemoon.com/mm5/' + all[0];

    return null;
}

// Try multiple URL patterns to find a product page
async function findProductPage(slugs) {
    for (const slug of slugs) {
        const url = 'https://www.prairiemoon.com/' + slug;
        try {
            const response = await fetchUrl(url);
            if (response.status === 200) {
                const html = response.data.toString();
                // Verify it's actually a product page (not a 404 soft redirect)
                if (html.includes('product_display') || html.includes('product-page') || html.includes('_main')) {
                    const imgUrl = findMainImage(html);
                    if (imgUrl) return { pageUrl: url, imageUrl: imgUrl };
                }
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

// Remaining plants that ARE native and likely on Prairie Moon
const PLANTS = [
    {
        id: 'uUtqyOZf2saIby9wLSqe',
        name: 'Mtn. Mint, Hoary',
        slugs: [
            'pycnanthemum-incanum-hoary-mountain-mint',
            'pycnanthemum-incanum-hoary-mountainmint',
            'pycnanthemum-incanum',
        ]
    },
    {
        id: 'TEXLrARfBFaLtoezeQnI',
        name: 'Sunflower, Early',
        slugs: [
            'heliopsis-helianthoides-early-sunflower',
            'heliopsis-helianthoides-false-sunflower',
            'heliopsis-helianthoides-ox-eye-sunflower',
            'heliopsis-helianthoides',
        ]
    },
    {
        id: '5sVgV6eeo95Ed4DoqSKg',
        name: 'Milkweed, Tall Green',
        slugs: [
            'asclepias-hirtella-tall-green-milkweed',
            'asclepias-hirtella-prairie-milkweed',
            'asclepias-hirtella',
        ]
    },
    {
        id: 'lGZmwsBR0LKf7iY6ooq4',
        name: 'Milkweed, Redring',
        slugs: [
            'asclepias-variegata-redring-milkweed',
            'asclepias-variegata-white-milkweed',
            'asclepias-variegata',
        ]
    },
    {
        id: 'xyeOdP9Hbz9yLcj1rQQz',
        name: 'Hairy Woodmint',
        slugs: [
            'blephilia-hirsuta-hairy-woodmint',
            'blephilia-hirsuta-wood-mint',
            'blephilia-hirsuta',
        ]
    },
    {
        id: 'FhnzUCgLCKsOSQpRqYdU',
        name: 'Yarrow, Colorful',
        slugs: [
            'achillea-millefolium-common-yarrow-prairie-moon-nursery',
            'achillea-millefolium-common-yarrow',
            'achillea-millefolium-yarrow',
            'achillea-millefolium',
        ]
    },
    {
        id: 'F2LduzjI8qAAQbEw0oPQ',
        name: 'Miners Lettuce',
        slugs: [
            'claytonia-perfoliata-miners-lettuce',
            'claytonia-perfoliata',
        ]
    },
    {
        id: 'gZeOJn4ArVqGlwg8VZxG',
        name: 'Chicory, Wild Form',
        slugs: [
            'cichorium-intybus-chicory',
            'cichorium-intybus-common-chicory',
            'cichorium-intybus',
        ]
    },
    {
        id: 'xwnrq9Yav3PPiMGT34HI',
        name: 'Mullein',
        slugs: [
            'verbascum-thapsus-common-mullein',
            'verbascum-thapsus-mullein',
            'verbascum-thapsus',
        ]
    },
    {
        id: '58IygPGuJp0EOpHzNM30',
        name: 'Motherwort',
        slugs: [
            'leonurus-cardiaca-motherwort',
            'leonurus-cardiaca-common-motherwort',
            'leonurus-cardiaca',
        ]
    },
    {
        id: 'XS34etqTQ91MKmC3BzDO',
        name: "St. John's Wort",
        slugs: [
            'hypericum-perforatum-common-st-johns-wort',
            'hypericum-perforatum-st-johns-wort',
            'hypericum-perforatum',
        ]
    },
    {
        id: '5oSqIhofhUGzfXQAs15h',
        name: 'Wormwood',
        slugs: [
            'artemisia-absinthium-wormwood',
            'artemisia-absinthium-common-wormwood',
            'artemisia-absinthium',
        ]
    },
];

async function main() {
    console.log('=== Prairie Moon Image Crawler - Round 2 ===\n');

    const results = { success: [], failed: [] };

    for (let i = 0; i < PLANTS.length; i++) {
        const plant = PLANTS[i];
        console.log(`[${i + 1}/${PLANTS.length}] ${plant.name}`);

        const result = await findProductPage(plant.slugs);
        if (!result) {
            console.log('  Not found on Prairie Moon');
            results.failed.push(plant.name);
            continue;
        }

        console.log(`  Found: ${result.imageUrl.split('/').pop()}`);

        try {
            // Download
            const imgResp = await fetchUrl(result.imageUrl);
            if (imgResp.status !== 200 || imgResp.data.length < 2000) {
                console.log(`  Image download failed or too small (${imgResp.data.length} bytes)`);
                results.failed.push(plant.name);
                continue;
            }

            // Upload to ImgBB
            const slug = plant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const imgbbUrl = await uploadToImgBB(imgResp.data, slug);
            console.log(`  ImgBB: ${imgbbUrl}`);

            // Update Firebase
            await db.collection('products').doc(plant.id).update({
                image: imgbbUrl,
                images: [imgbbUrl],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`  Updated in DB!`);
            results.success.push({ name: plant.name, imgbbUrl });

            await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
            console.log(`  Error: ${e.message}`);
            results.failed.push(plant.name);
        }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Success: ${results.success.length}`);
    results.success.forEach(r => console.log(`  + ${r.name} -> ${r.imgbbUrl}`));
    console.log(`Failed: ${results.failed.length}`);
    results.failed.forEach(n => console.log(`  - ${n}`));

    fs.writeFileSync(__dirname + '/pm-round2-results.json', JSON.stringify(results, null, 2));
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
