-- Sales & checkout: atomic complete_sale / refund_sale; sales, items, payments and refunds are write-protected for direct client writes.
ALTER TABLE payments ADD COLUMN tendered numeric(14,2) CHECK (tendered IS NULL OR tendered >= 0), ADD COLUMN change_given numeric(14,2) NOT NULL DEFAULT 0 CHECK (change_given >= 0);
ALTER TABLE sale_items ADD COLUMN returned_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0), ADD COLUMN product_name text, ADD COLUMN product_sku text, ADD CONSTRAINT sale_items_returned_le_sold CHECK (returned_quantity <= quantity);
ALTER TABLE refunds ADD COLUMN method payment_method NOT NULL DEFAULT 'cash';

CREATE TABLE receipt_counters (business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE, last_no bigint NOT NULL DEFAULT 0);
ALTER TABLE receipt_counters ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['sales','sale_items','payments','refunds'] LOOP
    EXECUTE format('CREATE POLICY no_direct_insert ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (false)', t);
    EXECUTE format('CREATE POLICY no_direct_update ON %I AS RESTRICTIVE FOR UPDATE USING (false)', t);
    EXECUTE format('CREATE POLICY no_direct_delete ON %I AS RESTRICTIVE FOR DELETE USING (false)', t);
  END LOOP;
END $$;

CREATE FUNCTION member_name(p_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(u.name, ''), u.email)::text FROM neon_auth."user" u
    JOIN business_members m ON m.user_id = u.id AND m.business_id = app_business()
   WHERE u.id = p_user AND app_role() IS NOT NULL $$;

CREATE FUNCTION complete_sale(p_client_uuid uuid, p_items jsonb, p_discount numeric, p_cash_tendered numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); s_id uuid; existing uuid; branch uuid; it record; prod products%ROWTYPE;
  gross numeric(14,2) := 0; line_disc numeric(14,2) := 0; line numeric(14,2); gross_line numeric(14,2); v_total numeric(14,2); recno bigint;
BEGIN
  IF b IS NULL OR u IS NULL OR app_role() IS NULL THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_client_uuid IS NOT NULL THEN
    SELECT id INTO existing FROM sales WHERE business_id = b AND client_uuid = p_client_uuid;
    IF FOUND THEN RETURN existing; END IF;
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Add at least one item to the sale'; END IF;
  IF COALESCE(p_discount, 0) < 0 THEN RAISE EXCEPTION 'Discount cannot be negative'; END IF;
  SELECT id INTO branch FROM branches WHERE business_id = b AND is_default LIMIT 1;
  INSERT INTO sales (business_id, branch_id, salesperson_id, status, client_uuid) VALUES (b, branch, u, 'draft', p_client_uuid) RETURNING id INTO s_id;
  FOR it IN SELECT (e->>'product_id')::uuid AS product_id, (e->>'quantity')::numeric AS qty, COALESCE((e->>'discount')::numeric, 0) AS disc FROM jsonb_array_elements(p_items) e ORDER BY 1 LOOP
    IF it.qty IS NULL OR it.qty <= 0 THEN RAISE EXCEPTION 'Quantities must be greater than zero'; END IF;
    IF it.disc < 0 THEN RAISE EXCEPTION 'Discount cannot be negative'; END IF;
    SELECT * INTO prod FROM products WHERE id = it.product_id AND business_id = b AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'A product in this sale is no longer available'; END IF;
    UPDATE inventory SET quantity_on_hand = quantity_on_hand - it.qty, updated_at = now() WHERE business_id = b AND product_id = prod.id AND quantity_on_hand >= it.qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'Not enough stock for %', prod.name; END IF;
    gross_line := round(prod.selling_price * it.qty, 2);
    line := gross_line - it.disc;
    IF line < 0 THEN RAISE EXCEPTION 'The discount on % is larger than the line total', prod.name; END IF;
    INSERT INTO sale_items (business_id, sale_id, product_id, quantity, unit_price, unit_cost, discount, line_total, product_name, product_sku)
    VALUES (b, s_id, prod.id, it.qty, prod.selling_price, prod.cost_price, it.disc, line, prod.name, prod.sku);
    INSERT INTO stock_movements (business_id, product_id, quantity_delta, reason, reference_type, reference_id, created_by) VALUES (b, prod.id, -it.qty, 'sale', 'sale', s_id, u);
    gross := gross + gross_line; line_disc := line_disc + it.disc;
  END LOOP;
  v_total := gross - line_disc - COALESCE(p_discount, 0);
  IF v_total < 0 THEN RAISE EXCEPTION 'The discount is larger than the sale total'; END IF;
  INSERT INTO receipt_counters (business_id, last_no) VALUES (b, 1) ON CONFLICT (business_id) DO UPDATE SET last_no = receipt_counters.last_no + 1 RETURNING last_no INTO recno;
  UPDATE sales SET subtotal = gross, discount_total = line_disc + COALESCE(p_discount, 0), tax_total = 0, total = v_total,
         receipt_no = 'R-' || lpad(recno::text, 6, '0'), status = 'completed', completed_at = now() WHERE id = s_id;
  IF v_total > 0 THEN
    IF COALESCE(p_cash_tendered, 0) < v_total THEN RAISE EXCEPTION 'Cash received is less than the total'; END IF;
    INSERT INTO payments (business_id, sale_id, method, status, amount, tendered, change_given, paid_at, created_by)
    VALUES (b, s_id, 'cash', 'confirmed', v_total, p_cash_tendered, p_cash_tendered - v_total, now(), u);
  END IF;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'sale.completed', 'sale', s_id, jsonb_build_object('total', v_total, 'discount', line_disc + COALESCE(p_discount, 0)));
  RETURN s_id;
