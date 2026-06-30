import { supabaseAdmin } from '../../../lib/supabase-admin';

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase content read timed out')), ms))
  ]);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from('content')
        .select('id,data,updated_at')
        .order('id', { ascending: true }),
      5000
    );

    if (error) throw error;

    const pages = (data || []).map((row) => ({
      id: row.id,
      title: row.data?.title || row.id,
      lastUpdated: row.data?.lastUpdated || row.updated_at,
      updatedBy: row.data?.updatedBy || null
    }));

    return res.status(200).json({ success: true, pages });
  } catch (error) {
    console.error('Error fetching content pages from Supabase:', error);
    return res.status(200).json({ success: true, pages: [] });
  }
}
