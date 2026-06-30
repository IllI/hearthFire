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

  const { title, content, heroImage } = req.body;
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      error: 'Title and content are required'
    });
  }

  try {
    const payload = {
      title,
      content,
      heroImage: heroImage || '/images/farm-hero.jpg',
      lastUpdated: new Date().toISOString(),
      updatedBy: auth.user?.uid || auth.user?.email || null
    };

    const { error } = await supabaseAdmin
      .from('content')
      .upsert({
        id: 'about',
        section: 'about',
        data: payload
      });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'About page content updated successfully'
    });
  } catch (error) {
    console.error('Error updating about page content in Supabase:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update about page content'
    });
  }
}
