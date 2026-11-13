export type Business = { id: string; name: string; currency: string };
export type Category = { id: string; name: string };
export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  supplier_id: string | null;
  cost_price: number;
  selling_price: number;
  low_stock_threshold: number;
  active: boolean;
  inventory: { quantity_on_hand: number } | null;
  category: string;
};
export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  product_count: number;
};
export type Role = "owner" | "manager" | "cashier";
export type AuthMode = "signin" | "signup";
export type Page = "dashboard" | "inventory" | "suppliers";
