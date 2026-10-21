import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "./support/test-app.js";

describe("health and fallback", () => {
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

  it("answers health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("answers 404 json for unknown api routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "NOT_FOUND" });
  });

  it("answers 404 json for unknown api routes with other methods", async () => {
    const res = await request(app).post("/api/nope").send({});
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "NOT_FOUND" });
  });

  it("rejects bodies larger than 100kb", async () => {
    const res = await request(app)
      .post("/api/nope")
      .send({ pad: "x".repeat(150 * 1024) });
    expect(res.status).toBe(413);
  });
});
