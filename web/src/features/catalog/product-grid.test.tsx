import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusRegion, StatusRegionProvider } from "@/components/status-region";
import type { CartActionState } from "@/features/cart/cart-actions";
import type { ProductSummary } from "@/lib/backend/schemas";
import { productPage } from "@/test/fixtures";
import { PRODUCT_IMAGE_SIZES } from "./product-card";
import { ProductGrid } from "./product-grid";

const lavender = productPage.items[0] as ProductSummary;

const emberClove: ProductSummary = {
  id: 12,
  slug: "ember-clove",
  name: "Ember Clove",
  family: "spicy",
  priceCents: 123456,
  stock: 2,
  imageUrl: "/images/ember-clove.jpg",
};

const soldOut: ProductSummary = {
  id: 21,
  slug: "fig-cassis",
  name: "Fig & Cassis",
  family: "gourmand",
  priceCents: 1615,
  stock: 0,
  imageUrl: "/images/fig-cassis.jpg",
};

function renderGrid(products: ProductSummary[]) {
  const action =
    vi.fn<
      (state: CartActionState, formData: FormData) => Promise<CartActionState>
    >();
  return render(
    <StatusRegionProvider action={action}>
      <StatusRegion />
      <ProductGrid products={products} />
    </StatusRegionProvider>,
  );
}

function candles(count: number, prefix: string): ProductSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    ...lavender,
    id: index + 1,
    slug: `${prefix}-${String(index + 1)}`,
    name: `${prefix} ${String(index + 1)}`,
    imageUrl: `/images/${prefix}-${String(index + 1)}.jpg`,
  }));
}

function preloaded(image: HTMLElement): boolean {
  return Array.from(
    document.head.querySelectorAll('link[rel="preload"][as="image"]'),
  ).some(
    (link) => link.getAttribute("imagesrcset") === image.getAttribute("srcset"),
  );
}

function card(name: string) {
  const heading = screen.getByRole("heading", { level: 2, name });
  const item = heading.closest("li");
  if (item === null) throw new Error(`No list item holds ${name}`);
  return within(item);
}

describe("ProductGrid", () => {
  it("[BR-B1] [BR-B8] grid renders a labeled list and disables out of stock buttons", () => {
    renderGrid([emberClove, lavender, soldOut]);

    const list = screen.getByRole("list", { name: "Products" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);

    expect(
      card("Lavender Dusk").getByRole("button", { name: "Add to cart" }),
    ).toBeEnabled();
    expect(
      card("Ember Clove").getByRole("button", { name: "Add to cart" }),
    ).toBeEnabled();
    expect(
      card("Fig & Cassis").getByRole("button", { name: "Add to cart" }),
    ).toBeDisabled();
    expect(card("Fig & Cassis").getByText("Out of stock")).toBeInTheDocument();
  });

  it("[BR-B1] each card links its name to the product page and shows price and stock status", () => {
    renderGrid([emberClove, lavender]);

    const lavenderCard = card("Lavender Dusk");
    expect(
      lavenderCard.getByRole("link", { name: "Lavender Dusk" }),
    ).toHaveAttribute("href", "/products/lavender-dusk");
    expect(lavenderCard.getByText("$16.15")).toBeInTheDocument();
    expect(lavenderCard.getByText("In stock")).toBeInTheDocument();

    const emberCard = card("Ember Clove");
    expect(
      emberCard.getByRole("link", { name: "Ember Clove" }),
    ).toHaveAttribute("href", "/products/ember-clove");
    expect(emberCard.getByText("$1,234.56")).toBeInTheDocument();
    expect(emberCard.getByText("Only 2 left")).toBeInTheDocument();
  });

  it("[BR-B1] keeps the order the backend sent", () => {
    renderGrid([soldOut, emberClove, lavender]);

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(["Fig & Cassis", "Ember Clove", "Lavender Dusk"]);
  });

  it("[BR-B1] shows each product image named after the product, sized for the grid", () => {
    renderGrid([lavender, soldOut]);

    const image = card("Lavender Dusk").getByRole("img", {
      name: "Lavender Dusk",
    });
    expect(image).toHaveAttribute("sizes", PRODUCT_IMAGE_SIZES);
    expect(image.getAttribute("src")).toContain(
      encodeURIComponent("/images/lavender-dusk.jpg"),
    );
    expect(
      card("Fig & Cassis").getByRole("img", { name: "Fig & Cassis" }),
    ).toBeInTheDocument();
    expect(PRODUCT_IMAGE_SIZES).toBe(
      "(min-width: 1024px) 272px, (min-width: 640px) 50vw, 100vw",
    );
  });

  it("[BR-B1] each card holds one heading, one product link and one button", () => {
    renderGrid([lavender]);

    const item = screen.getByRole("listitem");
    expect(within(item).getAllByRole("heading")).toHaveLength(1);
    expect(within(item).getAllByRole("link")).toHaveLength(1);
    expect(within(item).getAllByRole("button")).toHaveLength(1);
  });

  it("[BR-B1] renders twelve cards for a full page", () => {
    const page = Array.from({ length: 12 }, (_, index) => ({
      ...lavender,
      id: index + 1,
      slug: `candle-${String(index + 1)}`,
      name: `Candle ${String(index + 1)}`,
    }));
    renderGrid(page);

    expect(
      within(screen.getByRole("list", { name: "Products" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(12);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("[BR-B1] preloads the first row of three images and lazy loads the rest", () => {
    renderGrid(candles(5, "row"));

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(5);
    for (const image of images.slice(0, 3)) {
      expect(image).not.toHaveAttribute("loading", "lazy");
      expect(preloaded(image)).toBe(true);
    }
    for (const image of images.slice(3)) {
      expect(image).toHaveAttribute("loading", "lazy");
      expect(preloaded(image)).toBe(false);
    }
  });

  it("[BR-B1] preloads every image of a grid shorter than one row", () => {
    renderGrid(candles(2, "short"));

    for (const image of screen.getAllByRole("img")) {
      expect(image).not.toHaveAttribute("loading", "lazy");
      expect(preloaded(image)).toBe(true);
    }
  });

  it("[BR-B1] each Add to cart button is described by its card heading and keeps its name", () => {
    renderGrid([emberClove, lavender, soldOut]);

    for (const name of ["Ember Clove", "Lavender Dusk", "Fig & Cassis"]) {
      const button = card(name).getByRole("button", { name: "Add to cart" });
      expect(button).toHaveAccessibleName("Add to cart");
      expect(button).toHaveAccessibleDescription(name);
    }
  });
});
