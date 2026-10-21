export interface CartItem {
  product: any;
  quantity: number;
}

export const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'NL', name: 'Netherlands' },
];

export interface CartResult {
  clamped: boolean;
  cap: number;
}
