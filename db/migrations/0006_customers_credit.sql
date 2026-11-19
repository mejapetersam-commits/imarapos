-- Customers & credit: ledger, due dates, split payments (cash + credit), FIFO repayments, credit-aware refunds.
ALTER TABLE sales ADD COLUMN due_date date, ADD COLUMN credit_outstanding numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_outstanding >= 0);
CREATE INDEX sales_credit_idx ON sales (business_id, customer_id) WHERE credit_outstanding > 0;
ALTER TABLE refunds ADD COLUMN credit_applied numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_applied >= 0);

CREATE TYPE credit_entry_kind AS ENUM ('sale', 'payment', 'credit_note');
CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, customer_id uuid NOT NULL, sale_id uuid,
  kind credit_entry_kind NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0),          -- + increases what the customer owes, - reduces it
  balance_after numeric(14,2) NOT NULL CHECK (balance_after >= 0),
  method text, reference text, note text, client_uuid uuid, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (business_id, customer_id) REFERENCES customers (business_id, id),
  FOREIGN KEY (business_id, sale_id) REFERENCES sales (business_id, id)
);
CREATE INDEX credit_tx_customer_idx ON credit_transactions (business_id, customer_id, created_at DESC);
CREATE UNIQUE INDEX credit_tx_client_sale_uq ON credit_transactions (business_id, client_uuid, sale_id) WHERE client_uuid IS NOT NULL AND kind = 'payment';
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON credit_transactions USING (business_id = app_business()) WITH CHECK (business_id = app_business());

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['credit_transactions','credit_accounts'] LOOP
    EXECUTE format('CREATE POLICY no_direct_insert ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (false)', t);
    EXECUTE format('CREATE POLICY no_direct_update ON %I AS RESTRICTIVE FOR UPDATE USING (false)', t);
    EXECUTE format('CREATE POLICY no_direct_delete ON %I AS RESTRICTIVE FOR DELETE USING (false)', t);
  END LOOP;
END $$;
CREATE POLICY manager_delete ON customers AS RESTRICTIVE FOR DELETE USING (app_role() IN ('owner','manager'));

CREATE FUNCTION set_credit_terms(p_customer_id uuid, p_limit numeric, p_terms_days int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business();
BEGIN
  IF b IS NULL OR app_role() IS NULL OR app_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_limit IS NULL OR p_limit < 0 THEN RAISE EXCEPTION 'The credit limit cannot be negative'; END IF;
  IF p_terms_days IS NULL OR p_terms_days < 0 OR p_terms_days > 365 THEN RAISE EXCEPTION 'Payment terms must be between 0 and 365 days'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND business_id = b) THEN RAISE EXCEPTION 'Customer not found'; END IF;
  INSERT INTO credit_accounts (business_id, customer_id, credit_limit, terms_days) VALUES (b, p_customer_id, p_limit, p_terms_days)
  ON CONFLICT (business_id, customer_id) DO UPDATE SET credit_limit = EXCLUDED.credit_limit, terms_days = EXCLUDED.terms_days;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, app_user(), 'credit.terms_set', 'customer', p_customer_id, jsonb_build_object('limit', p_limit, 'terms_days', p_terms_days));
END $$;

CREATE FUNCTION complete_sale(p_client_uuid uuid, p_items jsonb, p_discount numeric, p_cash_tendered numeric, p_customer_id uuid, p_credit_amount numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); s_id uuid; existing uuid; branch uuid; it record; prod products%ROWTYPE; acct credit_accounts%ROWTYPE;
  gross numeric(14,2) := 0; line_disc numeric(14,2) := 0; line numeric(14,2); gross_line numeric(14,2); v_total numeric(14,2); recno bigint;
  credit numeric(14,2) := COALESCE(p_credit_amount, 0); cash_due numeric(14,2); due date;
