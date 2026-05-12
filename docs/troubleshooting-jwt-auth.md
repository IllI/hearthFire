# Troubleshooting JWT Authentication with Google Calendar

## Common Issues

### "Invalid JWT Signature" Error

This error typically occurs when the private key used for JWT authentication is not properly formatted. 

#### Possible causes:

1. **Incorrect private key format**
   - The private key must include the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers
   - Newlines must be properly handled (either actual newlines or `\n` characters)
   - No extra quotes or characters should be present outside the key content

2. **Environment variable issues**
   - When stored in `.env` files, the key should be wrapped in quotes
   - Newlines should be represented as `\n`
   
3. **Service account permissions**
   - Ensure the service account has the proper permissions for the Google Calendar API
   - Verify the service account email is correct

## How to Format the Private Key Correctly

### In `.env` files:

```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIB...YOUR_KEY_CONTENT...1QIDAQAw\n-----END PRIVATE KEY-----\n"
```

### In code:

The application includes a helper function that formats the private key correctly:

```javascript
function formatPrivateKey(key) {
  if (!key) return null;
  
  let formattedKey = key;
  
  // 1. Remove any quotes that might be wrapping the key
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    formattedKey = formattedKey.slice(1, -1);
  }
  
  // 2. Replace escaped newlines with actual newlines
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  
  // 3. Ensure BEGIN and END markers are present
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }
  
  // 4. Trim any extra whitespace
  formattedKey = formattedKey.trim();
  
  return formattedKey;
}
```

## Verification Script

You can verify your Google Calendar authentication using the verification script:

```bash
npm run verify-calendar-auth
```

This script will attempt to authenticate with Google Calendar using your current environment variables and report any issues.

## Debug Logging

The application includes detailed logging for authentication issues. Check your server logs for messages containing:
- "Attempting to authorize JWT client"
- "Error authorizing JWT client"
- "Calendar settings initialized with"

These logs can help pinpoint where the authentication is failing. 