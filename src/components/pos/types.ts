export type Business = { id: string; name: string; currency: string };
export type Category = { id: string; name: string };
export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  cost_price: number;
  selling_price: number;
  low_stock_threshold: number;
  active: boolean;
  inventory: { quantity_on_hand: number } | null;
  category: string;
};
export type AuthMode = "signin" | "signup";
export type Page = "dashboard" | "inventory";
