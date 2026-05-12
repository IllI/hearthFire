const admin = require('firebase-admin');
const wixImageUrls = require('../wixImageUrls');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'hearthfire-farms-e4de9ee34b5d.json');

// Check if service account file exists, if not trying to use env var or rely on default init
if (fs.existsSync(serviceAccountPath)) {
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
    });
} else {
    // If we don't have the file, we might be in a context where we can't easily init
    // But let's try to use the one from lib if we can't find the file
    console.log("Service account file not found, attempting to use application default credentials or env vars.");
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function restoreImages() {
    console.log('Starting image restoration...');

    try {
        const productsSnapshot = await db.collection('products').get();
        let updatedCount = 0;

        const updates = [];

        for (const doc of productsSnapshot.docs) {
            const product = doc.data();
            const lowerName = product.name.toLowerCase();
            let newImageUrl = null;

            // Exact match first
            if (wixImageUrls[lowerName]) {
                newImageUrl = wixImageUrls[lowerName];
            } else {
                // Partial match
                // Find a key in wixImageUrls that is contained in the product name
                const matchingKey = Object.keys(wixImageUrls).find(key => lowerName.includes(key));
                if (matchingKey) {
                    newImageUrl = wixImageUrls[matchingKey];
                }
            }

            // Special cases based on screenshot
            if (!newImageUrl) {
                if (lowerName.includes('pepper')) newImageUrl = wixImageUrls['pepper'];
                if (lowerName.includes('tomato')) newImageUrl = wixImageUrls['tomato'];
                if (lowerName.includes('kale')) newImageUrl = wixImageUrls['kale'];
            }

            if (newImageUrl) {
                // Check if current image is broken (ImgBB) or missing
                const currentImages = product.images || [];
                const currentImage = currentImages.length > 0 ? currentImages[0] : null;

                // If it's an ImgBB url or missing, replace it
                if (!currentImage || currentImage.includes('ibb.co') || currentImage.includes('imgbb')) {
                    console.log(`Updating ${product.name}:`);
                    console.log(`  Old: ${currentImage}`);
                    console.log(`  New: ${newImageUrl}`);

                    updates.push(doc.ref.update({
                        images: [newImageUrl],
                        // Also update the 'image' field if it exists, for backward compatibility
                        image: newImageUrl
                    }));
                    updatedCount++;
                }
            } else {
                console.log(`No matching image found for: ${product.name}`);
            }
        }

        await Promise.all(updates);
        console.log(`\nSuccessfully updated ${updatedCount} products.`);

    } catch (error) {
        console.error('Error restoring images:', error);
    }
}

restoreImages();
