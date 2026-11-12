-- Tenant isolation backstop: the app connects as a non-owner role and sets app.user_id / app.business_id per transaction.
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'business_id' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (business_id = app_business()) WITH CHECK (business_id = app_business())', t);
  END LOOP;
END $$;
CREATE POLICY member_self_read ON business_members FOR SELECT USING (user_id = app_user());
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY business_read ON businesses FOR SELECT USING (id = app_business() OR owner_id = app_user() OR EXISTS (SELECT 1 FROM business_members m WHERE m.business_id = businesses.id AND m.user_id = app_user()));
CREATE POLICY business_insert ON businesses FOR INSERT WITH CHECK (owner_id = app_user());
CREATE POLICY business_update ON businesses FOR UPDATE USING (id = app_business()) WITH CHECK (id = app_business());

CREATE FUNCTION create_business(p_name text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE b uuid := gen_random_uuid();
BEGIN
  IF app_user() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM set_config('app.business_id', b::text, true);
  INSERT INTO businesses (id, name, owner_id) VALUES (b, trim(p_name), app_user());
  INSERT INTO branches (business_id, name, is_default) VALUES (b, 'Main branch', true);
  INSERT INTO business_members (business_id, user_id, role) VALUES (b, app_user(), 'owner');
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id) VALUES (b, app_user(), 'business.created', 'business', b);
  RETURN b;
END $$;

CREATE FUNCTION add_product_with_stock(p_name text, p_sku text, p_barcode text, p_category_id uuid, p_cost numeric, p_price numeric, p_low numeric, p_stock numeric) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE b uuid := app_business(); pid uuid;
BEGIN
  IF b IS NULL THEN RAISE EXCEPTION 'No business selected'; END IF;
  IF p_stock < 0 OR p_cost < 0 OR p_price < 0 OR p_low < 0 THEN RAISE EXCEPTION 'Stock and prices cannot be negative'; END IF;
  INSERT INTO products (business_id, name, sku, barcode, category_id, cost_price, selling_price, low_stock_threshold)
  VALUES (b, trim(p_name), trim(p_sku), NULLIF(trim(p_barcode), ''), p_category_id, p_cost, p_price, p_low) RETURNING id INTO pid;
  INSERT INTO inventory (business_id, product_id, quantity_on_hand) VALUES (b, pid, p_stock);
  IF p_stock > 0 THEN
    INSERT INTO stock_movements (business_id, product_id, quantity_delta, reason, created_by) VALUES (b, pid, p_stock, 'opening', app_user());
  END IF;
  RETURN pid;
END $$;

CREATE FUNCTION adjust_inventory(p_product_id uuid, p_delta numeric, p_reason movement_reason DEFAULT 'adjustment', p_note text DEFAULT NULL) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE b uuid := app_business(); q numeric;
BEGIN
  IF b IS NULL THEN RAISE EXCEPTION 'No business selected'; END IF;
  IF p_delta = 0 THEN RAISE EXCEPTION 'Enter a non-zero stock adjustment'; END IF;
  UPDATE inventory SET quantity_on_hand = quantity_on_hand + p_delta, updated_at = now()
   WHERE business_id = b AND product_id = p_product_id AND quantity_on_hand + p_delta >= 0 RETURNING quantity_on_hand INTO q;
  IF q IS NULL THEN RAISE EXCEPTION 'Stock adjustment would leave inventory below zero'; END IF;
  INSERT INTO stock_movements (business_id, product_id, quantity_delta, reason, note, created_by) VALUES (b, p_product_id, p_delta, p_reason, NULLIF(trim(p_note), ''), app_user());
  RETURN q;
END $$;
