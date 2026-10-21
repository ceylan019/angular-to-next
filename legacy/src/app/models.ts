export interface CartItem {
  product: any;
  quantity: number;
}

export interface CartResult {
  clamped: boolean;
  cap: number;
}
