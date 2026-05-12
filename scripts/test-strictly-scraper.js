const https = require('https');
const fs = require('fs');

function fetch(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.04472.124 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error('timeout'));
        });
    });
}

async function testSearch() {
    const missing = [
        'Ashwagandha',
        'Holy Basil',
        'Gotu Kola',
        'Spilanthes',
        'White Sage',
        'Motherwort',
        'Wild Dagga',
        'Andrographis',
        'Mullein'
    ];

    console.log('Testing strictlymedicinalseeds.com search...\n');

    for (const term of missing) {
        const searchUrl = `https://strictlymedicinalseeds.com/?s=${encodeURIComponent(term)}&post_type=product`;
        try {
            const html = await fetch(searchUrl);

            // Look for the first product image in the search results
            // Typically WooCommerce uses: <img ... class="attachment-woocommerce_thumbnail ... src="URL" ...>
            // Or looking for specific product wrappers

            // Improved regex to find image src inside a product listing
            const imgRegex = /<img[^>]*class=["'][^"']*attachment-woocommerce_thumbnail[^"']*["'][^>]*src=["']([^"']+)["']/i;
            const match = html.match(imgRegex);

            if (match && match[1]) {
                console.log(`[${term}] FOUND: ${match[1]}`);
            } else {
                console.log(`[${term}] No image found`);
                // checking if maybe we got a direct product page redirect or different structure
                if (html.includes('product_title')) {
                    // Single product page structure
                    const singleImg = /<div[^>]*class=["']woocommerce-product-gallery__image["'][^>]*>.*?<img[^>]*src=["']([^"']+)["']/s;
                    // or simpler
                    const anyMain = /wp-content\/uploads\/[^"']+\.(jpg|png)/i;
                    const m2 = html.match(anyMain);
                    if (m2) console.log(`  (Single Page?) Found: ${m2[0]}`);
                }
            }
        } catch (e) {
            console.log(`[${term}] Error: ${e.message}`);
        }
        // polite delay
        await new Promise(r => setTimeout(r, 1000));
    }
}

testSearch();
