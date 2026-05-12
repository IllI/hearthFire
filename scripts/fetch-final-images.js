/**
 * Final Image Fetcher
 * Handling the tricky 14 remaining products with manual name overrides and robust URL handling.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');
const https = require('https');
const FormData = require('form-data');
const fetch = require('node-fetch');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
}
const db = admin.firestore();
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '93d42a3af8827220fb00930836b61a44';

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

function fetchImage(url) {
    return new Promise((resolve, reject) => {
        // Ensure URL is properly encoded
        const encodedUrl = encodeURI(url);
        https.get(encodedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Status ${res.statusCode}`));
                return;
            }
            let data = [];
            res.on('data', c => data.push(c));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}

async function uploadToImgBB(buffer, name) {
    const fd = new FormData();
    fd.append('image', buffer.toString('base64'));
    fd.append('name', name);
    const r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
    const j = await r.json();
    if (j.success) return j.data.url;
    throw new Error(j.error ? j.error.message : 'Upload failed');
}

async function getWikiImage(term) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(term)}&prop=pageimages&format=json&pithumbsize=800`;
    const data = await fetchJson(url);
    const pageId = Object.keys(data.query.pages)[0];
    if (pageId === '-1' || !data.query.pages[pageId].thumbnail) return null;
    return data.query.pages[pageId].thumbnail.source;
}

const TASKS = [
    // 1. Fix uploads that failed (likely encoding issues)
    { name: 'Andrographis', term: 'Andrographis paniculata' },
    { name: 'Lemongrass', term: 'Cymbopogon citratus' },
    { name: 'Milkweed, Redring', term: 'Asclepias variegata' },
    { name: 'Common Madder', term: 'Rubia tinctorum' },
    { name: 'Holy Basil, Vana', term: 'Ocimum gratissimum' },
    { name: 'Chamomile', term: 'Matricaria chamomilla' }, // Specific override
    { name: 'Gotu Kola', term: 'Centella asiatica' },
    { name: 'Hairy Woodmint', term: 'Blephilia hirsuta' },

    // 2. Search Not Found - use Synonyms
    { name: 'Wild Dagga', term: 'Leonotis leonurus' }, // Correct spelling
    { name: 'Holy Basil, Temperate', term: 'Ocimum americanum' }, // Synonym
    { name: 'New Zealand Spinach', term: 'Tetragonia tetragonioides' },
    { name: 'Chicory, Wild Form', term: 'Cichorium intybus' },
    { name: 'Spilanthes', term: 'Acmella oleracea' },
    { name: 'Sorrel, Garden', term: 'Rumex acetosa' },
];

async function run() {
    console.log('=== Final Image Fetcher ===');

    // Lookup Ids
    const snap = await db.collection('products').get();
    const map = {};
    snap.forEach(d => map[d.data().name] = d.id);

    for (const t of TASKS) {
        const id = map[t.name];
        if (!id) { console.log(`[SKIP] ID not found for ${t.name}`); continue; }

        console.log(`Processing: ${t.name} (Source: ${t.term})`);
        try {
            const imgUrl = await getWikiImage(t.term);
            if (!imgUrl) {
                console.log('  ❌ Not found on Wiki');
                continue;
            }

            const buf = await fetchImage(imgUrl);
            const bbUrl = await uploadToImgBB(buf, t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

            await db.collection('products').doc(id).update({
                image: bbUrl,
                images: [bbUrl],
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`  ✅ Done: ${bbUrl}`);
        } catch (e) {
            console.log(`  ❌ Error: ${e.message}`);
        }
    }
}

run();
