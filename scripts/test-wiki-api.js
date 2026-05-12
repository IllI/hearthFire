const https = require('https');

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function testWiki(latinName) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(latinName)}&prop=pageimages&format=json&pithumbsize=500`;
    try {
        const data = await fetch(url);
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') {
            console.log(`[${latinName}] Page not found`);
            return;
        }
        const page = pages[pageId];
        if (page.thumbnail) {
            console.log(`[${latinName}] FOUND: ${page.thumbnail.source}`);
        } else {
            console.log(`[${latinName}] Page found but no thumbnail`);
        }
    } catch (e) {
        console.log(`[${latinName}] Error: ${e.message}`);
    }
}

async function run() {
    const plants = [
        'Withania somnifera', // Ashwagandha
        'Ocimum tenuiflorum', // Holy Basil
        'Centella asiatica',  // Gotu Kola
        'Leonurus cardiaca',  // Motherwort
        'Verbascum thapsus',  // Mullein
        'Matricaria chamomilla' // Chamomile (checking synonym)
    ];

    for (const p of plants) {
        await testWiki(p);
    }
}

run();
