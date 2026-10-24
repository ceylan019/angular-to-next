import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  isScriptResponse,
  parseRequestCount,
  sumScriptSizes,
} from "./measurements.ts";

const body = (text: string): Buffer => Buffer.from(text, "utf8");
const gzipped = (text: string): number => gzipSync(body(text)).length;

const MAIN = "var main = 1;".repeat(400);
const VENDOR = "function vendor() { return 42; }".repeat(300);

describe("isScriptResponse", () => {
  it("accepts a successful script response", () => {
    for (const status of [200, 203, 299]) {
      expect(isScriptResponse("script", status)).toBe(true);
    }
  });

  it("rejects responses that are not scripts", () => {
    for (const type of ["document", "stylesheet", "fetch", "xhr", "Script"]) {
      expect(isScriptResponse(type, 200)).toBe(false);
    }
  });

  it("rejects script responses that did not succeed", () => {
    for (const status of [0, 199, 300, 304, 404, 500]) {
      expect(isScriptResponse("script", status)).toBe(false);
    }
  });
});

describe("sumScriptSizes", () => {
  it("adds up the gzip size of each script body and lists each script", () => {
    expect(
      sumScriptSizes([
        { url: "http://localhost:4000/main.js", body: body(MAIN) },
        { url: "http://localhost:4000/vendor.js", body: body(VENDOR) },
      ]),
    ).toEqual({
      jsBytes: gzipped(MAIN) + gzipped(VENDOR),
      scripts: [
        { url: "http://localhost:4000/main.js", gzipBytes: gzipped(MAIN) },
        { url: "http://localhost:4000/vendor.js", gzipBytes: gzipped(VENDOR) },
      ],
    });
  });

  it("measures the compressed size, not the raw size", () => {
    const { jsBytes } = sumScriptSizes([
      { url: "http://localhost/main.js", body: body(MAIN) },
    ]);

    expect(jsBytes).toBeGreaterThan(0);
    expect(jsBytes).toBeLessThan(MAIN.length);
  });

  it("counts a script URL once and keeps the first body", () => {
    expect(
      sumScriptSizes([
        { url: "http://localhost/main.js", body: body(MAIN) },
        { url: "http://localhost/vendor.js", body: body(VENDOR) },
        { url: "http://localhost/main.js", body: body(VENDOR) },
      ]),
    ).toEqual({
      jsBytes: gzipped(MAIN) + gzipped(VENDOR),
      scripts: [
        { url: "http://localhost/main.js", gzipBytes: gzipped(MAIN) },
        { url: "http://localhost/vendor.js", gzipBytes: gzipped(VENDOR) },
      ],
    });
  });

  it("keeps URLs that differ only in their query apart", () => {
    const { scripts } = sumScriptSizes([
      { url: "http://localhost/main.js?v=1", body: body(MAIN) },
      { url: "http://localhost/main.js?v=2", body: body(MAIN) },
    ]);

    expect(scripts.map(({ url }) => url)).toEqual([
      "http://localhost/main.js?v=1",
      "http://localhost/main.js?v=2",
    ]);
  });

  it("gives zero for a page without scripts", () => {
    expect(sumScriptSizes([])).toEqual({ jsBytes: 0, scripts: [] });
  });
});

describe("parseRequestCount", () => {
  it("reads the backend request count", () => {
    expect(parseRequestCount({ count: 2 })).toBe(2);
    expect(parseRequestCount({ count: 0 })).toBe(0);
  });

  it.each([
    ["null", null],
    ["a number", 2],
    ["a list", [2]],
    ["an object without a count", {}],
    ["a count as a string", { count: "2" }],
    ["a negative count", { count: -1 }],
    ["a fractional count", { count: 1.5 }],
  ])("rejects %s", (_name, value) => {
    expect(() => parseRequestCount(value)).toThrow(
      new Error(
        "The backend request count is not a whole number of zero or more",
      ),
    );
  });
});
