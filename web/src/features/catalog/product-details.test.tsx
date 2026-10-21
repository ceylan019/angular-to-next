import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusRegionProvider } from "@/components/status-region";
import type { CartActionState } from "@/features/cart/cart-actions";
import type { ProductDetail } from "@/lib/backend/schemas";
import { lavenderDusk } from "@/test/fixtures";
import { PRODUCT_DETAIL_IMAGE_SIZES, ProductDetails } from "./product-details";

type Action = (
  state: CartActionState,
  formData: FormData,
) => Promise<CartActionState>;

const lavender: ProductDetail = {
  ...lavenderDusk,
  scentNotes: ["lavender", "bergamot", "musk"],
  burnTimeHours: 45,
  sizeOz: 8,
};

const emberClove: ProductDetail = {
  id: 12,
  slug: "ember-clove",
  name: "Ember & Clove",
  family: "spicy",
  priceCents: 123456,
  stock: 3,
  imageUrl: "/images/ember-clove.jpg",
  summary: "Glowing clove and orange peel on dark amber.",
  description: "Clove bud, cinnamon bark and a curl of orange peel.",
  scentNotes: ["clove", "cinnamon", "orange peel", "amber"],
  burnTimeHours: 46,
  sizeOz: 10,
};

function renderDetails(
  product: ProductDetail,
  action = vi.fn<Action>(),
): typeof action {
  render(
    <StatusRegionProvider action={action}>
      <ProductDetails product={product} />
    </StatusRegionProvider>,
  );
  return action;
}

function quantity() {
  return screen.getByRole("spinbutton", { name: "Quantity" });
}

function addButton() {
  return screen.getByRole("button", { name: "Add to cart" });
}

describe("ProductDetails", () => {
  it("[BR-B6] renders details", () => {
    renderDetails(lavender);

    expect(
      screen.getByRole("heading", { level: 1, name: "Lavender Dusk" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$16.15")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(
      screen.getByText("A calming candle poured in small batches."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Scent notes: lavender, bergamot, musk"),
    ).toBeInTheDocument();
    expect(screen.getByText("Burn time: 45 hours")).toBeInTheDocument();
    expect(screen.getByText("Size: 8 oz")).toBeInTheDocument();
    expect(quantity()).toHaveValue(1);
    expect(quantity()).toHaveAttribute("min", "1");
    expect(quantity()).toHaveAttribute("max", "10");
    expect(quantity()).toBeEnabled();
    expect(addButton()).toBeEnabled();
  });

  it("[BR-B6] shows the values of the product it is given", () => {
    renderDetails(emberClove);

    expect(
      screen.getByRole("heading", { level: 1, name: "Ember & Clove" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
    expect(
      screen.getByText("Clove bud, cinnamon bark and a curl of orange peel."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Scent notes: clove, cinnamon, orange peel, amber"),
    ).toBeInTheDocument();
    expect(screen.getByText("Burn time: 46 hours")).toBeInTheDocument();
    expect(screen.getByText("Size: 10 oz")).toBeInTheDocument();
    expect(screen.queryByText(/Soft lavender/)).not.toBeInTheDocument();
  });

  it("[BR-B6] lists a single scent note without a separator", () => {
    renderDetails({ ...lavender, scentNotes: ["cedar"] });

    expect(screen.getByText("Scent notes: cedar")).toBeInTheDocument();
  });

  it("[BR-B6] shows the product image named after the product, preloaded and sized for the page", () => {
    renderDetails(lavender);

    const image = screen.getByRole("img", { name: "Lavender Dusk" });
    expect(image).not.toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("sizes", PRODUCT_DETAIL_IMAGE_SIZES);
    expect(image.getAttribute("src")).toContain(
      encodeURIComponent("/images/lavender-dusk.jpg"),
    );
    expect(PRODUCT_DETAIL_IMAGE_SIZES).toBe(
      "(min-width: 1152px) 536px, (min-width: 768px) 50vw, 100vw",
    );
  });

  it("[BR-B6] holds one empty status region for cart messages", () => {
    renderDetails(lavender);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("[BR-B6] the quantity maximum is the stock when stock is below 10", () => {
    renderDetails(emberClove);

    expect(quantity()).toHaveAttribute("max", "3");
    expect(quantity()).toBeEnabled();
  });

  it("[BR-B6] the quantity maximum is 1 when one candle is left", () => {
    renderDetails({ ...lavender, stock: 1 });

    expect(screen.getByText("Only 1 left")).toBeInTheDocument();
    expect(quantity()).toHaveAttribute("max", "1");
    expect(addButton()).toBeEnabled();
  });

  it("[BR-B6] the quantity maximum is 10 when exactly 10 are in stock", () => {
    renderDetails({ ...lavender, stock: 10 });

    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(quantity()).toHaveAttribute("max", "10");
  });

  it("[BR-B8] disables quantity and button when out of stock", () => {
    const action = renderDetails({ ...lavender, stock: 0 });

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(quantity()).toBeDisabled();
    expect(addButton()).toBeDisabled();

    fireEvent.click(addButton());

    expect(action).not.toHaveBeenCalled();
  });

  it("[BR-C1] adds the chosen quantity and shows the cart message in the status region", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "added",
      message: "Added Lavender Dusk to your cart.",
    });
    renderDetails(lavender, action);

    fireEvent.change(quantity(), { target: { value: "2" } });
    fireEvent.click(addButton());

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Added Lavender Dusk to your cart.",
    );
    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("slug")).toBe("lavender-dusk");
    expect(formData?.get("quantity")).toBe("2");
  });
});
