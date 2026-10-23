import { describe, expect, it } from "vitest";
import { env, parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts a backend url", () => {
    expect(parseEnv({ BACKEND_URL: "http://backend:8080" })).toEqual({
      BACKEND_URL: "http://backend:8080",
    });
  });

  it("rejects a missing backend url", () => {
    expect(() => parseEnv({})).toThrow(/BACKEND_URL/);
  });

  it("rejects a malformed backend url", () => {
    expect(() => parseEnv({ BACKEND_URL: "not a url" })).toThrow(/BACKEND_URL/);
  });

  it("accepts an https backend url", () => {
    expect(parseEnv({ BACKEND_URL: "https://shop.example.com" })).toEqual({
      BACKEND_URL: "https://shop.example.com",
    });
  });

  it("keeps a path prefix", () => {
    expect(parseEnv({ BACKEND_URL: "http://backend:8080/shop" })).toEqual({
      BACKEND_URL: "http://backend:8080/shop",
    });
  });

  it.each([
    ["http://backend:8080/", "http://backend:8080"],
    ["http://backend:8080//", "http://backend:8080"],
    ["http://backend:8080/shop/", "http://backend:8080/shop"],
  ])("drops the trailing slash of %s", (value, expected) => {
    expect(parseEnv({ BACKEND_URL: value })).toEqual({
      BACKEND_URL: expected,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseEnv({ BACKEND_URL: "  http://backend:8080\n" })).toEqual({
      BACKEND_URL: "http://backend:8080",
    });
  });

  it("ignores unrelated variables", () => {
    expect(
      parseEnv({ BACKEND_URL: "http://backend:8080", NODE_ENV: "test" }),
    ).toEqual({ BACKEND_URL: "http://backend:8080" });
  });

  it.each([
    ["an explicitly undefined", undefined],
    ["an empty", ""],
    ["a blank", "   "],
  ])("rejects %s backend url", (_label, value) => {
    expect(() => parseEnv({ BACKEND_URL: value })).toThrow(/BACKEND_URL/);
  });

  it.each([
    "ftp://backend:8080",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "mailto:shop@example.com",
    "xhttp://backend:8080",
    "httpx://backend:8080",
    "http://",
    "backend:8080",
    "/api",
  ])("rejects the unusable url %s", (value) => {
    expect(() => parseEnv({ BACKEND_URL: value })).toThrow(/BACKEND_URL/);
  });

  it.each([
    "http://backend:8080?debug=1",
    "http://backend:8080/shop?debug=1",
    "http://backend:8080?",
    "http://backend:8080#top",
    "http://backend:8080/shop#",
    "http://user@backend:8080",
    "http://user:secret@backend:8080",
    "http://:secret@backend:8080",
  ])("rejects the url %s that would break path concatenation", (value) => {
    expect(() => parseEnv({ BACKEND_URL: value })).toThrow(
      /^(?=[\s\S]*BACKEND_URL)(?=[\s\S]*query, fragment or credentials)/,
    );
  });

  it("reports only the format problem for an unparsable url", () => {
    expect(() => parseEnv({ BACKEND_URL: "not a url" })).not.toThrow(
      /query, fragment or credentials/,
    );
  });
});

describe("env", () => {
  it("is parsed from the process environment", () => {
    expect(env).toEqual({ BACKEND_URL: "http://backend.test" });
  });
});
