import { Button } from "@/components/ui/button";
import { AddToCartForm } from "./add-to-cart-form";

export function AddToCartButton({
  slug,
  disabled,
  describedBy,
}: {
  slug: string;
  disabled: boolean;
  describedBy: string;
}) {
  return (
    <AddToCartForm slug={slug}>
      <Button
        type="submit"
        disabled={disabled}
        aria-describedby={describedBy}
        focus="outline"
        className="h-9 w-full"
      >
        Add to cart
      </Button>
    </AddToCartForm>
  );
}
