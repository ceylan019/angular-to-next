"use server";

import { z } from "zod";
import { getProduct } from "@/lib/backend/client";
import { BackendUnavailableError } from "@/lib/backend/errors";
import { productSummarySchema } from "@/lib/backend/schemas";
import { addLine, normalizeRequestedQuantity } from "./cart-rules";
import { addedMessage, capMessage } from "./cart-messages";
import { readCart, writeCart } from "./cart-store";

export type CartActionState =
  | { status: "idle" }
  | {
      status: "added" | "clamped";
      message: string;
      submittedQuantity: string | null;
    }
  | { status: "error"; submittedQuantity: string | null };

const addInputSchema = z.object({ slug: productSummarySchema.shape.slug });

export async function addToCart(
  _state: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const quantity = formData.get("quantity");
  const submittedQuantity = typeof quantity === "string" ? quantity : null;
  const failed: CartActionState = { status: "error", submittedQuantity };
  const input = addInputSchema.safeParse({ slug: formData.get("slug") });
  if (!input.success) return failed;

  let product;
  try {
    product = await getProduct(input.data.slug);
  } catch (error) {
    if (error instanceof BackendUnavailableError) return failed;
    throw error;
  }
  if (product === null || product.stock === 0) return failed;

  const result = addLine(
    await readCart(),
    product,
    normalizeRequestedQuantity(quantity),
  );
  await writeCart(result.lines);

  return result.outcome === "clamped"
    ? {
        status: "clamped",
        message: capMessage(result.cap, product.name),
        submittedQuantity,
      }
    : {
        status: "added",
        message: addedMessage(product.name),
        submittedQuantity,
      };
}
