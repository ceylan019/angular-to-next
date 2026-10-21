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
  | { status: "added" | "clamped"; message: string }
  | { status: "error" };

const addInputSchema = z.object({ slug: productSummarySchema.shape.slug });

export async function addToCart(
  _state: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const input = addInputSchema.safeParse({ slug: formData.get("slug") });
  if (!input.success) return { status: "error" };

  let product;
  try {
    product = await getProduct(input.data.slug);
  } catch (error) {
    if (error instanceof BackendUnavailableError) return { status: "error" };
    throw error;
  }
  if (product === null || product.stock === 0) return { status: "error" };

  const result = addLine(
    await readCart(),
    product,
    normalizeRequestedQuantity(formData.get("quantity")),
  );
  await writeCart(result.lines);

  return result.outcome === "clamped"
    ? { status: "clamped", message: capMessage(result.cap, product.name) }
    : { status: "added", message: addedMessage(product.name) };
}
