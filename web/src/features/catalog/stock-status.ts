const LOW_STOCK = 3;

export function stockStatus(stock: number): string {
  if (stock <= 0) return "Out of stock";
  if (stock <= LOW_STOCK) return `Only ${String(stock)} left`;
  return "In stock";
}
