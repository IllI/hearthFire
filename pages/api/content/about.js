import { supabaseAdmin } from '../../../lib/supabase-admin';

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase content read timed out')), ms))
  ]);
}

function getDefaultAboutContent() {
  return {
    title: 'About Hearthfire Farm',
    content: `
      <p>Welcome to Hearthfire Farm, where we deliver fresh, organic produce directly from our farm to your doorstep.</p>
      <p>Our mission is to provide the highest quality, locally grown organic produce to our community while practicing sustainable farming methods that nurture the land for future generations.</p>
      <h2>Our Story</h2>
      <p>Hearthfire Farm began in 2018 with a simple idea: create a direct connection between local farmers and the community they serve.</p>
      <h2>Our Values</h2>
      <ul>
        <li><strong>Sustainability</strong> - We use regenerative farming practices that build soil health and sequester carbon.</li>
        <li><strong>Community</strong> - We believe in building strong local food systems that connect people to the source of their food.</li>
        <li><strong>Quality</strong> - We grow exceptional produce using organic methods that prioritize flavor and nutrition.</li>
      </ul>
      <p>Thank you for supporting local agriculture and being part of our journey!</p>
    `,
    heroImage: '/images/farm-hero.jpg',
    lastUpdated: new Date().toISOString()
  };
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
        .select('data')
        .eq('id', 'about')
        .single(),
      5000
    );

    if (error && error.code !== 'PGRST116') throw error;

    return res.status(200).json({
      success: true,
      content: data?.data || getDefaultAboutContent()
    });
  } catch (error) {
    console.error('Error fetching about page content from Supabase:', error);
    return res.status(200).json({
      success: true,
      content: getDefaultAboutContent()
    });
  }
}
