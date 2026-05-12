-- Initial Schema Migration for Hearthfire Farms (Firestore to Supabase)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- PRODUCTS
-- ==========================================
CREATE TABLE products (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  latin_name TEXT,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  category TEXT,
  categories TEXT[] DEFAULT '{}',
  stock INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER DEFAULT 0,
  unit TEXT,
  organic BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  image TEXT,
  images TEXT[] DEFAULT '{}',
  image_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ORDERS
-- ==========================================
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  items JSONB NOT NULL DEFAULT '[]', -- Array of items: { productId, name, price, quantity, unit, subtotal }
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  delivery_fee NUMERIC(10, 2) DEFAULT 0.00,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending',
  order_type TEXT NOT NULL, -- 'pickup' or 'delivery'
  
  -- Customer Details (flattened from Firestore)
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- If linked to Auth
  
  -- Payment Details
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  stripe_session_id TEXT,
  
  -- Logistics Info
  pickup_info JSONB,   -- { locationId, locationName, address, date, instructions, calendarEventId }
  delivery_info JSONB, -- { date, timeSlot, scheduleId, phone, address: { street, city, state, zip }, instructions }
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- USERS (Profiles linked to Supabase Auth)
-- ==========================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'customer', -- 'admin', 'customer', etc.
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- DELIVERY SCHEDULES / PICKUP LOCATIONS
-- ==========================================
CREATE TABLE delivery_schedules (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  address TEXT,
  type TEXT NOT NULL, -- 'pickup', 'delivery'
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  is_active BOOLEAN DEFAULT true,
  capacity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CONTENT (Home page content, blocks, etc)
-- ==========================================
CREATE TABLE content (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CATEGORIES
-- ==========================================
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_modtime BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_schedules_modtime BEFORE UPDATE ON delivery_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_modtime BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_modtime BEFORE UPDATE ON content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
