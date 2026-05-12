/**
 * List products missing images
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
}
const db = admin.firestore();

db.collection('products').get().then(snap => {
    const missing = [];
    snap.forEach(doc => {
        const p = doc.data();
        if (!p.image || p.image === '') {
            missing.push(`${p.name} (${p.latinName || ''})`);
        }
    });

    missing.sort();

    console.log(`\nFound ${missing.length} products missing images:\n`);
    missing.forEach(m => console.log(`- ${m}`));

    require('fs').writeFileSync('missing_images_report.txt', missing.join('\n'));
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
