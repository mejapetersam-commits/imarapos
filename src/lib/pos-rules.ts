export type NewProduct = {
  name: string;
  sku: string;
  cost_price: number;
  selling_price: number;
  low_stock_threshold: number;
  initial_stock: number;
};

export function isValidNewProduct(product: NewProduct): boolean {
  return product.name.trim().length > 0 && product.sku.trim().length > 0 &&
    [product.cost_price, product.selling_price, product.low_stock_threshold, product.initial_stock]
      .every((value) => Number.isFinite(value) && value >= 0);
}

export function isValidStockAdjustment(currentQuantity: number, delta: number): boolean {
  return Number.isFinite(currentQuantity) && Number.isFinite(delta) && delta !== 0 && currentQuantity + delta >= 0;
}