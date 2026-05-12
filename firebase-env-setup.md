# Setting Up Email Environment Variables in Firebase

To ensure your email functionality works properly when deployed, you need to set up environment variables in Firebase. Here's how to do it:

## Using Firebase CLI

1. Install the Firebase CLI if you haven't already:
   ```bash
   npm install -g firebase-tools
   ```

2. Log in to Firebase:
   ```bash
   firebase login
   ```

3. Set environment variables for your Firebase project:
   ```bash
   firebase functions:config:set email.host="mail.spaceship.com" email.port="587" email.secure="false" email.user="info@hearthfirefarm.com" email.password="a87393F9-332e-4791-Af60-ae79Ae916703"
   ```

## Using Firebase Console

If you're using Firebase Hosting with Cloud Functions, you can also set environment variables through the Firebase Console:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Project Settings > Service accounts > Environment variables
4. Add the following environment variables:
   - `EMAIL_HOST`: mail.spaceship.com
   - `EMAIL_PORT`: 587
   - `EMAIL_SECURE`: false
   - `EMAIL_USER`: info@hearthfirefarm.com
   - `EMAIL_PASSWORD`: a87393F9-332e-4791-Af60-ae79Ae916703

## Vercel Deployment

If you're deploying to Vercel, set these environment variables in your project settings:

1. Go to the [Vercel Dashboard](https://vercel.com/)
2. Select your project
3. Go to Settings > Environment Variables
4. Add the same environment variables as listed above

## Accessing Environment Variables in Your Code

With Next.js, you can access these environment variables in your server-side code (API routes, getServerSideProps, etc.) using `process.env.EMAIL_HOST`, etc.

## Security Considerations

- Make sure your `.env.local` file is listed in `.gitignore` to prevent it from being committed to your repository.
- Consider using a secrets management solution for production environments.
- Regularly rotate passwords and update your environment variables accordingly.

## Testing Your Configuration

After deploying, visit `/admin/test-email` on your deployed site to test that the email configuration is working correctly. 