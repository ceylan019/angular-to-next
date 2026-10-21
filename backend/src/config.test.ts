import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("defaults port to 8080 and test mode off", () => {
    expect(loadConfig({ DATABASE_URL: "postgres://x" })).toEqual({
      port: 8080,
      databaseUrl: "postgres://x",
      testMode: false,
    });
  });

  it("reads the port from PORT", () => {
    expect(
      loadConfig({ DATABASE_URL: "postgres://x", PORT: "3001" }).port,
    ).toBe(3001);
  });

  it("turns test mode on only for the exact value true", () => {
    expect(
      loadConfig({ DATABASE_URL: "postgres://x", TEST_MODE: "true" }).testMode,
    ).toBe(true);
    for (const v of ["TRUE", "1", "yes", "false", ""]) {
      expect(
        loadConfig({ DATABASE_URL: "postgres://x", TEST_MODE: v }).testMode,
      ).toBe(false);
    }
  });

  it("rejects a missing database url", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("rejects an empty database url", () => {
    expect(() => loadConfig({ DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });

  it("rejects a non numeric port", () => {
    expect(() =>
      loadConfig({ DATABASE_URL: "postgres://x", PORT: "abc" }),
    ).toThrow(/PORT/);
  });

  it("rejects ports outside the valid range or not whole numbers", () => {
    for (const v of ["0", "-1", "65536", "1.5", ""]) {
      expect(() =>
        loadConfig({ DATABASE_URL: "postgres://x", PORT: v }),
      ).toThrow(/PORT/);
    }
  });
});
