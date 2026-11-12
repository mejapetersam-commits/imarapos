-- Imarapos core schema (plain Postgres + Neon Auth). Tenant key: business_id. Money NUMERIC(14,2), qty NUMERIC(14,3).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE business_role AS ENUM ('owner','manager','cashier');
CREATE TYPE payment_method AS ENUM ('cash','mpesa','card','bank_transfer','credit');
CREATE TYPE payment_status AS ENUM ('pending','confirmed','failed','cancelled');
CREATE TYPE sale_status AS ENUM ('draft','pending_payment','completed','voided','refunded');
CREATE TYPE po_status AS ENUM ('draft','ordered','received','cancelled');
CREATE TYPE movement_reason AS ENUM ('opening','purchase','sale','return','adjustment','damage','transfer');

CREATE FUNCTION app_user() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
CREATE FUNCTION app_business() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.business_id', true), '')::uuid $$;

CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  currency char(3) NOT NULL DEFAULT 'KES',
  owner_id uuid NOT NULL REFERENCES neon_auth."user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, address text, is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id), UNIQUE (business_id, name)
);
CREATE TABLE business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  role business_role NOT NULL, branch_id uuid, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id),
  FOREIGN KEY (business_id, branch_id) REFERENCES branches (business_id, id)
);
CREATE TABLE business_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email text NOT NULL, role business_role NOT NULL CHECK (role <> 'owner'),
  token_hash text NOT NULL UNIQUE, invited_by uuid NOT NULL REFERENCES neon_auth."user"(id),
  expires_at timestamptz NOT NULL, accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id), UNIQUE (business_id, name)
);
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, phone text, email text, address text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (business_id, id)
);
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sku text NOT NULL, barcode text, name text NOT NULL, category_id uuid, supplier_id uuid,
  cost_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  low_stock_threshold numeric(14,3) NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id), UNIQUE (business_id, sku),
  FOREIGN KEY (business_id, category_id) REFERENCES categories (business_id, id),
  FOREIGN KEY (business_id, supplier_id) REFERENCES suppliers (business_id, id)
);
CREATE UNIQUE INDEX products_barcode_uq ON products (business_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX products_name_idx ON products (business_id, lower(name));
CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, product_id uuid NOT NULL,
  storage_key text NOT NULL, thumb_key text, width int, height int, bytes int,
  is_primary boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (business_id, product_id) REFERENCES products (business_id, id) ON DELETE CASCADE
);
CREATE TABLE inventory (
  business_id uuid NOT NULL, product_id uuid NOT NULL,
  quantity_on_hand numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, product_id),
  FOREIGN KEY (business_id, product_id) REFERENCES products (business_id, id) ON DELETE CASCADE
);
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, product_id uuid NOT NULL,
  quantity_delta numeric(14,3) NOT NULL CHECK (quantity_delta <> 0),
  reason movement_reason NOT NULL, note text, reference_type text, reference_id uuid,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (business_id, product_id) REFERENCES products (business_id, id) ON DELETE CASCADE
);
CREATE INDEX stock_movements_product_idx ON stock_movements (business_id, product_id, created_at DESC);
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, phone text, email text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (business_id, id)
);
CREATE INDEX customers_search_idx ON customers (business_id, lower(name), phone);
CREATE TABLE customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, customer_id uuid NOT NULL,
  label text, address text NOT NULL, town text, is_primary boolean NOT NULL DEFAULT false,
  FOREIGN KEY (business_id, customer_id) REFERENCES customers (business_id, id) ON DELETE CASCADE
);
CREATE TABLE credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, customer_id uuid NOT NULL,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  balance numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  terms_days int NOT NULL DEFAULT 30, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, customer_id),
  FOREIGN KEY (business_id, customer_id) REFERENCES customers (business_id, id) ON DELETE CASCADE
);
CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, supplier_id uuid NOT NULL,
  status po_status NOT NULL DEFAULT 'draft', ordered_at timestamptz, received_at timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (business_id, id),
  FOREIGN KEY (business_id, supplier_id) REFERENCES suppliers (business_id, id)
);
CREATE TABLE purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, purchase_order_id uuid NOT NULL, product_id uuid NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14,2) NOT NULL CHECK (unit_cost >= 0),
  received_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  FOREIGN KEY (business_id, purchase_order_id) REFERENCES purchase_orders (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, product_id) REFERENCES products (business_id, id)
);
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid, receipt_no text, customer_id uuid, salesperson_id uuid REFERENCES neon_auth."user"(id),
  status sale_status NOT NULL DEFAULT 'draft', client_uuid uuid,
  subtotal numeric(14,2) NOT NULL DEFAULT 0, discount_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  tax_total numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  UNIQUE (business_id, id), UNIQUE (business_id, receipt_no), UNIQUE (business_id, client_uuid),
  FOREIGN KEY (business_id, branch_id) REFERENCES branches (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES customers (business_id, id)
);
CREATE INDEX sales_report_idx ON sales (business_id, status, created_at DESC);
CREATE TABLE sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, sale_id uuid NOT NULL, product_id uuid NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost numeric(14,2) NOT NULL CHECK (unit_cost >= 0),
  discount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  line_total numeric(14,2) NOT NULL CHECK (line_total >= 0),
  FOREIGN KEY (business_id, sale_id) REFERENCES sales (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, product_id) REFERENCES products (business_id, id)
);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, sale_id uuid, customer_id uuid,
  method payment_method NOT NULL, status payment_status NOT NULL DEFAULT 'pending',
  amount numeric(14,2) NOT NULL CHECK (amount > 0), reference text, provider_ref text,
  phone text, raw_callback jsonb, paid_at timestamptz, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'confirmed' OR paid_at IS NOT NULL),
  FOREIGN KEY (business_id, sale_id) REFERENCES sales (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES customers (business_id, id)
);
CREATE UNIQUE INDEX payments_provider_ref_uq ON payments (business_id, method, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, sale_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0), reason text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (business_id, sale_id) REFERENCES sales (business_id, id)
);
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category text NOT NULL, description text, amount numeric(14,2) NOT NULL CHECK (amount > 0),
  spent_on date NOT NULL DEFAULT current_date, created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  actor_id uuid, action text NOT NULL, entity text, entity_id uuid, detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
