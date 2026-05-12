import { getAuth, getFirestore } from '../../../lib/firebase-admin';
import admin from 'firebase-admin';
const emailService = require('../../../lib/email-service');

/**
 * API route handler for user registration
 * POST /api/auth/register - Registers a new user
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Extract user data from request body
    const { email, password, name, phoneNumber } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields'
      });
    }

    // Initialize Firebase services
    const auth = await getAuth();
    const firestore = await getFirestore();

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phoneNumber || null
    });

    const uid = userRecord.uid;

    // Create user profile in Firestore
    await firestore.collection('users').doc(uid).set({
      displayName: name,
      email,
      phoneNumber,
      role: 'customer',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Send welcome email
    try {
      console.log(`Sending welcome email to new user: ${email}`);
      await emailService.sendAccountRegistrationConfirmation({
        displayName: name,
        email
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail the registration if email sending fails
    }
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid,
        email,
        displayName: name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle Firebase-specific errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ 
        success: false,
        error: 'Email already in use' 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      error: 'Registration failed',
      message: error.message 
    });
  }
} 