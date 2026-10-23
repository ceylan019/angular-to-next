import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser, type Page } from "@playwright/test";
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
  newNoJsPage,
  type NoJsPageOptions,
  type ProjectContextOptions,
} from "./fixtures.js";

const PROBE =
  '<p id="probe">server</p><script>document.getElementById("probe").textContent = "script";</script>';

let browser: Browser;
let server: Server;
let base: string;
let seen: { url: string | undefined; cookie: string | undefined }[];
let pages: Page[];

beforeAll(async () => {
  browser = await chromium.launch();
  server = createServer((req, res) => {
    seen.push({ url: req.url, cookie: req.headers.cookie });
    res.setHeader("content-type", "text/html");
    res.end(PROBE);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  await browser.close();
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

afterEach(async () => {
  await Promise.all(pages.map((page) => page.context().close()));
});

async function open(
  project: ProjectContextOptions,
  options?: NoJsPageOptions,
): Promise<Page> {
  const page = await newNoJsPage(browser, project, options);
  pages.push(page);
  return page;
}

describe("newNoJsPage", () => {
  beforeEach(() => {
    seen = [];
    pages = [];
  });

  it("runs page scripts in an ordinary context, so the probe is meaningful", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    pages.push(page);

    await page.setContent(PROBE);

    await expect(page.locator("#probe").textContent()).resolves.toBe("script");
  });

  it("opens a page that never runs page scripts", async () => {
    const page = await open({ baseURL: base, viewport: null });

    await page.setContent(PROBE);

    await expect(page.locator("#probe").textContent()).resolves.toBe("server");
  });

  it("resolves paths against the project base URL", async () => {
    const page = await open({ baseURL: base, viewport: null });

    await page.goto("/products/lavender-dusk");

    expect(seen.map((request) => request.url)).toContain(
      "/products/lavender-dusk",
    );
    await expect(page.locator("#probe").textContent()).resolves.toBe("server");
  });

  it("uses the project viewport", async () => {
    const page = await open({
      baseURL: base,
      viewport: { width: 1280, height: 800 },
    });

    expect(page.viewportSize()).toEqual({ width: 1280, height: 800 });
  });

  it("starts from the given storage state and sends its cookies", async () => {
    const page = await open(
      { baseURL: base, viewport: null },
      {
        storageState: {
          cookies: [
            {
              name: "cart",
              value: "lavender-dusk.2",
              domain: "127.0.0.1",
              path: "/",
              expires: -1,
              httpOnly: false,
              secure: false,
              sameSite: "Lax",
            },
          ],
          origins: [],
        },
      },
    );

    await page.goto("/cart");

    expect(seen.find((request) => request.url === "/cart")?.cookie).toBe(
      "cart=lavender-dusk.2",
    );
  });

  it("starts from an empty state without storage state", async () => {
    const page = await open({ baseURL: base, viewport: null });

    await page.goto("/cart");

    const request = seen.find((candidate) => candidate.url === "/cart");
    expect(request).toBeDefined();
    expect(request?.cookie).toBeUndefined();
  });

  it("gives every call its own context", async () => {
    const first = await open({ baseURL: base, viewport: null });
    const second = await open({ baseURL: base, viewport: null });

    expect(first.context()).not.toBe(second.context());
  });
});
