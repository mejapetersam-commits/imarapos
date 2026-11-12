ALTER TABLE public.categories ADD CONSTRAINT categories_business_id_id_unique UNIQUE (business_id, id);
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_business_id_id_unique UNIQUE (business_id, id);
ALTER TABLE public.products ADD CONSTRAINT products_business_id_id_unique UNIQUE (business_id, id);
ALTER TABLE public.customers ADD CONSTRAINT customers_business_id_id_unique UNIQUE (business_id, id);
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_business_id_id_unique UNIQUE (business_id, id);
ALTER TABLE public.sales ADD CONSTRAINT sales_business_id_id_unique UNIQUE (business_id, id);

ALTER TABLE public.products ADD CONSTRAINT products_business_category_fkey FOREIGN KEY (business_id, category_id) REFERENCES public.categories (business_id, id);
ALTER TABLE public.products ADD CONSTRAINT products_business_supplier_fkey FOREIGN KEY (business_id, supplier_id) REFERENCES public.suppliers (business_id, id);
ALTER TABLE public.inventory ADD CONSTRAINT inventory_business_product_fkey FOREIGN KEY (business_id, product_id) REFERENCES public.products (business_id, id) ON DELETE CASCADE;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_business_product_fkey FOREIGN KEY (business_id, product_id) REFERENCES public.products (business_id, id) ON DELETE CASCADE;
ALTER TABLE public.customer_addresses ADD CONSTRAINT customer_addresses_business_customer_fkey FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE CASCADE;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_business_supplier_fkey FOREIGN KEY (business_id, supplier_id) REFERENCES public.suppliers (business_id, id);
ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_business_order_fkey FOREIGN KEY (business_id, purchase_order_id) REFERENCES public.purchase_orders (business_id, id) ON DELETE CASCADE;
ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_business_product_fkey FOREIGN KEY (business_id, product_id) REFERENCES public.products (business_id, id);
ALTER TABLE public.sales ADD CONSTRAINT sales_business_customer_fkey FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id);
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_business_sale_fkey FOREIGN KEY (business_id, sale_id) REFERENCES public.sales (business_id, id) ON DELETE CASCADE;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_business_product_fkey FOREIGN KEY (business_id, product_id) REFERENCES public.products (business_id, id);
ALTER TABLE public.payments ADD CONSTRAINT payments_business_sale_fkey FOREIGN KEY (business_id, sale_id) REFERENCES public.sales (business_id, id);
ALTER TABLE public.payments ADD CONSTRAINT payments_business_customer_fkey FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id);

CREATE OR REPLACE FUNCTION public.add_product_with_stock(
  p_business_id UUID,
  p_name TEXT,
  p_sku TEXT,
  p_barcode TEXT,
  p_category_id UUID,
  p_cost_price NUMERIC,
  p_selling_price NUMERIC,
  p_low_stock_threshold NUMERIC,
  p_initial_stock NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_product_id UUID;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'You do not have access to this business';
  END IF;
  IF p_initial_stock < 0 OR p_cost_price < 0 OR p_selling_price < 0 OR p_low_stock_threshold < 0 THEN
    RAISE EXCEPTION 'Stock and prices cannot be negative';
  END IF;

  INSERT INTO public.products (business_id, name, sku, barcode, category_id, cost_price, selling_price, low_stock_threshold)
  VALUES (p_business_id, trim(p_name), trim(p_sku), NULLIF(trim(p_barcode), ''), p_category_id, p_cost_price, p_selling_price, p_low_stock_threshold)
  RETURNING id INTO new_product_id;

  INSERT INTO public.inventory (business_id, product_id, quantity_on_hand)
  VALUES (p_business_id, new_product_id, p_initial_stock);

  IF p_initial_stock > 0 THEN
    INSERT INTO public.stock_movements (business_id, product_id, quantity_delta, reason, created_by)
    VALUES (p_business_id, new_product_id, p_initial_stock, 'Opening stock', auth.uid());
  END IF;

  RETURN new_product_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_product_with_stock(UUID, TEXT, TEXT, TEXT, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_product_with_stock(UUID, TEXT, TEXT, TEXT, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_business_id UUID,
  p_product_id UUID,
  p_quantity_delta NUMERIC,
  p_reason TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  next_quantity NUMERIC(14,3);
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'You do not have access to this business';
  END IF;
  IF p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'Enter a non-zero stock adjustment';
  END IF;

  UPDATE public.inventory
  SET quantity_on_hand = quantity_on_hand + p_quantity_delta, updated_at = now()
  WHERE business_id = p_business_id AND product_id = p_product_id AND quantity_on_hand + p_quantity_delta >= 0
  RETURNING quantity_on_hand INTO next_quantity;

  IF next_quantity IS NULL THEN
    RAISE EXCEPTION 'Stock adjustment would leave inventory below zero';
  END IF;

  INSERT INTO public.stock_movements (business_id, product_id, quantity_delta, reason, created_by)
  VALUES (p_business_id, p_product_id, p_quantity_delta, NULLIF(trim(p_reason), ''), auth.uid());

  RETURN next_quantity;
END;
$$;
REVOKE ALL ON FUNCTION public.adjust_inventory(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(UUID, UUID, NUMERIC, TEXT) TO authenticated;