import type { APIRequestContext, APIResponse } from "@playwright/test";

export function backendUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.BACKEND_URL ?? "http://localhost:8080").replace(/\/+$/, "");
}

function testUrl(path: string): string {
  return `${backendUrl()}/api/test${path}`;
}

async function expectStatus(
  response: APIResponse,
  expected: number,
  call: string,
): Promise<void> {
  if (response.status() !== expected) {
    throw new Error(
      `${call} answered ${String(response.status())} instead of ${String(expected)}: ${await response.text()}`,
    );
  }
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function post(
  request: APIRequestContext,
  path: string,
  data?: object,
): Promise<void> {
  const url = testUrl(path);
  const response = await request.post(url, { data });
  await expectStatus(response, 204, `POST ${url}`);
}

async function readCount(
  request: APIRequestContext,
  path: string,
): Promise<number> {
  const url = testUrl(path);
  const response = await request.get(url);
  await expectStatus(response, 200, `GET ${url}`);
  const text = await response.text();
  const body = parse(text);
  const count =
    typeof body === "object" && body !== null && "count" in body
      ? body.count
      : undefined;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new Error(`GET ${url} answered without a count: ${text}`);
  }
  return count;
}

export async function resetBackend(request: APIRequestContext): Promise<void> {
  await post(request, "/reset");
}

export async function setProduct(
  request: APIRequestContext,
  slug: string,
  patch: { stock?: number; priceCents?: number },
): Promise<void> {
  await post(request, `/products/${encodeURIComponent(slug)}`, patch);
}

export async function orderCount(request: APIRequestContext): Promise<number> {
  return readCount(request, "/orders");
}

export async function requestCount(
  request: APIRequestContext,
): Promise<number> {
  return readCount(request, "/request-count");
}

export async function resetRequestCount(
  request: APIRequestContext,
): Promise<void> {
  await post(request, "/request-count/reset");
}
