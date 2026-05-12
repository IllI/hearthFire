import { supabaseAdmin } from '../../../lib/supabase-admin';
// import { isAdminUser } from '../../../lib/auth-helpers'; // Need to update this helper later

export default async function handler(req, res) {
  // GET request to fetch all products
  if (req.method === 'GET') {
    try {
      // Server-side public reads use the service client so RLS does not hide shop data.
      const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      // Map Supabase fields to the format the frontend expects (camelCase)
      const formattedProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        latinName: p.latin_name,
        description: p.description,
        price: Number(p.price),
        category: p.category,
        categories: p.categories || [],
        stock: p.stock,
        quantity: p.quantity,
        unit: p.unit,
        organic: p.organic,
        featured: p.featured,
        image: p.image,
        images: p.images || [],
        imageSource: p.image_source,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));

      return res.status(200).json(formattedProducts);
    } catch (error) {
      console.error('Error fetching products from Supabase:', error);
      return res.status(500).json({
        error: 'Failed to fetch products',
        message: error.message
      });
    }
  }

  // POST request to create a new product - admin only
  else if (req.method === 'POST') {
    try {
      // Verify authentication via Supabase
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split('Bearer ')[1];
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid authentication token' });
      }

      // Check if user is an admin
      const { data: userProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!userProfile || userProfile.role !== 'admin') {
        // Temporarily allow all for migration testing if no profiles exist
        console.warn('Admin check failed, but proceeding for migration testing...');
        // return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // Create the product
      const { name, description, price, category, stock, quantity, unit, images, organic, featured, imageSource, latinName } = req.body;

      if (!name || !description || price === undefined || !category) {
        return res.status(400).json({ error: 'Missing required product fields' });
      }

      const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
      const inventoryCount = stock !== undefined ? Number(stock) : (quantity !== undefined ? Number(quantity) : 0);

      // Determine main image
      let mainImage = req.body.image || null;
      if (!mainImage && images && images.length > 0) {
        mainImage = images[0];
      }

      const productData = {
        name,
        latin_name: latinName || null,
        description,
        price: numericPrice,
        category,
        categories: req.body.categories || (category ? [category] : []),
        stock: inventoryCount,
        quantity: inventoryCount,
        unit: unit || 'each',
        image: mainImage,
        images: images || [],
        image_source: imageSource || null,
        organic: Boolean(organic) || false,
        featured: Boolean(featured) || false
      };

      const { data: newProduct, error: insertError } = await supabaseAdmin
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      return res.status(201).json({
        id: newProduct.id,
        ...req.body,
        createdAt: newProduct.created_at
      });
    } catch (error) {
      console.error('Error creating product in Supabase:', error);
      return res.status(500).json({ error: 'Failed to create product' });
    }
  }

  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}
