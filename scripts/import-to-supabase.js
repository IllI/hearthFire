const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Ideally use a service role key for migrations to bypass RLS, but falling back to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase URL or Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Find the most recent backup folder
function getLatestBackupDir() {
  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    console.error('❌ No backups directory found.');
    process.exit(1);
  }
  
  const dirs = fs.readdirSync(backupsDir)
    .filter(f => fs.statSync(path.join(backupsDir, f)).isDirectory() && f.startsWith('backup_'))
    .sort((a, b) => b.localeCompare(a)); // Sort descending

  if (dirs.length === 0) {
    console.error('❌ No backup folders found.');
    process.exit(1);
  }

  return path.join(backupsDir, dirs[0], 'db');
}

async function importProducts(dbDir) {
  const filePath = path.join(dbDir, 'products.json');
  if (!fs.existsSync(filePath)) return;

  console.log('📦 Importing Products...');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = Object.entries(data).map(([key, p]) => ({
    id: p.id || key,
    name: p.name,
    latin_name: p.latinName || null,
    description: p.description || null,
    price: p.price || 0,
    category: p.category || null,
    categories: p.categories || [],
    stock: p.stock || 0,
    quantity: p.quantity || 0,
    unit: p.unit || null,
    organic: p.organic || false,
    featured: p.featured || false,
    image: p.image || null,
    images: p.images || [],
    image_source: p.imageSource || null,
    created_at: p.createdAt ? new Date(p.createdAt._seconds ? p.createdAt._seconds * 1000 : (p.createdAt.seconds * 1000)).toISOString() : new Date().toISOString(),
    updated_at: p.updatedAt ? new Date(p.updatedAt._seconds ? p.updatedAt._seconds * 1000 : (p.updatedAt.seconds * 1000)).toISOString() : new Date().toISOString()
  }));

  // Insert in batches of 100
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const { error } = await supabase.from('products').upsert(batch);
    if (error) {
      console.error('❌ Error inserting products batch:', error.message);
    } else {
      console.log(`✅ Inserted products ${i + 1} to ${i + batch.length}`);
    }
  }
}

async function importOrders(dbDir) {
  const filePath = path.join(dbDir, 'orders.json');
  if (!fs.existsSync(filePath)) return;

  console.log('📦 Importing Orders...');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = Object.entries(data).map(([key, o]) => ({
    id: o.id || key,
    items: o.items || [],
    subtotal: o.subtotal || 0,
    tax: o.tax || 0,
    delivery_fee: o.deliveryFee || 0,
    total: o.total || 0,
    status: o.status || 'pending',
    order_type: o.orderType || 'pickup',
    
    // Customer mapping
    customer_name: o.customerName || (o.customer && o.customer.name) || null,
    customer_email: o.customerEmail || (o.customer && o.customer.email) || null,
    customer_phone: o.customerPhone || (o.customer && o.customer.phone) || null,
    
    // Payment mapping
    payment_method: o.paymentMethod || (o.payment && o.payment.method) || null,
    payment_status: o.paymentStatus || (o.payment && o.payment.status) || 'pending',
    
    pickup_info: o.pickupInfo || null,
    delivery_info: o.deliveryInfo || null,
    
    created_at: o.createdAt ? new Date(o.createdAt._seconds ? o.createdAt._seconds * 1000 : (o.createdAt.seconds * 1000)).toISOString() : new Date().toISOString(),
    updated_at: o.updatedAt ? new Date(o.updatedAt._seconds ? o.updatedAt._seconds * 1000 : (o.updatedAt.seconds * 1000)).toISOString() : new Date().toISOString()
  }));

  // Insert in batches of 100
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const { error } = await supabase.from('orders').upsert(batch);
    if (error) {
      console.error('❌ Error inserting orders batch:', error.message);
    } else {
      console.log(`✅ Inserted orders ${i + 1} to ${i + batch.length}`);
    }
  }
}

async function importCategories(dbDir) {
    const filePath = path.join(dbDir, 'categories.json');
    if (!fs.existsSync(filePath)) return;
  
    console.log('📦 Importing Categories...');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const records = Object.entries(data).map(([key, c]) => ({
      id: c.id || c.slug || key,
      name: c.name,
      slug: c.slug,
      description: c.description || null,
      image: c.image || null,
      sort_order: c.sortOrder || 0
    }));
  
    if(records.length > 0) {
        const { error } = await supabase.from('categories').upsert(records);
        if (error) console.error('❌ Error inserting categories:', error.message);
        else console.log(`✅ Inserted ${records.length} categories`);
    }
}

async function importDeliverySchedules(dbDir) {
    const filePath = path.join(dbDir, 'deliverySchedules.json');
    if (!fs.existsSync(filePath)) return;
  
    console.log('📦 Importing Delivery Schedules...');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const records = Object.entries(data).map(([key, ds]) => ({
      id: ds.id || key,
      name: ds.name || ds.locationName || key,
      address: ds.address,
      type: ds.type || (ds.isDelivery ? 'delivery' : 'pickup'),
      schedule_date: ds.date ? new Date(ds.date).toISOString().split('T')[0] : null,
      slots: ds.slots || ds.timeSlots || [],
      time_slots: ds.timeSlots || ds.slots || [],
      zip_codes: ds.zipCodes || [],
      location: ds.location || '',
      location_details: ds.locationDetails || null,
      cutoff_time: ds.cutoffTime || null,
      notes: ds.notes || ds.note || '',
      google_calendar_event_id: ds.googleCalendarEventId || null,
      is_active: ds.isActive !== undefined ? ds.isActive : true,
      capacity: ds.capacity || null,
      last_updated: ds.lastUpdated
        ? new Date(ds.lastUpdated._seconds ? ds.lastUpdated._seconds * 1000 : ds.lastUpdated).toISOString()
        : null
    }));
  
    if(records.length > 0) {
        const { error } = await supabase.from('delivery_schedules').upsert(records);
        if (error) console.error('❌ Error inserting delivery schedules:', error.message);
        else console.log(`✅ Inserted ${records.length} delivery schedules`);
    }
}

async function main() {
  console.log('🚀 Starting Data Import to Supabase...');
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️  WARNING: Running import without SUPABASE_SERVICE_ROLE_KEY.');
      console.warn('⚠️  If Row Level Security (RLS) is enabled on your tables, this import will likely fail!');
  }

  const dbDir = getLatestBackupDir();
  console.log(`📂 Reading backup from: ${dbDir}`);

  // It's best to run these sequentially to avoid overwhelming connection limits
  await importCategories(dbDir);
  await importProducts(dbDir);
  await importDeliverySchedules(dbDir);
  await importOrders(dbDir);
  
  console.log('🎉 Import Complete!');
}

main().catch(console.error);
