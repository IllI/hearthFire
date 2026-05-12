/**
 * Script to enable development mode with relaxed authentication for testing
 * This script adds environment variables to the .env.development.local file
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Path to .env.development.local file
const envFilePath = path.join(process.cwd(), '.env.development.local');

// Check for --disable flag
const disableFlag = process.argv.includes('--disable');

// Function to create or update the environment file
function updateEnvFile(enableDevAuth) {
  console.log(`Setting development auth bypass to: ${enableDevAuth ? 'ENABLED' : 'DISABLED'}`);
  
  // Create the content for the environment file
  let envContent = '';
  
  // First, try to read existing file
  try {
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, 'utf8');
      console.log('Reading existing .env.development.local file');
    }
  } catch (error) {
    console.log('No existing .env.development.local file found, creating new one');
  }
  
  // Parse existing env file
  const existingEnv = dotenv.parse(envContent);
  
  // Update the SKIP_ADMIN_AUTH variable
  existingEnv.SKIP_ADMIN_AUTH = enableDevAuth ? 'true' : 'false';
  
  // Create the new content
  const newEnvContent = Object.entries(existingEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  // Write the file
  fs.writeFileSync(envFilePath, newEnvContent);
  
  console.log(`✅ Updated .env.development.local with SKIP_ADMIN_AUTH=${existingEnv.SKIP_ADMIN_AUTH}`);
  console.log(`🔑 Authentication in development mode is now ${enableDevAuth ? 'RELAXED' : 'ENFORCED'}`);
  
  if (enableDevAuth) {
    console.log('\n🚨 IMPORTANT: This setting is for development only!');
    console.log('   All admin authentication will be bypassed.');
    console.log('   Run this script with --disable to re-enable authentication checks.');
  } else {
    console.log('\n🔒 Authentication checks are now enforced in development mode.');
    console.log('   Run this script without --disable to relax authentication for testing.');
  }
}

// Main execution
try {
  updateEnvFile(!disableFlag);
} catch (error) {
  console.error('Error updating environment file:', error);
  process.exit(1);
} 