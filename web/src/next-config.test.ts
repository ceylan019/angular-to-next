import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("next config", () => {
  it("does not announce the framework in a response header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("sends the security headers on every route", async () => {
    expect(await nextConfig.headers?.()).toEqual([
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ]);
  });
});
