import { render, screen, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProducts } from "@/lib/backend/client";
import {
  BackendContractError,
  BackendUnavailableError,
} from "@/lib/backend/errors";
import type { ProductPage, ProductSummary } from "@/lib/backend/schemas";
import { productPage } from "@/test/fixtures";
import HomePage, { metadata } from "./page";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/lib/backend/client", () => ({ getProducts: vi.fn() }));
vi.mock("@/features/cart/cart-actions", () => ({ addToCart: vi.fn() }));

type SearchParams = Record<string, string | string[] | undefined>;

const lavender = productPage.items[0] as ProductSummary;

function catalogPage(overrides: Partial<ProductPage> = {}): ProductPage {
  return { ...productPage, ...overrides };
}

function products(count: number): ProductSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    ...lavender,
    id: index + 1,
    slug: `candle-${String(index + 1)}`,
    name: `Candle ${String(index + 1)}`,
  }));
}

function pageProps(searchParams: SearchParams = {}) {
  return {
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  };
}

async function renderPage(searchParams: SearchParams = {}) {
  render(await HomePage(pageProps(searchParams)));
}

function requestedQuery(): string {
  const params = vi.mocked(getProducts).mock.calls[0]?.[0];
  return params?.toString() ?? "missing";
}

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as never);
  vi.mocked(getProducts).mockReset();
  vi.mocked(getProducts).mockResolvedValue(productPage);
});

describe("product list page", () => {
  it("[BR-B9] has the list title and the default description", () => {
    expect(metadata).toEqual({
      title: "Shop all candles | Wick & Co. Candles",
      description:
        "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
    });
  });

  it("[BR-B1] renders the heading, the filters, the sort, one empty status region and the grid", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "All candles" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Scent family" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Sort by" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    const list = screen.getByRole("list", { name: "Products" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(list.closest("[aria-busy]")).toHaveAttribute("aria-busy", "false");
    expect(
      within(list).getByRole("link", { name: "Lavender Dusk" }),
    ).toHaveAttribute("href", "/products/lavender-dusk");
    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("This page is empty.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No candles match these filters"),
    ).not.toBeInTheDocument();
  });

  it("[BR-B2] [BR-B3] [BR-B4] asks the backend for the parsed query in canonical order", async () => {
    await renderPage({
      family: ["nope", "woody", "floral", "woody"],
      sort: "price-asc",
      page: "2",
    });

    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(requestedQuery()).toBe(
      "family=floral&family=woody&sort=price-asc&page=2",
    );
  });

  it("[BR-B4] hostile query values reach the backend as defaults", async () => {
    await renderPage({ page: "1e3", sort: "PRICE-ASC", family: "nope" });

    expect(requestedQuery()).toBe("");
  });

  it("[BR-B4] invalid query values fall back to defaults in the controls", async () => {
    await renderPage({
      page: "abc",
      sort: "PRICE-ASC",
      family: ["floral", "floral", "nope"],
    });

    expect(screen.getByRole("checkbox", { name: "Floral" })).toBeChecked();
    for (const label of ["Woody", "Fresh", "Gourmand", "Spicy", "Herbal"]) {
      expect(screen.getByRole("checkbox", { name: label })).not.toBeChecked();
    }
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue(
      "name-asc",
    );
  });

  it("[BR-B2] [BR-B3] the controls show the families and sort from the URL", async () => {
    await renderPage({ family: "spicy", sort: "price-desc" });

    expect(screen.getByRole("checkbox", { name: "Spicy" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Floral" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue(
      "price-desc",
    );
  });

  it("[BR-B1] [BR-B4] shows a full page with pagination that keeps the filters", async () => {
    vi.mocked(getProducts).mockResolvedValue(
      catalogPage({
        items: products(12),
        page: 2,
        totalItems: 30,
        totalPages: 3,
      }),
    );

    await renderPage({ family: ["floral", "woody"], page: "2" });

    expect(
      within(screen.getByRole("list", { name: "Products" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(12);
    const nav = within(screen.getByRole("navigation", { name: "Pagination" }));
    expect(nav.getByRole("link", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(nav.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/?family=floral&family=woody",
    );
    expect(nav.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/?family=floral&family=woody&page=3",
    );
  });

  it("[BR-B5] no matches shows the message and Clear filters, with no list or pagination", async () => {
    vi.mocked(getProducts).mockResolvedValue(
      catalogPage({ items: [], page: 1, totalItems: 0, totalPages: 0 }),
    );

    await renderPage({ family: "herbal", sort: "price-asc" });

    expect(
      screen.getByText("No candles match these filters").closest("[aria-busy]"),
    ).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("list", { name: "Products" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("This page is empty.")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Herbal" })).toBeChecked();
  });

  it("[BR-B5] no matches wins over an out of range page", async () => {
    vi.mocked(getProducts).mockResolvedValue(
      catalogPage({ items: [], page: 4, totalItems: 0, totalPages: 0 }),
    );

    await renderPage({ family: "herbal", page: "4" });

    expect(
      screen.getByText("No candles match these filters"),
    ).toBeInTheDocument();
    expect(screen.queryByText("This page is empty.")).not.toBeInTheDocument();
  });

  it("[BR-B4] an out of range page shows the empty page message with a first page link, and no list or pagination", async () => {
    vi.mocked(getProducts).mockResolvedValue(
      catalogPage({ items: [], page: 9, totalItems: 30, totalPages: 3 }),
    );

    await renderPage({ family: "floral", sort: "price-desc", page: "9" });

    expect(screen.getByText("This page is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to page 1" })).toHaveAttribute(
      "href",
      "/?family=floral&sort=price-desc",
    );
    expect(
      screen.queryByRole("list", { name: "Products" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("No candles match these filters"),
    ).not.toBeInTheDocument();
  });

  it("a backend outage reaches the error page instead of being swallowed", async () => {
    const outage = new BackendUnavailableError("Backend request failed");
    vi.mocked(getProducts).mockRejectedValue(outage);

    await expect(HomePage(pageProps())).rejects.toBe(outage);
  });

  it("a contract violation from the backend also reaches the error page", async () => {
    const broken = new BackendContractError("Backend body does not match");
    vi.mocked(getProducts).mockRejectedValue(broken);

    await expect(HomePage(pageProps({ page: "2" }))).rejects.toBe(broken);
  });
});
