import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium, type Page, type Response as PageResponse } from "playwright";
import {
  isScriptResponse,
  parseRequestCount,
  sumScriptSizes,
  type ScriptSizes,
} from "./measurements.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const OUTPUT = join(ROOT, "reports", "metrics.json");
const PRODUCT_PATH = "/products/lavender-dusk";
const LEGACY_URL = process.env.LEGACY_URL ?? "http://localhost:4000";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

async function inFreshPage<T>(visit: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    return await visit(await context.newPage());
  } finally {
    await browser.close();
  }
}

async function backend(
  path: string,
  method: "GET" | "POST",
): Promise<Response> {
  const response = await fetch(new URL(path, BACKEND_URL), { method });
  if (!response.ok) {
    throw new Error(`${method} ${path} answered ${String(response.status)}`);
  }
  return response;
}

export async function measureScripts(baseURL: string): Promise<ScriptSizes> {
  return inFreshPage(async (page) => {
    const scripts: PageResponse[] = [];
    page.on("response", (response) => {
      if (
        isScriptResponse(response.request().resourceType(), response.status())
      ) {
        scripts.push(response);
      }
    });
    await page.goto(new URL("/", baseURL).href, { waitUntil: "load" });
    const untilLoad = [...scripts];
    await page.waitForLoadState("networkidle");
    return sumScriptSizes(
      await Promise.all(
        untilLoad.map(async (script) => ({
          url: script.url(),
          body: await script.body(),
        })),
      ),
    );
  });
}

export async function measureBackendCalls(
  baseURL: string,
  path: string,
): Promise<number> {
  await backend("/api/test/request-count/reset", "POST");
  await inFreshPage((page) =>
    page.goto(new URL(path, baseURL).href, { waitUntil: "networkidle" }),
  );
  const response = await backend("/api/test/request-count", "GET");
  return parseRequestCount(await response.json());
}

async function measure(baseURL: string) {
  const { jsBytes, scripts } = await measureScripts(baseURL);
  return {
    jsBytes,
    backendCalls: await measureBackendCalls(baseURL, PRODUCT_PATH),
    scripts,
  };
}

if (import.meta.main) {
  const metrics = {
    legacy: await measure(LEGACY_URL),
    next: await measure(WEB_URL),
  };
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT}: ${JSON.stringify(metrics)}`);
}
