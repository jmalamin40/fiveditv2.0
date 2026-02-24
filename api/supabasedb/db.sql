/*
  # E-Commerce Database Schema – FINAL VERSION (corrected)
  
  Fixes applied:
  - Removed conflicting "Authenticated users can view all orders" policy
  - Added missing GRANT INSERT, SELECT ON order_items TO anon
  - Added execute_sql utility function
  - Cleaned up policy drop order to avoid errors
  
  All migrations in order:
  20260221161529_create_ecommerce_tables
  20260221180000_add_theme_config
  20260222000000_add_store_content_fields
  20260222120000_add_product_long_description
  20260222130000_add_services_bar_colors
  20260222140000_add_user_profiles_and_order_user
  20260222150000_orders_allow_anon_insert
  20260222160000_add_currency_settings
  20260222170000_add_digital_products
  20260222180000_get_order_items_for_customer
*/

-- ========== 1. Base tables ==========

-- Site Settings Table
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text DEFAULT 'My Store',
  site_title text DEFAULT 'E-Commerce Store',
  site_logo text DEFAULT '',
  facebook_pixel_id text DEFAULT '',
  payment_gateway_enabled boolean DEFAULT false,
  payment_gateway_config jsonb DEFAULT '{}',
  theme_config jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

COMMENT ON COLUMN site_settings.theme_config IS 'Theme options: primaryColor, backgroundColor, accentColor, fontFamily, borderRadius';

-- Insert default settings row
INSERT INTO site_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text DEFAULT '',
  price decimal(10, 2) NOT NULL,
  image_url text DEFAULT '',
  stock integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text DEFAULT '',
  customer_address text DEFAULT '',
  payment_method text NOT NULL CHECK (payment_method IN ('cod', 'online')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  order_status text DEFAULT 'pending' CHECK (order_status IN ('pending', 'processing', 'completed', 'cancelled')),
  total_amount decimal(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  product_price decimal(10, 2) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  subtotal decimal(10, 2) NOT NULL
);

-- ========== 2. RLS ==========

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Site Settings Policies
CREATE POLICY "Anyone can view site settings"
  ON site_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can update site settings"
  ON site_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Products Policies
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (true);

-- Orders Policies
-- NOTE: "Authenticated users can view all orders" intentionally removed
-- to avoid conflict with per-user policy added in migration 8.
-- Admins should use service_role key to bypass RLS for full order access.

CREATE POLICY "Authenticated users can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Order Items Policies
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

-- ========== 3. Indexes ==========

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ========== 4. Store content fields ==========

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS promo_bar_enabled boolean DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS promo_bar_text text DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_heading text DEFAULT 'Brand New Collection';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_description text DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_bullets jsonb DEFAULT '["Top Brands", "High Quality", "Free Delivery"]';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_button_text text DEFAULT 'EXPLORE SHOP';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_button_link text DEFAULT '#';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_image_url text DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[
  {"icon": "payment", "title": "Secure Payment", "subtitle": "100% secure payment"},
  {"icon": "return", "title": "30 Days Return", "subtitle": "If goods have problems"},
  {"icon": "support", "title": "24/7 Support", "subtitle": "Dedicated support"},
  {"icon": "delivery", "title": "Free Delivery", "subtitle": "For all order over 80$"}
]';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS gallery_section jsonb DEFAULT '[]';

ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price decimal(10, 2) DEFAULT NULL;

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS about_heading text DEFAULT 'About Us';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS about_content text DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS contact_heading text DEFAULT 'Contact Us';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS contact_email text DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS contact_phone text DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS contact_address text DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS contact_extra text DEFAULT '';

-- ========== 5. Product long description ==========

ALTER TABLE products ADD COLUMN IF NOT EXISTS long_description text DEFAULT '';

-- ========== 6. Services bar & gallery colors ==========

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS services_bar_background_color text DEFAULT '#111827';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS services_bar_text_color text DEFAULT '#ffffff';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS gallery_section_background_color text DEFAULT '#111827';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS gallery_section_text_color text DEFAULT '#ffffff';

-- ========== 7. User profiles & orders.user_id ==========

ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can only see their own orders (FIX: replaces the broad "view all" policy)
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ========== 8. Guest checkout (anon insert/select orders) ==========

DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anon and authenticated can create orders" ON orders;
CREATE POLICY "Anon and authenticated can create orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can select guest orders" ON orders;
CREATE POLICY "Anon can select guest orders"
  ON orders FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- FIX: Added missing order_items grants for anon
GRANT INSERT, SELECT ON orders TO anon;
GRANT INSERT, SELECT ON orders TO authenticated;
GRANT INSERT, SELECT ON order_items TO anon;
GRANT INSERT, SELECT ON order_items TO authenticated;

-- ========== 9. Currency settings ==========

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'USD';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS currency_symbol text DEFAULT '$';

-- ========== 10. Digital products ==========

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_digital boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_file_url text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS digital_file_url text;

-- ========== 11. Secure order items for customer ==========

CREATE OR REPLACE FUNCTION get_order_items_for_customer(p_order_id uuid)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  product_id uuid,
  product_name text,
  product_price decimal,
  quantity integer,
  subtotal decimal,
  digital_file_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.id,
    oi.order_id,
    oi.product_id,
    oi.product_name,
    oi.product_price,
    oi.quantity,
    oi.subtotal,
    CASE WHEN o.payment_status = 'paid' THEN oi.digital_file_url ELSE NULL END AS digital_file_url
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.order_id = p_order_id
    AND (o.user_id = auth.uid() OR o.user_id IS NULL)
  ORDER BY oi.product_name;
$$;

GRANT EXECUTE ON FUNCTION get_order_items_for_customer(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_order_items_for_customer(uuid) TO authenticated;

-- ========== 12. Utility: execute_sql (admin use only via service_role) ==========

CREATE OR REPLACE FUNCTION public.execute_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO service_role;
