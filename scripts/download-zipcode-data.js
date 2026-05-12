/**
 * Script to download real zipcode GeoJSON data for Atlanta
 * Usage: node scripts/download-zipcode-data.js
 */

const { downloadAtlantaZipcodeData } = require('../lib/fetch-zipcode-data');

async function runDownload() {
  console.log('Starting download of Atlanta zipcode data...');
  
  try {
    const result = await downloadAtlantaZipcodeData();
    
    if (result.success) {
      console.log('✅ Download successful');
      console.log(result.message);
      console.log('The file has been saved to: public/atlanta-zipcodes.json');
      console.log('\nThis file will be used by the zipcode map component to show real boundary data.');
    } else {
      console.error('❌ Download failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error during download:', error);
    process.exit(1);
  }
}

runDownload(); 