import "server-only";
import type { z } from "zod";
import { env } from "../env";
import { BackendContractError, BackendUnavailableError } from "./errors";
import {
  cardDeclinedSchema,
  familySchema,
  orderSchema,
  outOfStockSchema,
  priceChangedSchema,
  productDetailSchema,
  productPageSchema,
  validationErrorSchema,
  type Family,
  type Order,
  type PlaceOrderInput,
  type ProductDetail,
  type ProductPage,
} from "./schemas";

const TIMEOUT_MS = 5000;

export type PlaceOrderResult =
  | { kind: "placed"; order: Order }
  | { kind: "invalid"; fields: string[] }
  | { kind: "declined" }
  | {
      kind: "out-of-stock";
      items: { productId: number; available: number }[];
    }
  | {
      kind: "price-changed";
      items: { productId: number; unitPriceCents: number }[];
    };

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${env.BACKEND_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new BackendUnavailableError(`Backend request failed: ${path}`, {
      cause,
    });
  }
  if (response.status >= 500) {
    await response.body?.cancel();
    throw new BackendUnavailableError(
      `Backend answered ${String(response.status)} for ${path}`,
    );
  }
  return response;
}

async function unexpectedStatus(
  path: string,
  response: Response,
): Promise<never> {
  await response.body?.cancel();
  throw new BackendContractError(
    `Backend answered ${String(response.status)} for ${path}, which the contract does not list`,
  );
}

async function readJson(path: string, response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (cause) {
    if (cause instanceof SyntaxError) {
      throw new BackendContractError(
        `Backend sent a non JSON body for ${path}`,
        { cause },
      );
    }
    throw new BackendUnavailableError(
      `Backend body could not be read for ${path}`,
      { cause },
    );
  }
}

async function parseBody<S extends z.ZodType>(
  path: string,
  response: Response,
  schema: S,
): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await readJson(path, response));
  if (!parsed.success) {
    throw new BackendContractError(
      `Backend body for ${path} does not match the contract`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

async function getList<S extends z.ZodType>(
  path: string,
  schema: S,
): Promise<z.infer<S>> {
  const response = await send(path);
  if (response.status !== 200) await unexpectedStatus(path, response);
  return parseBody(path, response, schema);
}

async function getOrNull<S extends z.ZodType>(
  path: string,
  schema: S,
): Promise<z.infer<S> | null> {
  const response = await send(path);
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  if (response.status !== 200) await unexpectedStatus(path, response);
  return parseBody(path, response, schema);
}

export function getFamilies(): Promise<Family[]> {
  return getList("/api/families", familySchema.array());
}

export function getProducts(params: URLSearchParams): Promise<ProductPage> {
  const query = params.toString();
  const path = query === "" ? "/api/products" : `/api/products?${query}`;
  return getList(path, productPageSchema);
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ORDER_NUMBER = /^WC-[A-Z0-9]{6}$/;

export function getProduct(slug: string): Promise<ProductDetail | null> {
  if (!SLUG.test(slug)) return Promise.resolve(null);
  return getOrNull(
    `/api/products/${encodeURIComponent(slug)}`,
    productDetailSchema,
  );
}

export function getOrder(orderNumber: string): Promise<Order | null> {
  if (!ORDER_NUMBER.test(orderNumber)) return Promise.resolve(null);
  return getOrNull(
    `/api/orders/${encodeURIComponent(orderNumber)}`,
    orderSchema,
  );
}

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const path = "/api/orders";
  const response = await send(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  switch (response.status) {
    case 201:
      return {
        kind: "placed",
        order: await parseBody(path, response, orderSchema),
      };
    case 400: {
      const body = await parseBody(path, response, validationErrorSchema);
      return { kind: "invalid", fields: body.fields };
    }
    case 402:
      await parseBody(path, response, cardDeclinedSchema);
      return { kind: "declined" };
    case 409:
      return parseConflict(path, response);
    default:
      return await unexpectedStatus(path, response);
  }
}

async function parseConflict(
  path: string,
  response: Response,
): Promise<PlaceOrderResult> {
  const body = await readJson(path, response);
  const outOfStock = outOfStockSchema.safeParse(body);
  if (outOfStock.success) {
    return { kind: "out-of-stock", items: outOfStock.data.items };
  }
  const priceChanged = priceChangedSchema.safeParse(body);
  if (priceChanged.success) {
    return { kind: "price-changed", items: priceChanged.data.items };
  }
  throw new BackendContractError(`Unknown 409 body for ${path}`, {
    cause: new AggregateError([outOfStock.error, priceChanged.error]),
  });
}
