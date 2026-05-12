const { https } = require('firebase-functions/v1');
const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const next = require('next');
const path = require('path');
const fs = require('fs');

// Import the warmer function
const { keepWarm } = require('./warmer');

// Create a helper function to ensure required directories exist
const ensureUploadsDirectory = async () => {
    const fs = require('fs').promises;
    const path = require('path');

    try {
        // Main uploads directory
        const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadsPath, { recursive: true });

        // Common subdirectories
        await fs.mkdir(path.join(uploadsPath, 'products'), { recursive: true });
        await fs.mkdir(path.join(uploadsPath, 'products', 'thumbnails'), { recursive: true });
        await fs.mkdir(path.join(uploadsPath, 'general'), { recursive: true });
        await fs.mkdir(path.join(uploadsPath, 'general', 'thumbnails'), { recursive: true });

        console.log('✅ Uploads directory structure created successfully');
    } catch (error) {
        console.error('Error creating uploads directories:', error);
    }
};

const isDev = false;

// Create a Next.js server with the appropriate configuration
const server = next({
    dev: isDev,
    conf: {
        distDir: '.next'
    }
});

// Handle function requests with Next.js
const nextjsHandle = server.getRequestHandler();

// Export the Cloud Function for Firebase
exports.nextServer = onRequest({
    memory: '1GiB',
    timeoutSeconds: 60,
    region: 'us-central1'
}, (req, res) => {
    logger.info('Next.js server request', { url: req.url, originalUrl: req.originalUrl });

    // Log important environment information
    logger.info('Environment information', {
        cwd: process.cwd(),
        nodeEnv: process.env.NODE_ENV,
        functionName: process.env.FUNCTION_NAME,
        functionRegion: process.env.FUNCTION_REGION
    });

    // Return a promise to keep the function warm until Next.js handles the request
    return server.prepare()
        .then(() => {
            // Set cache control headers for better performance
            if (req.url.includes('/_next/static/')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }

            // Handle the request with Next.js
            return nextjsHandle(req, res);
        })
        .catch(error => {
            logger.error('Error handling request', error);
            res.status(500).send(`Internal Server Error: ${error.message}`);
        });
});

// Status endpoint to check the health of functions
exports.status = onRequest((req, res) => {
    // Get the last run time of warmer functions from Firestore or memory
    const lastRun = process.env.LAST_WARMER_RUN || 'No runs recorded yet';
    const version = require('./package.json').version || 'unknown';

    // Return status information
    res.status(200).json({
        status: 'ok',
        version,
        environment: process.env.NODE_ENV,
        function_region: process.env.FUNCTION_REGION || 'unknown',
        warmer: {
            lastRun,
            configured: true,
            baseUrl: process.env.BASE_URL || 'https://hearthfire-farm.web.app'
        },
        timestamp: new Date().toISOString()
    });
});

// Export the warmer function
exports.keepWarm = keepWarm;
