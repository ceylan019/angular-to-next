import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { request, type APIRequestContext } from "@playwright/test";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  backendUrl,
  orderCount,
  requestCount,
  resetBackend,
  resetRequestCount,
  setProduct,
} from "./backend.js";

type Received = {
  method: string | undefined;
  url: string | undefined;
  contentType: string | undefined;
  body: string;
};

let server: Server;
let api: APIRequestContext;
let base: string;
let reply: { status: number; body: string };
let received: Received[];
const originalBackendUrl = process.env.BACKEND_URL;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push({
        method: req.method,
        url: req.url,
        contentType: req.headers["content-type"],
        body: Buffer.concat(chunks).toString(),
      });
      res.statusCode = reply.status;
      res.end(reply.body);
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  api = await request.newContext();
});

afterAll(async () => {
  await api.dispose();
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

beforeEach(() => {
  process.env.BACKEND_URL = base;
  reply = { status: 204, body: "" };
  received = [];
});

afterEach(() => {
  if (originalBackendUrl === undefined) {
    delete process.env.BACKEND_URL;
  } else {
    process.env.BACKEND_URL = originalBackendUrl;
  }
});

describe("backendUrl", () => {
  it("defaults to the backend on port 8080", () => {
    expect(backendUrl({})).toBe("http://localhost:8080");
  });

  it("uses BACKEND_URL when it is set", () => {
    expect(backendUrl({ BACKEND_URL: "http://backend:9000" })).toBe(
      "http://backend:9000",
    );
  });

  it("drops trailing slashes so paths join cleanly", () => {
    expect(backendUrl({ BACKEND_URL: "http://backend:9000//" })).toBe(
      "http://backend:9000",
    );
  });

  it("reads the process environment by default", () => {
    process.env.BACKEND_URL = "http://elsewhere:1234/";

    expect(backendUrl()).toBe("http://elsewhere:1234");
  });
});

describe("resetBackend", () => {
  it("posts to the reset endpoint and accepts 204", async () => {
    await resetBackend(api);

    expect(received).toEqual([
      expect.objectContaining({ method: "POST", url: "/api/test/reset" }),
    ]);
  });

  it("follows a trailing slash in BACKEND_URL", async () => {
    process.env.BACKEND_URL = `${base}/`;

    await resetBackend(api);

    expect(received[0]?.url).toBe("/api/test/reset");
  });

  it("fails with the status and body when test mode is off", async () => {
    reply = { status: 404, body: '{"error":"NOT_FOUND"}' };

    await expect(resetBackend(api)).rejects.toThrow(
      `POST ${base}/api/test/reset answered 404 instead of 204: {"error":"NOT_FOUND"}`,
    );
  });

  it("fails on a success status other than 204", async () => {
    reply = { status: 200, body: "ok" };

    await expect(resetBackend(api)).rejects.toThrow(
      `POST ${base}/api/test/reset answered 200 instead of 204: ok`,
    );
  });
});

describe("setProduct", () => {
  it("posts the patch as JSON to the product endpoint", async () => {
    await setProduct(api, "ember-clove", { stock: 1 });

    expect(received).toEqual([
      {
        method: "POST",
        url: "/api/test/products/ember-clove",
        contentType: "application/json",
        body: '{"stock":1}',
      },
    ]);
  });

  it("sends a price and a stock of zero unchanged", async () => {
    await setProduct(api, "lavender-dusk", { stock: 0, priceCents: 1900 });

    expect(JSON.parse(received[0]?.body ?? "")).toEqual({
      stock: 0,
      priceCents: 1900,
    });
  });

  it("encodes the slug as one path segment", async () => {
    await setProduct(api, "a b/c?d", { stock: 2 });

    expect(received[0]?.url).toBe("/api/test/products/a%20b%2Fc%3Fd");
  });

  it("fails with the status and body for an unknown slug", async () => {
    reply = { status: 404, body: '{"error":"NOT_FOUND"}' };

    await expect(setProduct(api, "nope", { stock: 1 })).rejects.toThrow(
      `POST ${base}/api/test/products/nope answered 404 instead of 204: {"error":"NOT_FOUND"}`,
    );
  });

  it("fails with the status and body for a rejected patch", async () => {
    reply = { status: 400, body: '{"error":"VALIDATION","fields":[]}' };

    await expect(setProduct(api, "lavender-dusk", {})).rejects.toThrow(
      "answered 400 instead of 204",
    );
  });
});

describe.each([
  ["orderCount", orderCount, "/api/test/orders"],
  ["requestCount", requestCount, "/api/test/request-count"],
] as const)("%s", (_name, read, path) => {
  it("reads the count", async () => {
    reply = { status: 200, body: '{"count":3}' };

    await expect(read(api)).resolves.toBe(3);
    expect(received).toEqual([
      expect.objectContaining({ method: "GET", url: path }),
    ]);
  });

  it("reads a count of zero", async () => {
    reply = { status: 200, body: '{"count":0}' };

    await expect(read(api)).resolves.toBe(0);
  });

  it("fails with the status and body on an error", async () => {
    reply = { status: 500, body: '{"error":"INTERNAL"}' };

    await expect(read(api)).rejects.toThrow(
      `GET ${base}${path} answered 500 instead of 200: {"error":"INTERNAL"}`,
    );
  });

  it.each([
    '{"count":"3"}',
    '{"count":-1}',
    '{"count":1.5}',
    '{"count":null}',
    "{}",
    "[3]",
    "3",
    "null",
    "<html>",
    "",
  ])("fails on the body %j", async (body) => {
    reply = { status: 200, body };

    await expect(read(api)).rejects.toThrow(
      `GET ${base}${path} answered without a count: ${body}`,
    );
  });
});

describe("resetRequestCount", () => {
  it("posts to the request count reset endpoint and accepts 204", async () => {
    await resetRequestCount(api);

    expect(received).toEqual([
      expect.objectContaining({
        method: "POST",
        url: "/api/test/request-count/reset",
      }),
    ]);
  });

  it("fails with the status and body on an error", async () => {
    reply = { status: 404, body: "missing" };

    await expect(resetRequestCount(api)).rejects.toThrow(
      `POST ${base}/api/test/request-count/reset answered 404 instead of 204: missing`,
    );
  });
});
