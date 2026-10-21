export function addedMessage(name: string): string {
  return `Added ${name} to your cart.`;
}

export function capMessage(cap: number, name: string): string {
  return `You can buy at most ${String(cap)} of ${name}.`;
}