END $$;

CREATE FUNCTION refund_sale(p_sale_id uuid, p_items jsonb, p_reason text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); sale sales%ROWTYPE; it record; si sale_items%ROWTYPE; factor numeric; line_sum numeric; amt numeric(14,2) := 0; already numeric(14,2);
BEGIN
  IF b IS NULL OR u IS NULL OR app_role() IS NULL OR app_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Choose at least one item to return'; END IF;
  SELECT * INTO sale FROM sales WHERE id = p_sale_id AND business_id = b FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF sale.status <> 'completed' THEN RAISE EXCEPTION 'Only completed sales can be refunded'; END IF;
  SELECT COALESCE(sum(line_total), 0) INTO line_sum FROM sale_items WHERE sale_id = sale.id AND business_id = b;
  factor := CASE WHEN line_sum = 0 THEN 0 ELSE sale.total / line_sum END;
  FOR it IN SELECT (e->>'sale_item_id')::uuid AS id, (e->>'quantity')::numeric AS qty FROM jsonb_array_elements(p_items) e LOOP
    IF it.qty IS NULL OR it.qty <= 0 THEN RAISE EXCEPTION 'Quantities must be greater than zero'; END IF;
    SELECT * INTO si FROM sale_items WHERE id = it.id AND sale_id = sale.id AND business_id = b FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item not found on this sale'; END IF;
    IF it.qty > si.quantity - si.returned_quantity THEN RAISE EXCEPTION 'You cannot return more than was sold'; END IF;
    amt := amt + round(si.line_total * it.qty / si.quantity * factor, 2);
    UPDATE sale_items SET returned_quantity = returned_quantity + it.qty WHERE id = si.id;
    UPDATE inventory SET quantity_on_hand = quantity_on_hand + it.qty, updated_at = now() WHERE business_id = b AND product_id = si.product_id;
    INSERT INTO stock_movements (business_id, product_id, quantity_delta, reason, note, reference_type, reference_id, created_by) VALUES (b, si.product_id, it.qty, 'return', NULLIF(trim(p_reason), ''), 'sale', sale.id, u);
  END LOOP;
  SELECT COALESCE(sum(amount), 0) INTO already FROM refunds WHERE sale_id = sale.id AND business_id = b;
  IF already + amt > sale.total THEN amt := sale.total - already; END IF;
  IF amt <= 0 THEN RAISE EXCEPTION 'There is nothing to refund on those items'; END IF;
  INSERT INTO refunds (business_id, sale_id, amount, reason, created_by, method) VALUES (b, sale.id, amt, NULLIF(trim(p_reason), ''), u, 'cash');
  IF NOT EXISTS (SELECT 1 FROM sale_items WHERE sale_id = sale.id AND business_id = b AND quantity > returned_quantity) THEN UPDATE sales SET status = 'refunded' WHERE id = sale.id; END IF;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'sale.refunded', 'sale', sale.id, jsonb_build_object('amount', amt, 'reason', p_reason));
  RETURN amt;
END $$;
