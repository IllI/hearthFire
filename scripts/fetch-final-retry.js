/**
 * Final retry - slower pace to avoid rate limits
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');
const https = require('https');
const FormData = require('form-data');
const nodeFetch = require('node-fetch');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
}
const db = admin.firestore();
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '93d42a3af8827220fb00930836b61a44';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'HearthfireFarmBot/1.0 (info@hearthfirefarm.com)' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

function fetchImage(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        https.get(parsedUrl, { headers: { 'User-Agent': 'HearthfireFarmBot/1.0' } }, (res) => {
            if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
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
    const r = await nodeFetch('https://api.imgbb.com/1/upload?key=' + IMGBB_API_KEY, { method: 'POST', body: fd });
    const j = await r.json();
    if (j.success) return j.data.url;
    throw new Error(j.error ? j.error.message : 'Upload failed');
}

async function getWikiImage(searchTerms) {
    // Try each search term in order
    for (const term of searchTerms) {
        const url = 'https://en.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(term) + '&prop=pageimages&format=json&pithumbsize=600';
        const data = await fetchJson(url);
        const pageId = Object.keys(data.query.pages)[0];
        if (pageId !== '-1' && data.query.pages[pageId].thumbnail) {
            return data.query.pages[pageId].thumbnail.source;
        }
        await sleep(1000); // Be polite between lookups
    }
    return null;
}

// Remaining 11 with multiple search term options
const TASKS = [
    { name: 'Andrographis', terms: ['Andrographis paniculata', 'Andrographis'] },
    { name: 'Chamomile', terms: ['Matricaria chamomilla', 'Chamomile', 'German chamomile'] },
    { name: 'Chicory, Wild Form', terms: ['Cichorium intybus', 'Chicory', 'Common chicory'] },
    { name: 'Gotu Kola', terms: ['Centella asiatica', 'Gotu kola'] },
    { name: 'Hairy Woodmint', terms: ['Blephilia hirsuta', 'Hairy wood mint'] },
    { name: 'Holy Basil, Temperate', terms: ['Ocimum americanum', 'Ocimum africanum', 'African basil'] },
    { name: 'Holy Basil, Vana', terms: ['Ocimum gratissimum', 'Clove basil'] },
    { name: 'New Zealand Spinach', terms: ['Tetragonia tetragonioides', 'New Zealand spinach'] },
    { name: 'Sorrel, Garden', terms: ['Rumex acetosa', 'Sorrel', 'Common sorrel'] },
    { name: 'Spilanthes', terms: ['Acmella oleracea', 'Toothache plant', 'Spilanthes'] },
    { name: 'Wild Dagga', terms: ['Leonotis leonurus', 'Wild dagga', "Lion's tail"] },
];

async function run() {
    // Build name -> id map
    const snap = await db.collection('products').get();
    const idMap = {};
    snap.forEach(d => { const p = d.data(); if (!p.image || p.image === '') idMap[p.name] = d.id; });

    console.log('=== Final Retry (11 remaining) ===\n');

    const success = [];
    const failed = [];

    for (const task of TASKS) {
        const id = idMap[task.name];
        if (!id) { console.log('[SKIP] ' + task.name + ' already has image or not found'); continue; }

        console.log('Processing: ' + task.name);

        try {
            const imgUrl = await getWikiImage(task.terms);
            if (!imgUrl) { console.log('  Not found'); failed.push(task.name); await sleep(3000); continue; }
            console.log('  Wiki: ' + imgUrl.substring(0, 80) + '...');

            await sleep(2000); // Wait before downloading

            const buf = await fetchImage(imgUrl);
            console.log('  Downloaded: ' + buf.length + ' bytes');

            if (buf.length < 1000) { console.log('  Too small, skipping'); failed.push(task.name); continue; }

            await sleep(2000); // Wait before uploading

            const slug = task.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const bbUrl = await uploadToImgBB(buf, slug);
            console.log('  ImgBB: ' + bbUrl);

            await db.collection('products').doc(id).update({
                image: bbUrl, images: [bbUrl],
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('  Updated!');
            success.push(task.name);

        } catch (e) {
            console.log('  Error: ' + e.message);
            failed.push(task.name);
        }

        await sleep(5000); // 5 second gap between plants
    }

    console.log('\n=== DONE ===');
    console.log('Success: ' + success.length + ' -> ' + success.join(', '));
    console.log('Failed: ' + failed.length + ' -> ' + failed.join(', '));
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
