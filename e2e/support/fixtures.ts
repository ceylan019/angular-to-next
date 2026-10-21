import {
  test as base,
  expect,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test";
import { resetBackend } from "./backend.js";

export type NoJsPageOptions = Pick<BrowserContextOptions, "storageState">;

export type ProjectContextOptions = Pick<
  BrowserContextOptions,
  "baseURL" | "viewport"
>;

export async function newNoJsPage(
  browser: Browser,
  project: ProjectContextOptions,
  options: NoJsPageOptions = {},
): Promise<Page> {
  const context = await browser.newContext({
    ...options,
    ...project,
    javaScriptEnabled: false,
  });
  return context.newPage();
}

type Fixtures = {
  resetBackendBeforeEach: undefined;
  noJsPage: (options?: NoJsPageOptions) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  resetBackendBeforeEach: [
    async ({ request }, use) => {
      await resetBackend(request);
      await use(undefined);
    },
    { auto: true },
  ],
  noJsPage: async ({ browser, baseURL, viewport }, use) => {
    const pages: Page[] = [];
    await use(async (options) => {
      const page = await newNoJsPage(browser, { baseURL, viewport }, options);
      pages.push(page);
      return page;
    });
    await Promise.all(pages.map((page) => page.context().close()));
  },
});

export { expect };
