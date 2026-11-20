-- Purchase orders: numbering, draft -> ordered -> received (partial receipts), weighted-average cost on receiving.
ALTER TABLE purchase_orders ADD COLUMN po_number text, ADD COLUMN expected_date date, ADD COLUMN notes text, ADD COLUMN cancelled_at timestamptz;
CREATE UNIQUE INDEX purchase_orders_number_uq ON purchase_orders (business_id, po_number);
CREATE INDEX purchase_order_items_po_idx ON purchase_order_items (business_id, purchase_order_id);
CREATE TABLE po_counters (business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE, last_no bigint NOT NULL DEFAULT 0);
ALTER TABLE po_counters ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_orders','purchase_order_items'] LOOP
    EXECUTE format('CREATE POLICY no_direct_insert ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (false)', t);
    EXECUTE format('CREATE POLICY no_direct_update ON %I AS RESTRICTIVE FOR UPDATE USING (false)', t);
    EXECUTE format('CREATE POLICY no_direct_delete ON %I AS RESTRICTIVE FOR DELETE USING (false)', t);
  END LOOP;
END $$;

-- Internal helper: replaces a PO's lines after validating them. Not callable by the app role.
CREATE FUNCTION po_set_items(p_po uuid, p_business uuid, p_items jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it record;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Add at least one item to the order'; END IF;
  IF jsonb_array_length(p_items) > 100 THEN RAISE EXCEPTION 'An order can have at most 100 items'; END IF;
  IF (SELECT count(DISTINCT e->>'product_id') FROM jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Each product can only appear once on an order'; END IF;
  DELETE FROM purchase_order_items WHERE purchase_order_id = p_po AND business_id = p_business;
  FOR it IN SELECT (e->>'product_id')::uuid AS pid, (e->>'quantity')::numeric AS qty, (e->>'unit_cost')::numeric AS cost FROM jsonb_array_elements(p_items) e LOOP
    IF it.qty IS NULL OR it.qty <= 0 THEN RAISE EXCEPTION 'Quantities must be greater than zero'; END IF;
    IF it.cost IS NULL OR it.cost < 0 THEN RAISE EXCEPTION 'Unit costs cannot be negative'; END IF;
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = it.pid AND business_id = p_business) THEN RAISE EXCEPTION 'A product on this order was not found'; END IF;
    INSERT INTO purchase_order_items (business_id, purchase_order_id, product_id, quantity, unit_cost) VALUES (p_business, p_po, it.pid, it.qty, it.cost);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION po_set_items(uuid, uuid, jsonb) FROM PUBLIC;

CREATE FUNCTION create_purchase_order(p_supplier_id uuid, p_items jsonb, p_expected date, p_notes text, p_mark_ordered boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); po uuid; recno bigint;
BEGIN
  IF b IS NULL OR u IS NULL OR app_role() IS NULL OR app_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_supplier_id AND business_id = b) THEN RAISE EXCEPTION 'Choose a supplier for this order'; END IF;
  INSERT INTO po_counters (business_id, last_no) VALUES (b, 1) ON CONFLICT (business_id) DO UPDATE SET last_no = po_counters.last_no + 1 RETURNING last_no INTO recno;
  INSERT INTO purchase_orders (business_id, supplier_id, status, po_number, expected_date, notes, created_by, ordered_at)
  VALUES (b, p_supplier_id, CASE WHEN p_mark_ordered THEN 'ordered'::po_status ELSE 'draft'::po_status END, 'PO-' || lpad(recno::text, 4, '0'), p_expected, NULLIF(trim(p_notes), ''), u, CASE WHEN p_mark_ordered THEN now() END)
  RETURNING id INTO po;
  PERFORM po_set_items(po, b, p_items);
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'po.created', 'purchase_order', po, jsonb_build_object('ordered', p_mark_ordered));
  RETURN po;
END $$;

CREATE FUNCTION update_purchase_order(p_id uuid, p_supplier_id uuid, p_items jsonb, p_expected date, p_notes text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); po purchase_orders%ROWTYPE;
BEGIN
  IF b IS NULL OR app_user() IS NULL OR app_role() IS NULL OR app_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  SELECT * INTO po FROM purchase_orders WHERE id = p_id AND business_id = b FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF po.status <> 'draft' THEN RAISE EXCEPTION 'Only draft orders can be edited'; END IF;
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_supplier_id AND business_id = b) THEN RAISE EXCEPTION 'Choose a supplier for this order'; END IF;
  UPDATE purchase_orders SET supplier_id = p_supplier_id, expected_date = p_expected, notes = NULLIF(trim(p_notes), '') WHERE id = po.id;
  PERFORM po_set_items(po.id, b, p_items);
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id) VALUES (b, app_user(), 'po.updated', 'purchase_order', po.id);
END $$;

