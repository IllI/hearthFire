import { supabaseAdmin } from '../../../lib/supabase-admin';

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase content read timed out')), ms))
  ]);
}

function getDefaultHomeContent() {
  return {
    title: 'Fresh from Hearthfire Farm to Your Door',
    subtitle: 'Order fresh, organic produce from our hearth to your home.',
    mainImage: '/images/farm-bg.jpg',
    ctaButton: {
      text: 'Browse Produce',
      link: '/products'
    },
    sections: [
      {
        title: 'Our Farm to Your Table',
        content: `<p>Hearthfire Farm is committed to growing the highest quality organic produce using sustainable farming practices.</p>`,
        image: '/images/farm-produce.jpg',
        button: {
          text: 'View Our Products',
          link: '/products'
        }
      },
      {
        title: 'Weekly Delivery & Pickup',
        content: `<p>We offer convenient delivery options to select zip codes in our area, bringing farm-fresh produce directly to your doorstep.</p>`,
        image: '/images/delivery.jpg',
        button: {
          text: 'Check Availability',
          link: '/cart'
        }
      }
    ],
    lastUpdated: new Date().toISOString()
  };
}

function sanitizeHomeContent(content) {
  const defaultImages = ['/images/farm-bg.jpg', '/images/farm-produce.jpg', '/images/delivery.jpg'];
  const isLocalUpload = (url) => url && (url.startsWith('/uploads/') || url.startsWith('uploads/'));
  const sanitized = { ...content };

  if (isLocalUpload(sanitized.mainImage)) {
    sanitized.mainImage = defaultImages[0];
  }

  if (sanitized.sections) {
    sanitized.sections = sanitized.sections.map((section, index) => ({
      ...section,
      image: isLocalUpload(section.image) ? (defaultImages[index + 1] || defaultImages[1]) : section.image
    }));
  }

  return sanitized;
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
        .eq('id', 'home')
        .single(),
      5000
    );

    if (error && error.code !== 'PGRST116') throw error;

    return res.status(200).json({
      success: true,
      content: sanitizeHomeContent(data?.data || getDefaultHomeContent())
    });
  } catch (error) {
    console.error('Error fetching home page content from Supabase:', error);
    return res.status(200).json({
      success: true,
      content: getDefaultHomeContent()
    });
  }
}
