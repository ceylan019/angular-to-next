import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "./support/test-app.js";

describe("static images", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>["app"];
  let close: () => Promise<void>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    close = testApp.close;
  });

  afterAll(async () => {
    await close();
  });

  it("serves a generated product image as jpeg", async () => {
    const res = await request(app).get("/images/lavender-dusk.jpg");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
  });

  it("answers 404 for an unknown image", async () => {
    const res = await request(app).get("/images/unknown-candle.jpg");
    expect(res.status).toBe(404);
  });

  it("does not serve files outside the images directory", async () => {
    const res = await request(app).get("/images/..%2Fpackage.json");
    expect(res.status).not.toBe(200);
  });
});