CREATE FUNCTION set_po_status(p_id uuid, p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); po purchase_orders%ROWTYPE;
BEGIN
  IF b IS NULL OR app_user() IS NULL OR app_role() IS NULL OR app_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  SELECT * INTO po FROM purchase_orders WHERE id = p_id AND business_id = b FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF p_status = 'ordered' THEN
    IF po.status <> 'draft' THEN RAISE EXCEPTION 'Only draft orders can be marked as ordered'; END IF;
    UPDATE purchase_orders SET status = 'ordered', ordered_at = now() WHERE id = po.id;
  ELSIF p_status = 'cancelled' THEN
    IF po.status NOT IN ('draft','ordered') THEN RAISE EXCEPTION 'This order can no longer be cancelled'; END IF;
    IF EXISTS (SELECT 1 FROM purchase_order_items WHERE purchase_order_id = po.id AND received_quantity > 0) THEN RAISE EXCEPTION 'Stock has already been received on this order, so it cannot be cancelled'; END IF;
    UPDATE purchase_orders SET status = 'cancelled', cancelled_at = now() WHERE id = po.id;
  ELSE
    RAISE EXCEPTION 'Unknown status';
  END IF;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, app_user(), 'po.' || p_status, 'purchase_order', po.id, NULL);
END $$;

CREATE FUNCTION receive_purchase_order(p_id uuid, p_items jsonb, p_note text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); po purchase_orders%ROWTYPE; it record; poi purchase_order_items%ROWTYPE; onhand numeric; oldcost numeric; newcost numeric; got numeric := 0; result text;
BEGIN
  IF b IS NULL OR u IS NULL OR app_role() IS NULL OR app_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Enter the quantities you received'; END IF;
  SELECT * INTO po FROM purchase_orders WHERE id = p_id AND business_id = b FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF po.status NOT IN ('draft','ordered') THEN RAISE EXCEPTION 'This order is % and cannot receive stock', po.status; END IF;
  FOR it IN SELECT (e->>'item_id')::uuid AS id, (e->>'quantity')::numeric AS qty FROM jsonb_array_elements(p_items) e ORDER BY 1 LOOP
    IF it.qty IS NULL OR it.qty < 0 THEN RAISE EXCEPTION 'Received quantities cannot be negative'; END IF;
    CONTINUE WHEN it.qty = 0;
    SELECT * INTO poi FROM purchase_order_items WHERE id = it.id AND purchase_order_id = po.id AND business_id = b FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item was not found on this order'; END IF;
    IF it.qty > poi.quantity - poi.received_quantity THEN RAISE EXCEPTION 'You cannot receive more than the quantity still outstanding'; END IF;
    SELECT quantity_on_hand INTO onhand FROM inventory WHERE business_id = b AND product_id = poi.product_id FOR UPDATE;
    SELECT cost_price INTO oldcost FROM products WHERE id = poi.product_id AND business_id = b FOR UPDATE;
    newcost := CASE WHEN COALESCE(onhand, 0) + it.qty > 0 THEN (COALESCE(onhand, 0) * oldcost + it.qty * poi.unit_cost) / (COALESCE(onhand, 0) + it.qty) ELSE poi.unit_cost END;
    UPDATE products SET cost_price = round(newcost, 2), updated_at = now() WHERE id = poi.product_id AND business_id = b;
    UPDATE inventory SET quantity_on_hand = quantity_on_hand + it.qty, updated_at = now() WHERE business_id = b AND product_id = poi.product_id;
    INSERT INTO stock_movements (business_id, product_id, quantity_delta, reason, note, reference_type, reference_id, created_by)
    VALUES (b, poi.product_id, it.qty, 'purchase', COALESCE(NULLIF(trim(p_note), ''), po.po_number || ' received'), 'purchase_order', po.id, u);
    UPDATE purchase_order_items SET received_quantity = received_quantity + it.qty WHERE id = poi.id;
    got := got + it.qty;
  END LOOP;
  IF got <= 0 THEN RAISE EXCEPTION 'Enter the quantities you received'; END IF;
  IF EXISTS (SELECT 1 FROM purchase_order_items WHERE purchase_order_id = po.id AND business_id = b AND quantity > received_quantity) THEN
    result := 'ordered';
    UPDATE purchase_orders SET status = 'ordered', ordered_at = COALESCE(ordered_at, now()) WHERE id = po.id;
  ELSE
    result := 'received';
    UPDATE purchase_orders SET status = 'received', received_at = now(), ordered_at = COALESCE(ordered_at, now()) WHERE id = po.id;
  END IF;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'po.received', 'purchase_order', po.id, jsonb_build_object('units', got, 'status', result));
  RETURN result;
END $$;
