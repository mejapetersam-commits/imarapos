-- Cashier shifts & cash drawer: opening float, pay-ins/outs, counted close with variance, automatic shift tagging.
ALTER TABLE businesses ADD COLUMN require_shift boolean NOT NULL DEFAULT false;

CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid, cashier_id uuid NOT NULL REFERENCES neon_auth."user"(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opening_float numeric(14,2) NOT NULL DEFAULT 0 CHECK (opening_float >= 0),
  opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, closed_by uuid,
  expected_cash numeric(14,2), counted_cash numeric(14,2) CHECK (counted_cash IS NULL OR counted_cash >= 0), variance numeric(14,2), notes text,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, branch_id) REFERENCES branches (business_id, id),
  CHECK ((status = 'open') = (closed_at IS NULL))
);
CREATE UNIQUE INDEX shifts_one_open_per_cashier ON shifts (business_id, cashier_id) WHERE status = 'open';
CREATE INDEX shifts_recent_idx ON shifts (business_id, opened_at DESC);

CREATE TABLE cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL, shift_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pay_in','pay_out')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0), reason text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (business_id, shift_id) REFERENCES shifts (business_id, id)
);
CREATE INDEX cash_movements_shift_idx ON cash_movements (business_id, shift_id);

ALTER TABLE sales ADD COLUMN shift_id uuid, ADD CONSTRAINT sales_shift_fk FOREIGN KEY (business_id, shift_id) REFERENCES shifts (business_id, id);
ALTER TABLE refunds ADD COLUMN shift_id uuid, ADD CONSTRAINT refunds_shift_fk FOREIGN KEY (business_id, shift_id) REFERENCES shifts (business_id, id);
ALTER TABLE credit_transactions ADD COLUMN shift_id uuid, ADD CONSTRAINT credit_tx_shift_fk FOREIGN KEY (business_id, shift_id) REFERENCES shifts (business_id, id);
CREATE INDEX sales_shift_idx ON sales (business_id, shift_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['shifts','cash_movements'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (business_id = app_business()) WITH CHECK (business_id = app_business())', t);
    EXECUTE format('CREATE POLICY no_direct_insert ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (false)', t);
    EXECUTE format('CREATE POLICY no_direct_update ON %I AS RESTRICTIVE FOR UPDATE USING (false)', t);
    EXECUTE format('CREATE POLICY no_direct_delete ON %I AS RESTRICTIVE FOR DELETE USING (false)', t);
  END LOOP;
END $$;

-- Stamps the current user's open shift on sales, cash refunds and cash repayments; enforces "require a shift" when switched on.
CREATE FUNCTION assign_shift() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; req boolean; need boolean := false;
BEGIN
  SELECT id INTO sid FROM shifts WHERE business_id = NEW.business_id AND cashier_id = app_user() AND status = 'open' LIMIT 1;
  NEW.shift_id := sid;
  IF sid IS NULL THEN
    SELECT require_shift INTO req FROM businesses WHERE id = NEW.business_id;
    IF req THEN
      IF TG_TABLE_NAME = 'sales' THEN need := true;
      ELSIF TG_TABLE_NAME = 'refunds' THEN need := (NEW.amount - NEW.credit_applied) > 0;
      ELSIF TG_TABLE_NAME = 'credit_transactions' THEN need := (NEW.kind = 'payment');
      END IF;
      IF need THEN RAISE EXCEPTION 'Open a shift on the Shifts page before handling cash'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sales_assign_shift BEFORE INSERT ON sales FOR EACH ROW EXECUTE FUNCTION assign_shift();
CREATE TRIGGER refunds_assign_shift BEFORE INSERT ON refunds FOR EACH ROW EXECUTE FUNCTION assign_shift();
CREATE TRIGGER credit_tx_assign_shift BEFORE INSERT ON credit_transactions FOR EACH ROW EXECUTE FUNCTION assign_shift();

CREATE FUNCTION shift_breakdown(p_shift_id uuid) RETURNS TABLE (opening numeric, cash_sales numeric, credit_repayments numeric, pay_ins numeric, pay_outs numeric, cash_refunds numeric, expected numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.opening, x.cash_sales, x.credit_repayments, x.pay_ins, x.pay_outs, x.cash_refunds,
         x.opening + x.cash_sales + x.credit_repayments + x.pay_ins - x.pay_outs - x.cash_refunds
    FROM (SELECT sh.opening_float AS opening,
                 COALESCE((SELECT sum(p.amount) FROM payments p JOIN sales s ON s.id = p.sale_id WHERE s.shift_id = sh.id AND p.method = 'cash' AND p.status = 'confirmed'), 0) AS cash_sales,
                 COALESCE((SELECT sum(-t.amount) FROM credit_transactions t WHERE t.shift_id = sh.id AND t.kind = 'payment' AND t.method = 'cash'), 0) AS credit_repayments,
                 COALESCE((SELECT sum(m.amount) FROM cash_movements m WHERE m.shift_id = sh.id AND m.kind = 'pay_in'), 0) AS pay_ins,
                 COALESCE((SELECT sum(m.amount) FROM cash_movements m WHERE m.shift_id = sh.id AND m.kind = 'pay_out'), 0) AS pay_outs,
                 COALESCE((SELECT sum(r.amount - r.credit_applied) FROM refunds r WHERE r.shift_id = sh.id AND r.method = 'cash'), 0) AS cash_refunds
            FROM shifts sh WHERE sh.id = p_shift_id AND sh.business_id = app_business() AND app_role() IS NOT NULL) x $$;

CREATE FUNCTION open_shift(p_opening_float numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); branch uuid; sid uuid;
BEGIN
  IF b IS NULL OR u IS NULL OR app_role() IS NULL THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_opening_float IS NULL OR p_opening_float < 0 THEN RAISE EXCEPTION 'The opening cash cannot be negative'; END IF;
  SELECT id INTO branch FROM branches WHERE business_id = b AND is_default LIMIT 1;
  BEGIN
    INSERT INTO shifts (business_id, branch_id, cashier_id, opening_float) VALUES (b, branch, u, p_opening_float) RETURNING id INTO sid;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'You already have a shift open';
  END;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'shift.opened', 'shift', sid, jsonb_build_object('float', p_opening_float));
  RETURN sid;
END $$;

CREATE FUNCTION add_cash_movement(p_kind text, p_amount numeric, p_reason text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); sid uuid; exp numeric;
BEGIN
  IF b IS NULL OR u IS NULL OR app_role() IS NULL THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_kind NOT IN ('pay_in','pay_out') THEN RAISE EXCEPTION 'Unknown cash movement'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter an amount greater than zero'; END IF;
  IF p_kind = 'pay_out' AND length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Give a reason for taking cash out'; END IF;
  SELECT id INTO sid FROM shifts WHERE business_id = b AND cashier_id = u AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open a shift first'; END IF;
  SELECT expected INTO exp FROM shift_breakdown(sid);
  IF p_kind = 'pay_out' AND p_amount > exp THEN RAISE EXCEPTION 'There is only KES % in the drawer', to_char(exp, 'FM999,999,990.00'); END IF;
  INSERT INTO cash_movements (business_id, shift_id, kind, amount, reason, created_by) VALUES (b, sid, p_kind, p_amount, NULLIF(trim(p_reason), ''), u);
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'shift.' || p_kind, 'shift', sid, jsonb_build_object('amount', p_amount, 'reason', p_reason));
  SELECT expected INTO exp FROM shift_breakdown(sid);
  RETURN exp;
END $$;

CREATE FUNCTION close_shift(p_shift_id uuid, p_counted numeric, p_notes text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := app_business(); u uuid := app_user(); sh shifts%ROWTYPE; exp numeric; v numeric(14,2);
BEGIN
  IF b IS NULL OR u IS NULL OR app_role() IS NULL THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  SELECT * INTO sh FROM shifts WHERE id = p_shift_id AND business_id = b FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found'; END IF;
  IF sh.status <> 'open' THEN RAISE EXCEPTION 'This shift is already closed'; END IF;
  IF sh.cashier_id <> u AND app_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'You do not have permission to do that.'; END IF;
  IF p_counted IS NULL OR p_counted < 0 THEN RAISE EXCEPTION 'Enter the cash you counted'; END IF;
  SELECT expected INTO exp FROM shift_breakdown(sh.id);
  v := p_counted - exp;
  UPDATE shifts SET status = 'closed', closed_at = now(), closed_by = u, expected_cash = exp, counted_cash = p_counted, variance = v, notes = NULLIF(trim(p_notes), '') WHERE id = sh.id;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (b, u, 'shift.closed', 'shift', sh.id, jsonb_build_object('expected', exp, 'counted', p_counted, 'variance', v));
  RETURN v;
END $$;
