import { supabaseAdmin } from '../../../lib/supabase-admin';
const emailService = require('../../../lib/email-service');

async function hasNoProfiles() {
  const { count, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id', { count: 'exact', head: true });

  if (error) throw error;
  return (count || 0) === 0;
}

/**
 * API route handler for user registration
 * GET /api/auth/register - Reports whether this is the first user
 * POST /api/auth/register - Registers a new user
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      return res.status(200).json({ noUsers: await hasNoProfiles() });
    } catch (error) {
      console.error('Error checking user count:', error);
      return res.status(500).json({ error: 'Could not check user count' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { email, password, name, phoneNumber, role = 'customer', adminCode } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const firstUser = await hasNoProfiles();
    const requestedRole = role === 'admin' ? 'admin' : 'customer';

    if (
      requestedRole === 'admin' &&
      !firstUser &&
      adminCode !== process.env.NEXT_PUBLIC_ADMIN_CODE
    ) {
      return res.status(403).json({
        success: false,
        error: 'Invalid admin code'
      });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: name,
        phone: phoneNumber || ''
      },
      app_metadata: {
        role: requestedRole
      }
    });

    if (createError) throw createError;

    const user = created.user;
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: user.id,
        email,
        display_name: name,
        phone: phoneNumber || null,
        role: requestedRole,
        updated_at: new Date().toISOString()
      });

    if (profileError) throw profileError;

    try {
      await emailService.sendAccountRegistrationConfirmation({
        displayName: name,
        email
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    return res.status(200).json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid: user.id,
        email: user.email,
        displayName: name,
        role: requestedRole
      }
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.message?.toLowerCase().includes('already')) {
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
