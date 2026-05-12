-- ==========================================
-- PROMOTIONS TABLE
-- ==========================================
CREATE TABLE promotions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL, -- 'fixed', 'percentage', 'shipping'
  value NUMERIC(10, 2) DEFAULT 0,
  description TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for code lookups
CREATE INDEX idx_promotions_code ON promotions(code);
CREATE INDEX idx_promotions_active ON promotions(active);

-- Create trigger for updated_at
CREATE TRIGGER update_promotions_modtime BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
