import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import {
  lavenderDusk,
  placeOrderInput,
  productPage,
  sampleOrder,
} from "@/test/fixtures";
import { BackendContractError, BackendUnavailableError } from "./errors";
import {
  getFamilies,
  getOrder,
  getProduct,
  getProducts,
  placeOrder,
} from "./client";

const BASE = "http://backend.test";

const families = [
  { slug: "floral", name: "Floral" },
  { slug: "woody", name: "Woody" },
];

function timedOutSignal(): AbortSignal {
  return AbortSignal.abort(
    new DOMException("The operation timed out", "TimeoutError"),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getFamilies", () => {
  it("returns the families in order", async () => {
    server.use(
      http.get(`${BASE}/api/families`, () => HttpResponse.json(families)),
    );
    await expect(getFamilies()).resolves.toEqual(families);
  });

  it("returns an empty list", async () => {
    server.use(http.get(`${BASE}/api/families`, () => HttpResponse.json([])));
    await expect(getFamilies()).resolves.toEqual([]);
  });

  it("raises BackendContractError when the body is not a list", async () => {
    server.use(
      http.get(`${BASE}/api/families`, () => HttpResponse.json({ families })),
    );
    await expect(getFamilies()).rejects.toBeInstanceOf(BackendContractError);
  });

  it("raises BackendContractError for an unknown family slug", async () => {
    server.use(
      http.get(`${BASE}/api/families`, () =>
        HttpResponse.json([{ slug: "citrus", name: "Citrus" }]),
      ),
    );
    await expect(getFamilies()).rejects.toBeInstanceOf(BackendContractError);
  });

  it("raises BackendContractError for a status the contract does not list", async () => {
    server.use(
      http.get(`${BASE}/api/families`, () =>
        HttpResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
      ),
    );
    await expect(getFamilies()).rejects.toBeInstanceOf(BackendContractError);
  });
});

describe("getProducts", () => {
  it("returns a parsed page", async () => {
    server.use(
      http.get(`${BASE}/api/products`, () => HttpResponse.json(productPage)),
    );
    await expect(getProducts(new URLSearchParams())).resolves.toEqual(
      productPage,
    );
  });

  it("sends repeated family params", async () => {
    let search = "";
    let families: string[] = [];
    server.use(
      http.get(`${BASE}/api/products`, ({ request }) => {
        const url = new URL(request.url);
        search = url.search;
        families = url.searchParams.getAll("family");
        return HttpResponse.json(productPage);
      }),
    );
    await getProducts(
      new URLSearchParams([
        ["family", "floral"],
        ["family", "woody"],
        ["sort", "price-asc"],
        ["page", "2"],
      ]),
    );
    expect(families).toEqual(["floral", "woody"]);
    expect(search).toBe("?family=floral&family=woody&sort=price-asc&page=2");
  });

  it("sends no query string for empty params", async () => {
    let search: string | undefined;
    server.use(
      http.get(`${BASE}/api/products`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json(productPage);
      }),
    );
    await getProducts(new URLSearchParams());
    expect(search).toBe("");
  });

  it("raises BackendContractError when the page size is wrong", async () => {
    server.use(
      http.get(`${BASE}/api/products`, () =>
        HttpResponse.json({ ...productPage, pageSize: 20 }),
      ),
    );
    await expect(getProducts(new URLSearchParams())).rejects.toBeInstanceOf(
      BackendContractError,
    );
  });

  it("raises BackendContractError for a 400", async () => {
    server.use(
      http.get(`${BASE}/api/products`, () =>
        HttpResponse.json({ error: "BAD" }, { status: 400 }),
      ),
    );
    await expect(getProducts(new URLSearchParams())).rejects.toBeInstanceOf(
      BackendContractError,
    );
  });
});

