import { EmptyState } from "@/components/empty-state";

export function CartEmpty() {
  return (
    <EmptyState
      message="Your cart is empty"
      href="/"
      action="Continue shopping"
    />
  );
}