BEGIN
  IF b IS NULL OR u IS NULL OR app_role() IS NULL THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_client_uuid IS NOT NULL THEN
    SELECT id INTO existing FROM sales WHERE business_id = b AND client_uuid = p_client_uuid;
    IF FOUND THEN RETURN existing; END IF;
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Add at least one item to the sale'; END IF;
  IF COALESCE(p_discount, 0) < 0 THEN RAISE EXCEPTION 'Discount cannot be negative'; END IF;
  IF credit < 0 THEN RAISE EXCEPTION 'The credit amount cannot be negative'; END IF;
  IF p_customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND business_id = b) THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF credit > 0 THEN
    IF p_customer_id IS NULL THEN RAISE EXCEPTION 'Choose a customer to sell on credit'; END IF;
    SELECT * INTO acct FROM credit_accounts WHERE business_id = b AND customer_id = p_customer_id FOR UPDATE;
    IF NOT FOUND OR acct.credit_limit <= 0 THEN RAISE EXCEPTION 'This customer does not have a credit account'; END IF;
    IF EXISTS (SELECT 1 FROM sales WHERE business_id = b AND customer_id = p_customer_id AND credit_outstanding > 0 AND due_date < current_date) THEN
      RAISE EXCEPTION 'This customer has overdue credit. Collect payment before selling more on credit';
    END IF;
    due := current_date + acct.terms_days;
  END IF;
  SELECT id INTO branch FROM branches WHERE business_id = b AND is_default LIMIT 1;
  INSERT INTO sales (business_id, branch_id, customer_id, salesperson_id, status, client_uuid) VALUES (b, branch, p_customer_id, u, 'draft', p_client_uuid) RETURNING id INTO s_id;
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
  IF credit > v_total THEN RAISE EXCEPTION 'The credit amount is more than the sale total'; END IF;
  IF credit > 0 AND acct.balance + credit > acct.credit_limit THEN
    RAISE EXCEPTION 'Credit limit exceeded. This customer can take up to KES % on credit', to_char(acct.credit_limit - acct.balance, 'FM999,999,990.00');
  END IF;
  cash_due := v_total - credit;
  IF cash_due > 0 AND COALESCE(p_cash_tendered, 0) < cash_due THEN RAISE EXCEPTION 'Cash received is less than the amount due'; END IF;
  INSERT INTO receipt_counters (business_id, last_no) VALUES (b, 1) ON CONFLICT (business_id) DO UPDATE SET last_no = receipt_counters.last_no + 1 RETURNING last_no INTO recno;
  UPDATE sales SET subtotal = gross, discount_total = line_disc + COALESCE(p_discount, 0), tax_total = 0, total = v_total,
         receipt_no = 'R-' || lpad(recno::text, 6, '0'), status = 'completed', completed_at = now(),
         due_date = CASE WHEN credit > 0 THEN due END, credit_outstanding = credit WHERE id = s_id;
  IF cash_due > 0 THEN
    INSERT INTO payments (business_id, sale_id, customer_id, method, status, amount, tendered, change_given, paid_at, created_by)
    VALUES (b, s_id, p_customer_id, 'cash', 'confirmed', cash_due, p_cash_tendered, p_cash_tendered - cash_due, now(), u);
  END IF;
  IF credit > 0 THEN
    INSERT INTO payments (business_id, sale_id, customer_id, method, status, amount, paid_at, created_by)
    VALUES (b, s_id, p_customer_id, 'credit', 'confirmed', credit, now(), u);
    UPDATE credit_accounts SET balance = balance + credit WHERE id = acct.id;
    INSERT INTO credit_transactions (business_id, customer_id, sale_id, kind, amount, balance_after, method, created_by)
    VALUES (b, p_customer_id, s_id, 'sale', credit, acct.balance + credit, 'credit', u);
  END IF;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'sale.completed', 'sale', s_id, jsonb_build_object('total', v_total, 'discount', line_disc + COALESCE(p_discount, 0), 'credit', credit));
  RETURN s_id;
END $$;

