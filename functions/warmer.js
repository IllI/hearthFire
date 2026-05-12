const { onSchedule } = require('firebase-functions/v2/scheduler');
const fetch = require('node-fetch');

// This function will keep your main function warm by pinging it every 10 minutes
exports.keepWarm = onSchedule({ schedule: 'every 10 minutes' }, async (event) => {
    try {
        // Make a simple request to your site
        const response = await fetch('https://hearthfire-farm.web.app/');
        console.log('Function warmed successfully, status:', response.status);
        return null;
    } catch (error) {
        console.error('Error warming function:', error);
        return null;
    }
});
