import { gzipSync } from "node:zlib";
import { isCount, isRecord } from "./audit.ts";

export type ScriptBody = { url: string; body: Buffer };
export type ScriptSize = { url: string; gzipBytes: number };
export type ScriptSizes = { jsBytes: number; scripts: ScriptSize[] };

export const isScriptResponse = (
  resourceType: string,
  status: number,
): boolean => resourceType === "script" && status >= 200 && status <= 299;

export function sumScriptSizes(bodies: readonly ScriptBody[]): ScriptSizes {
  const firstBodies = new Map<string, Buffer>();
  for (const { url, body } of bodies) {
    if (!firstBodies.has(url)) firstBodies.set(url, body);
  }
  const scripts = Array.from(firstBodies, ([url, body]) => ({
    url,
    gzipBytes: gzipSync(body).length,
  }));
  return {
    jsBytes: scripts.reduce((sum, { gzipBytes }) => sum + gzipBytes, 0),
    scripts,
  };
}

export function parseRequestCount(body: unknown): number {
  const count = isRecord(body) ? body.count : undefined;
  if (!isCount(count)) {
    throw new Error(
      "The backend request count is not a whole number of zero or more",
    );
  }
  return count;
}
