const fs = require('fs');
const path = require('path');
const https = require('https');

// The API key from .env.local
const apiKey = '1ee847a5b670d770d31ba388e577f9b8';

// A small 1x1 transparent GIF base64
const base64Image = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const postData = new URLSearchParams({
    key: apiKey,
    image: base64Image,
    name: 'test-upload'
}).toString();

const options = {
    hostname: 'api.imgbb.com',
    port: 443,
    path: '/1/upload',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
    }
};

console.log('Testing ImgBB API Key...');

const req = https.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Response Body:', JSON.stringify(json, null, 2));

            if (json.success) {
                console.log('SUCCESS: The API key is valid and uploads are working.');
                console.log('Uploaded Image URL:', json.data.url);
            } else {
                console.log('FAILURE: The API key upload failed.');
                if (json.status_code === 400 && json.error.message.includes('API key')) {
                    console.log('DIAGNOSIS: The API key might be invalid or expired.');
                }
            }
        } catch (e) {
            console.log('Could not parse JSON response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('Request Error:', e);
});

req.write(postData);
req.end();