describe("getProduct", () => {
  it("parses a product", async () => {
    server.use(
      http.get(`${BASE}/api/products/lavender-dusk`, () =>
        HttpResponse.json(lavenderDusk),
      ),
    );
    await expect(getProduct("lavender-dusk")).resolves.toEqual(lavenderDusk);
  });

  it("[BR-B7] returns null for a missing product", async () => {
    server.use(
      http.get(`${BASE}/api/products/nope`, () =>
        HttpResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
      ),
    );
    await expect(getProduct("nope")).resolves.toBeNull();
  });

  it("raises BackendContractError when a field is missing", async () => {
    const withoutPrice = Object.fromEntries(
      Object.entries(lavenderDusk).filter(([key]) => key !== "priceCents"),
    );
    server.use(
      http.get(`${BASE}/api/products/lavender-dusk`, () =>
        HttpResponse.json(withoutPrice),
      ),
    );
    const failure = await getProduct("lavender-dusk").catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(BackendContractError);
    expect((failure as BackendContractError).cause).toBeDefined();
  });

  it("raises BackendContractError when the body is not JSON", async () => {
    server.use(
      http.get(`${BASE}/api/products/lavender-dusk`, () =>
        HttpResponse.text("<html>"),
      ),
    );
    await expect(getProduct("lavender-dusk")).rejects.toBeInstanceOf(
      BackendContractError,
    );
  });

  it("raises BackendContractError for a status the contract does not list", async () => {
    server.use(
      http.get(`${BASE}/api/products/lavender-dusk`, () =>
        HttpResponse.json({}, { status: 403 }),
      ),
    );
    await expect(getProduct("lavender-dusk")).rejects.toBeInstanceOf(
      BackendContractError,
    );
  });
});

describe("unavailable backend", () => {
  it.each([500, 502, 503, 504, 599])(
    "raises BackendUnavailableError on a %i",
    async (status) => {
      server.use(
        http.get(`${BASE}/api/products/lavender-dusk`, () =>
          HttpResponse.text("boom", { status }),
        ),
      );
      await expect(getProduct("lavender-dusk")).rejects.toBeInstanceOf(
        BackendUnavailableError,
      );
    },
  );

  it("raises BackendUnavailableError on a network error and keeps the cause", async () => {
    server.use(
      http.get(`${BASE}/api/products/lavender-dusk`, () =>
        HttpResponse.error(),
      ),
    );
    const failure = await getProduct("lavender-dusk").catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(BackendUnavailableError);
    expect((failure as BackendUnavailableError).cause).toBeInstanceOf(Error);
  });

  it("raises BackendUnavailableError on a timeout and keeps the cause", async () => {
    const signal = timedOutSignal();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    server.use(
      http.get(`${BASE}/api/products/lavender-dusk`, () =>
        HttpResponse.json(lavenderDusk),
      ),
    );
    const failure = await getProduct("lavender-dusk").catch(
      (error: unknown) => error,
    );
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(failure).toBeInstanceOf(BackendUnavailableError);
    expect((failure as BackendUnavailableError).cause).toBe(signal.reason);
  });

  it.each([
    ["getFamilies", () => getFamilies()],
    ["getProducts", () => getProducts(new URLSearchParams())],
    ["getProduct", () => getProduct("lavender-dusk")],
    ["getOrder", () => getOrder("WC-AB12CD")],
    ["placeOrder", () => placeOrder(placeOrderInput)],
  ])("%s times out after 5000 ms", async (_name, call) => {
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timedOutSignal());
    await expect(call()).rejects.toBeInstanceOf(BackendUnavailableError);
    expect(timeout).toHaveBeenCalledWith(5000);
  });
});

