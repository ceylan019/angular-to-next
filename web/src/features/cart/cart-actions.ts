"use server";

import { z } from "zod";
import { getProduct } from "@/lib/backend/client";
import { BackendUnavailableError } from "@/lib/backend/errors";
import {
  productSummarySchema,
  type ProductDetail,
} from "@/lib/backend/schemas";
import {
  addLine,
  normalizeRequestedQuantity,
  removeLine,
  setLineQuantity,
} from "./cart-rules";
import { addedMessage, capMessage } from "./cart-messages";
import { readCart, writeCart } from "./cart-store";

export type CartActionState =
  | { status: "idle" }
  | {
      status: "added" | "clamped";
      message: string;
      submittedQuantity: string | null;
    }
  | { status: "updated" | "error"; submittedQuantity: string | null };

export type QuantityChange = { productId: number; quantity: string };

const addInputSchema = z.object({ slug: productSummarySchema.shape.slug });

const productIdSchema = productSummarySchema.shape.id;

const quantityChangeSchema = z.object({
  productId: productIdSchema,
  quantity: z.string(),
});

async function findProduct(slug: string): Promise<ProductDetail | null> {
  try {
    return await getProduct(slug);
  } catch (error) {
    if (error instanceof BackendUnavailableError) return null;
    throw error;
  }
}

export async function addToCart(
  _state: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const quantity = formData.get("quantity");
  const submittedQuantity = typeof quantity === "string" ? quantity : null;
  const failed: CartActionState = { status: "error", submittedQuantity };
  const input = addInputSchema.safeParse({ slug: formData.get("slug") });
  if (!input.success) return failed;

  const product = await findProduct(input.data.slug);
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

export async function updateQuantity(
  change: QuantityChange,
): Promise<CartActionState> {
  const input = quantityChangeSchema.safeParse(change);
  if (!input.success) return { status: "error", submittedQuantity: null };
  const { productId, quantity } = input.data;
  const failed: CartActionState = {
    status: "error",
    submittedQuantity: quantity,
  };

  const lines = await readCart();
  const line = lines.find((candidate) => candidate.productId === productId);
  if (line === undefined) return failed;
  const product = await findProduct(line.slug);
  if (product?.id !== productId) return failed;

  const result = setLineQuantity(
    lines,
    productId,
    normalizeRequestedQuantity(quantity),
    product.stock,
  );
  await writeCart(result.lines);

  return result.outcome === "clamped" && result.cap > 0
    ? {
        status: "clamped",
        message: capMessage(result.cap, product.name),
        submittedQuantity: quantity,
      }
    : { status: "updated", submittedQuantity: quantity };
}

export async function removeFromCart(productId: number): Promise<void> {
  const id = productIdSchema.safeParse(productId);
  if (!id.success) return;
  await writeCart(removeLine(await readCart(), id.data));
}
