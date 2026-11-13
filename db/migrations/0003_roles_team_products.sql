-- Role-based write rules (RLS), team management, safe invites, product edit with audit. Applied after 0001/0002.
CREATE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM business_members WHERE business_id = app_business() AND user_id = app_user() AND active LIMIT 1 $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['categories','suppliers','products','product_images','inventory','stock_movements','purchase_orders','purchase_order_items','expenses','branches','credit_accounts'] LOOP
    EXECUTE format('CREATE POLICY role_insert ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (app_role() IN (''owner'',''manager''))', t);
    EXECUTE format('CREATE POLICY role_update ON %I AS RESTRICTIVE FOR UPDATE USING (app_role() IN (''owner'',''manager''))', t);
    EXECUTE format('CREATE POLICY role_delete ON %I AS RESTRICTIVE FOR DELETE USING (app_role() IN (''owner'',''manager''))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['business_members','business_invites'] LOOP
    EXECUTE format('CREATE POLICY owner_insert ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (app_role() = ''owner'')', t);
    EXECUTE format('CREATE POLICY owner_update ON %I AS RESTRICTIVE FOR UPDATE USING (app_role() = ''owner'')', t);
    EXECUTE format('CREATE POLICY owner_delete ON %I AS RESTRICTIVE FOR DELETE USING (app_role() = ''owner'')', t);
  END LOOP;
END $$;
CREATE POLICY owner_update ON businesses AS RESTRICTIVE FOR UPDATE USING (app_role() = 'owner');
CREATE POLICY owner_read ON business_invites AS RESTRICTIVE FOR SELECT USING (app_role() = 'owner');

CREATE OR REPLACE FUNCTION create_business(p_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := gen_random_uuid();
BEGIN
  IF app_user() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Enter a business name'; END IF;
  IF EXISTS (SELECT 1 FROM businesses WHERE owner_id = app_user() AND lower(name) = lower(trim(p_name))) THEN RAISE EXCEPTION 'You already have a business with that name'; END IF;
  PERFORM set_config('app.business_id', b::text, true);
  INSERT INTO businesses (id, name, owner_id) VALUES (b, trim(p_name), app_user());
  INSERT INTO branches (business_id, name, is_default) VALUES (b, 'Main branch', true);
  INSERT INTO business_members (business_id, user_id, role) VALUES (b, app_user(), 'owner');
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id) VALUES (b, app_user(), 'business.created', 'business', b);
  RETURN b;
END $$;

CREATE FUNCTION accept_invite(p_token_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv business_invites%ROWTYPE;
BEGIN
  IF app_user() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO inv FROM business_invites WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR inv.accepted_at IS NOT NULL OR inv.expires_at < now() THEN RAISE EXCEPTION 'This invite is invalid or has expired'; END IF;
  IF EXISTS (SELECT 1 FROM business_members WHERE business_id = inv.business_id AND user_id = app_user()) THEN RAISE EXCEPTION 'You are already a member of this business'; END IF;
  INSERT INTO business_members (business_id, user_id, role) VALUES (inv.business_id, app_user(), inv.role);
  UPDATE business_invites SET accepted_at = now() WHERE id = inv.id;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (inv.business_id, app_user(), 'member.joined', 'member', app_user(), jsonb_build_object('role', inv.role));
  RETURN inv.business_id;
END $$;

CREATE FUNCTION list_team() RETURNS TABLE (user_id uuid, name text, email text, role business_role, active boolean, joined_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, u.name::text, u.email::text, m.role, m.active, m.created_at
    FROM business_members m JOIN neon_auth."user" u ON u.id = m.user_id
   WHERE m.business_id = app_business() AND app_role() IS NOT NULL ORDER BY m.created_at $$;

CREATE FUNCTION update_member(p_user uuid, p_role business_role, p_active boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE cur business_members%ROWTYPE; owners int;
BEGIN
  IF app_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  SELECT * INTO cur FROM business_members WHERE business_id = app_business() AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team member not found'; END IF;
  IF cur.role = 'owner' AND cur.active AND (p_role <> 'owner' OR NOT p_active) THEN
    SELECT count(*) INTO owners FROM business_members WHERE business_id = app_business() AND role = 'owner' AND active;
    IF owners <= 1 THEN RAISE EXCEPTION 'A business must keep at least one active owner'; END IF;
  END IF;
  UPDATE business_members SET role = p_role, active = p_active WHERE id = cur.id;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (app_business(), app_user(), 'member.updated', 'member', p_user, jsonb_build_object('role_from', cur.role, 'role_to', p_role, 'active_to', p_active));
END $$;

CREATE FUNCTION update_product(p_id uuid, p_name text, p_sku text, p_barcode text, p_category_id uuid, p_cost numeric, p_price numeric, p_low numeric, p_active boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE old products%ROWTYPE;
BEGIN
  IF app_role() IS NULL OR app_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF app_business() IS NULL THEN RAISE EXCEPTION 'No business selected'; END IF;
  IF p_cost < 0 OR p_price < 0 OR p_low < 0 THEN RAISE EXCEPTION 'Prices and alert levels cannot be negative'; END IF;
  SELECT * INTO old FROM products WHERE id = p_id AND business_id = app_business() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  UPDATE products SET name = trim(p_name), sku = trim(p_sku), barcode = NULLIF(trim(p_barcode), ''), category_id = p_category_id,
         cost_price = p_cost, selling_price = p_price, low_stock_threshold = p_low, active = p_active, updated_at = now() WHERE id = p_id;
  IF old.cost_price <> p_cost OR old.selling_price <> p_price OR old.active <> p_active THEN
    INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (app_business(), app_user(), 'product.updated', 'product', p_id,
      jsonb_build_object('cost_from', old.cost_price, 'cost_to', p_cost, 'price_from', old.selling_price, 'price_to', p_price, 'active_from', old.active, 'active_to', p_active));
  END IF;
END $$;

-- Explicit role checks for functions created in 0002 (RLS alone silently filters rows).
CREATE OR REPLACE FUNCTION adjust_inventory(p_product_id uuid, p_delta numeric, p_reason movement_reason DEFAULT 'adjustment', p_note text DEFAULT NULL) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE b uuid := app_business(); q numeric;
BEGIN
  IF b IS NULL THEN RAISE EXCEPTION 'No business selected'; END IF;
  IF app_role() IS NULL OR app_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_delta = 0 THEN RAISE EXCEPTION 'Enter a non-zero stock adjustment'; END IF;
  UPDATE inventory SET quantity_on_hand = quantity_on_hand + p_delta, updated_at = now()
   WHERE business_id = b AND product_id = p_product_id AND quantity_on_hand + p_delta >= 0 RETURNING quantity_on_hand INTO q;
  IF q IS NULL THEN RAISE EXCEPTION 'Stock adjustment would leave inventory below zero'; END IF;
  INSERT INTO stock_movements (business_id, product_id, quantity_delta, reason, note, created_by) VALUES (b, p_product_id, p_delta, p_reason, NULLIF(trim(p_note), ''), app_user());
  RETURN q;
END $$;
