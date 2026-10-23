import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { createRequestCounter } from "./request-counter.js";

function hit(counter: ReturnType<typeof createRequestCounter>, path: string) {
  let calls = 0;
  const next: NextFunction = () => {
    calls += 1;
  };
  counter.middleware({ path } as Request, {} as Response, next);
  return calls;
}

describe("createRequestCounter", () => {
  it("starts at zero", () => {
    expect(createRequestCounter().count()).toBe(0);
  });

  it("counts api paths", () => {
    const counter = createRequestCounter();
    hit(counter, "/api/products");
    hit(counter, "/api/products/lavender");
    hit(counter, "/api/orders");
    expect(counter.count()).toBe(3);
  });

  it("always calls next exactly once", () => {
    const counter = createRequestCounter();
    expect(hit(counter, "/api/products")).toBe(1);
    expect(hit(counter, "/api/health")).toBe(1);
    expect(hit(counter, "/images/a.png")).toBe(1);
  });

  it("ignores the health path", () => {
    const counter = createRequestCounter();
    hit(counter, "/api/health");
    expect(counter.count()).toBe(0);
  });

  it("counts paths that only start with the health path", () => {
    const counter = createRequestCounter();
    hit(counter, "/api/healthy");
    hit(counter, "/api/health/deep");
    expect(counter.count()).toBe(2);
  });

  it("ignores test routes", () => {
    const counter = createRequestCounter();
    hit(counter, "/api/test/reset");
    hit(counter, "/api/test/orders");
    hit(counter, "/api/test");
    expect(counter.count()).toBe(0);
  });

  it("ignores paths outside the api", () => {
    const counter = createRequestCounter();
    hit(counter, "/images/lavender.png");
    hit(counter, "/");
    hit(counter, "/apiary");
    hit(counter, "/api");
    hit(counter, "/x/api/products");
    expect(counter.count()).toBe(0);
  });

  it("resets to zero and keeps counting", () => {
    const counter = createRequestCounter();
    hit(counter, "/api/products");
    counter.reset();
    expect(counter.count()).toBe(0);
    hit(counter, "/api/products");
    expect(counter.count()).toBe(1);
  });

  it("keeps separate counts per counter", () => {
    const a = createRequestCounter();
    const b = createRequestCounter();
    hit(a, "/api/products");
    expect(b.count()).toBe(0);
  });
});