describe("request options", () => {
  it.each([
    ["getFamilies", () => getFamilies()],
    ["getProducts", () => getProducts(new URLSearchParams())],
    ["getProduct", () => getProduct("lavender-dusk")],
    ["getOrder", () => getOrder("WC-AB12CD")],
    ["placeOrder", () => placeOrder(placeOrderInput)],
  ])("%s never caches and carries an abort signal", async (_name, call) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    server.use(
      http.all(`${BASE}/api/*`, () => HttpResponse.json({}, { status: 500 })),
    );
    await call().catch(() => undefined);
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("getOrder", () => {
  it("parses an order", async () => {
    server.use(
      http.get(`${BASE}/api/orders/WC-AB12CD`, () =>
        HttpResponse.json(sampleOrder),
      ),
    );
    await expect(getOrder("WC-AB12CD")).resolves.toEqual(sampleOrder);
  });

  it("[BR-K7] returns null for a missing order", async () => {
    server.use(
      http.get(`${BASE}/api/orders/WC-ZZZZZZ`, () =>
        HttpResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
      ),
    );
    await expect(getOrder("WC-ZZZZZZ")).resolves.toBeNull();
  });

  it("raises BackendContractError for a malformed order", async () => {
    server.use(
      http.get(`${BASE}/api/orders/WC-AB12CD`, () =>
        HttpResponse.json({ ...sampleOrder, orderNumber: "bad" }),
      ),
    );
    await expect(getOrder("WC-AB12CD")).rejects.toBeInstanceOf(
      BackendContractError,
    );
  });

  it("raises BackendUnavailableError on a 500", async () => {
    server.use(
      http.get(`${BASE}/api/orders/WC-AB12CD`, () =>
        HttpResponse.text("boom", { status: 500 }),
      ),
    );
    await expect(getOrder("WC-AB12CD")).rejects.toBeInstanceOf(
      BackendUnavailableError,
    );
  });
});

describe("placeOrder", () => {
  const stockItems = [{ productId: 7, available: 1 }];
  const priceItems = [{ productId: 7, unitPriceCents: 1700 }];

  const mockOrders = (
    status: number,
    body: Parameters<typeof HttpResponse.json>[0],
  ) => {
    server.use(
      http.post(`${BASE}/api/orders`, () =>
        HttpResponse.json(body, { status }),
      ),
    );
  };

  it.each([
    ["201", 201, sampleOrder, { kind: "placed", order: sampleOrder }],
  ] as const)(
    "[BR-K5] maps %s to %s",
    async (_label, status, body, expected) => {
      mockOrders(status, body);
      await expect(placeOrder(placeOrderInput)).resolves.toEqual(expected);
    },
  );

  it.each([
    [
      "400 VALIDATION",
      400,
      { error: "VALIDATION", fields: ["contact.email", "payment.cvc"] },
      { kind: "invalid", fields: ["contact.email", "payment.cvc"] },
    ],
    [
      "400 VALIDATION without fields to report",
      400,
      { error: "VALIDATION", fields: [] },
      { kind: "invalid", fields: [] },
    ],
  ] as const)(
    "[BR-K2] maps %s to %s",
    async (_label, status, body, expected) => {
      mockOrders(status, body);
      await expect(placeOrder(placeOrderInput)).resolves.toEqual(expected);
    },
  );

  it.each([
    [
      "402 CARD_DECLINED",
      402,
      { error: "CARD_DECLINED" },
      { kind: "declined" },
    ],
  ] as const)(
    "[BR-K3] maps %s to %s",
    async (_label, status, body, expected) => {
      mockOrders(status, body);
      await expect(placeOrder(placeOrderInput)).resolves.toEqual(expected);
    },
  );

  it.each([
    [
      "409 OUT_OF_STOCK",
      409,
      { error: "OUT_OF_STOCK", items: stockItems },
      { kind: "out-of-stock", items: stockItems },
    ],
    [
      "409 PRICE_CHANGED",
      409,
      { error: "PRICE_CHANGED", items: priceItems },
      { kind: "price-changed", items: priceItems },
    ],
  ] as const)(
    "[BR-K4] maps %s to %s",
    async (_label, status, body, expected) => {
      mockOrders(status, body);
      await expect(placeOrder(placeOrderInput)).resolves.toEqual(expected);
    },
  );

  it("keeps both parse errors as the cause of an unknown 409 body", async () => {
    mockOrders(409, { error: "SOMETHING_ELSE" });
    const failure = await placeOrder(placeOrderInput).catch(
      (error: unknown) => error,
    );
    const cause = (failure as BackendContractError).cause;
    expect(cause).toBeInstanceOf(AggregateError);
    expect((cause as AggregateError).errors).toHaveLength(2);
  });

  it("posts the input as JSON", async () => {
    let method = "";
    let contentType: string | null = null;
    let received: unknown;
    server.use(
      http.post(`${BASE}/api/orders`, async ({ request }) => {
        method = request.method;
        contentType = request.headers.get("content-type");
        received = await request.json();
        return HttpResponse.json(sampleOrder, { status: 201 });
      }),
    );
    await placeOrder(placeOrderInput);
    expect(method).toBe("POST");
    expect(contentType).toBe("application/json");
    expect(received).toEqual(placeOrderInput);
  });

  it.each([
    ["an unknown 409 body", 409, { error: "SOMETHING_ELSE" }],
    ["a 409 without a body tag", 409, {}],
    ["a 409 with malformed items", 409, { error: "OUT_OF_STOCK", items: "x" }],
    ["a 400 with another tag", 400, { error: "NOT_FOUND" }],
    ["a 400 without fields", 400, { error: "VALIDATION" }],
    ["a 402 with another tag", 402, { error: "OTHER" }],
    ["a 201 with a malformed order", 201, { orderNumber: "WC-AB12CD" }],
    ["a 200", 200, sampleOrder],
    ["a 404", 404, { error: "NOT_FOUND" }],
    ["a 422", 422, {}],
  ])("raises BackendContractError for %s", async (_label, status, body) => {
    server.use(
      http.post(`${BASE}/api/orders`, () =>
        HttpResponse.json(body, { status }),
      ),
    );
    await expect(placeOrder(placeOrderInput)).rejects.toBeInstanceOf(
      BackendContractError,
    );
  });

  it.each([
    ["a 400", 400],
    ["a 402", 402],
    ["a 409", 409],
    ["a 201", 201],
  ])(
    "raises BackendContractError for %s with a non JSON body",
    async (_l, status) => {
      server.use(
        http.post(`${BASE}/api/orders`, () =>
          HttpResponse.text("oops", { status }),
        ),
      );
      await expect(placeOrder(placeOrderInput)).rejects.toBeInstanceOf(
        BackendContractError,
      );
    },
  );

  it("raises BackendUnavailableError on a 500", async () => {
    server.use(
      http.post(`${BASE}/api/orders`, () =>
        HttpResponse.text("boom", { status: 500 }),
      ),
    );
    await expect(placeOrder(placeOrderInput)).rejects.toBeInstanceOf(
      BackendUnavailableError,
    );
  });

  it("raises BackendUnavailableError on a network error", async () => {
    server.use(http.post(`${BASE}/api/orders`, () => HttpResponse.error()));
    await expect(placeOrder(placeOrderInput)).rejects.toBeInstanceOf(
      BackendUnavailableError,
    );
  });
});

describe("body read failures", () => {
  function stallingStream(onSecondRead?: () => void) {
    let reads = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1;
        if (reads === 1) {
          controller.enqueue(new TextEncoder().encode('{"par'));
          return;
        }
        onSecondRead?.();
        return new Promise<void>(() => undefined);
      },
    });
  }

  it("raises BackendUnavailableError when the body stream errors partway", async () => {
    const reset = new TypeError("terminated");
    server.use(
      http.get(`${BASE}/api/products/lavender-dusk`, () => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"par'));
          },
          pull(controller) {
            controller.error(reset);
          },
        });
        return new HttpResponse(body, {
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const failure = await getProduct("lavender-dusk").catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(BackendUnavailableError);
    expect((failure as BackendUnavailableError).cause).toBeDefined();
  });

  it("raises BackendUnavailableError when the timeout fires during the body", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const reason = new DOMException("timed out", "TimeoutError");
    server.use(
      http.get(`${BASE}/api/products/lavender-dusk`, () => {
        const body = stallingStream(() => {
          controller.abort(reason);
        });
        return new HttpResponse(body, {
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const failure = await getProduct("lavender-dusk").catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(BackendUnavailableError);
    expect((failure as BackendUnavailableError).cause).toBe(reason);
  });
});

describe("path segment validation", () => {
  it.each([".", "..", "", "Upper", "a b", "a/b", "-a", "a-"])(
    "getProduct returns null without fetching for %j",
    async (slug) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      await expect(getProduct(slug)).resolves.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each([".", "..", "", "wc-ab12cd", "WC-AB12C", "WC-AB12CDE", "WC-AB12C!"])(
    "getOrder returns null without fetching for %j",
    async (orderNumber) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      await expect(getOrder(orderNumber)).resolves.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );
});

describe("unread bodies", () => {
  it.each([
    ["a 500", 500],
    ["an unexpected 403", 403],
    ["a 404", 404],
  ])("cancels the body of %s", async (_label, status) => {
    const cancel = vi.fn(() => Promise.resolve());
    const body = new ReadableStream<Uint8Array>({ cancel });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, { status }),
    );
    await getProduct("lavender-dusk").catch(() => undefined);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
