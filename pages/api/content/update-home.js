import { verifyAdminAccess } from '../../../lib/admin-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  const auth = await verifyAdminAccess(req, res);
  if (!auth.isAuthenticated) return res.status(401).json({ success: false, error: auth.error || 'Authentication required' });
  if (!auth.isAdmin) return res.status(403).json({ success: false, error: 'Admin privileges required' });

  const { title, subtitle, mainImage, ctaButton, sections } = req.body;
  if (!title || !subtitle) {
    return res.status(400).json({
      success: false,
      error: 'Title and subtitle are required'
    });
  }

  try {
    const payload = {
      title,
      subtitle,
      mainImage: mainImage || null,
      ctaButton: ctaButton || {
        text: 'Browse Produce',
        link: '/products'
      },
      sections: sections || [],
      lastUpdated: new Date().toISOString(),
      updatedBy: auth.user?.uid || auth.user?.email || null
    };

    const { error } = await supabaseAdmin
      .from('content')
      .upsert({
        id: 'home',
        section: 'home',
        data: payload
      });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Home page content updated successfully'
    });
  } catch (error) {
    console.error('Error updating home page content in Supabase:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update home page content'
    });
  }
}
