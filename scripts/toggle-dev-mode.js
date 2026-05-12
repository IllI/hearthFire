// A script to help toggle the "use mock data" development mode
const fs = require('fs');
const path = require('path');

// Check if we're toggling the mock data on or off
const args = process.argv.slice(2);
const enableMock = args.includes('--enable') || args.includes('-e');
const disableMock = args.includes('--disable') || args.includes('-d');

// Show help if no command provided
if (!enableMock && !disableMock) {
  console.log(`
===============================================
DEVELOPMENT MODE TOGGLE UTILITY
===============================================

This script helps you toggle between using mock data or real data
in development mode.

Options:
  --enable, -e    Enable mock data mode (no real database needed)
  --disable, -d   Disable mock data mode (requires Firebase setup)

Examples:
  node scripts/toggle-dev-mode.js --enable
  node scripts/toggle-dev-mode.js --disable

Note: This only affects development mode, not production.
  `);
  process.exit(0);
}

// Create the .env.development file path
const envPath = path.join(__dirname, '..', '.env.development');

// Content to write depending on mode
const mockModeContent = `
# This file overrides .env.local in development mode
# It forces the app to use mock data instead of real Firebase data

# Set this to "mock" to use mock data, or "real" to use the real Firebase database
NEXT_PUBLIC_DATA_MODE=mock

# Token override for development
NEXT_PUBLIC_DEV_ADMIN_TOKEN=admin-override-token
`;

const realModeContent = `
# This file overrides .env.local in development mode
# It forces the app to use real Firebase data instead of mock data

# Set this to "mock" to use mock data, or "real" to use the real Firebase database
NEXT_PUBLIC_DATA_MODE=real

# No token override - real authentication required
# NEXT_PUBLIC_DEV_ADMIN_TOKEN=
`;

try {
  if (enableMock) {
    fs.writeFileSync(envPath, mockModeContent);
    console.log('✅ Mock data mode ENABLED');
    console.log('The app will now use mock data without requiring a real Firebase database');
  } else if (disableMock) {
    fs.writeFileSync(envPath, realModeContent);
    console.log('✅ Mock data mode DISABLED');
    console.log('The app will now use real data from your Firebase database');
  }
  
  console.log('\nRestart your development server for changes to take effect.\n');
} catch (error) {
  console.error('❌ Error updating development mode:', error.message);
} 