CREATE FUNCTION record_credit_payment(p_customer_id uuid, p_amount numeric, p_reference text, p_client_uuid uuid) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); acct credit_accounts%ROWTYPE; remaining numeric(14,2); bal numeric(14,2); s record; take numeric(14,2);
BEGIN
  IF b IS NULL OR u IS NULL OR app_role() IS NULL THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a payment amount greater than zero'; END IF;
  SELECT * INTO acct FROM credit_accounts WHERE business_id = b AND customer_id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This customer does not have a credit account'; END IF;
  IF p_client_uuid IS NOT NULL AND EXISTS (SELECT 1 FROM credit_transactions WHERE business_id = b AND client_uuid = p_client_uuid) THEN RETURN acct.balance; END IF;
  IF p_amount > acct.balance THEN RAISE EXCEPTION 'The payment is more than the amount owed (KES %)', to_char(acct.balance, 'FM999,999,990.00'); END IF;
  remaining := p_amount; bal := acct.balance;
  FOR s IN SELECT id, credit_outstanding FROM sales WHERE business_id = b AND customer_id = p_customer_id AND credit_outstanding > 0 ORDER BY due_date NULLS LAST, created_at FOR UPDATE LOOP
    EXIT WHEN remaining <= 0;
    take := least(remaining, s.credit_outstanding);
    UPDATE sales SET credit_outstanding = credit_outstanding - take WHERE id = s.id;
    bal := bal - take; remaining := remaining - take;
    INSERT INTO credit_transactions (business_id, customer_id, sale_id, kind, amount, balance_after, method, reference, client_uuid, created_by)
    VALUES (b, p_customer_id, s.id, 'payment', -take, bal, 'cash', NULLIF(trim(p_reference), ''), p_client_uuid, u);
  END LOOP;
  IF remaining > 0 THEN RAISE EXCEPTION 'The balance does not match the open invoices. Please contact support'; END IF;
  UPDATE credit_accounts SET balance = bal WHERE id = acct.id;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'credit.payment', 'customer', p_customer_id, jsonb_build_object('amount', p_amount, 'balance_after', bal));
  RETURN bal;
END $$;

CREATE OR REPLACE FUNCTION refund_sale(p_sale_id uuid, p_items jsonb, p_reason text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); sale sales%ROWTYPE; it record; si sale_items%ROWTYPE; factor numeric; line_sum numeric; amt numeric(14,2) := 0; already numeric(14,2);
  credit_applied numeric(14,2) := 0; newbal numeric(14,2);
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
  IF sale.customer_id IS NOT NULL AND sale.credit_outstanding > 0 THEN
    credit_applied := least(amt, sale.credit_outstanding);
    PERFORM 1 FROM credit_accounts WHERE business_id = b AND customer_id = sale.customer_id FOR UPDATE;
    UPDATE sales SET credit_outstanding = credit_outstanding - credit_applied WHERE id = sale.id;
    UPDATE credit_accounts SET balance = balance - credit_applied WHERE business_id = b AND customer_id = sale.customer_id RETURNING balance INTO newbal;
    INSERT INTO credit_transactions (business_id, customer_id, sale_id, kind, amount, balance_after, note, created_by)
    VALUES (b, sale.customer_id, sale.id, 'credit_note', -credit_applied, newbal, NULLIF(trim(p_reason), ''), u);
  END IF;
  INSERT INTO refunds (business_id, sale_id, amount, reason, created_by, method, credit_applied) VALUES (b, sale.id, amt, NULLIF(trim(p_reason), ''), u, 'cash', credit_applied);
  IF NOT EXISTS (SELECT 1 FROM sale_items WHERE sale_id = sale.id AND business_id = b AND quantity > returned_quantity) THEN UPDATE sales SET status = 'refunded' WHERE id = sale.id; END IF;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'sale.refunded', 'sale', sale.id, jsonb_build_object('amount', amt, 'credit_applied', credit_applied, 'reason', p_reason));
  RETURN amt;
END $$;
