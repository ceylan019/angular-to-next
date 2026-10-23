import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StatusRegion, StatusRegionProvider } from "@/components/status-region";
import { AddToCartButton } from "./add-to-cart-button";
import type { CartActionState } from "./cart-actions";

type Action = (
  state: CartActionState,
  formData: FormData,
) => Promise<CartActionState>;

function ui(action: Action, stock = 5) {
  return (
    <StatusRegionProvider action={action}>
      <StatusRegion />
      <h2 id="lavender-heading">Lavender Dusk</h2>
      <AddToCartButton
        slug="lavender-dusk"
        disabled={stock === 0}
        describedBy="lavender-heading"
      />
    </StatusRegionProvider>
  );
}

describe("AddToCartButton", () => {
  it("[BR-C1] submits the slug and no quantity, so the list adds 1", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "added",
      message: "Added Lavender Dusk to your cart.",
      submittedQuantity: null,
    });
    render(ui(action));

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(
      await screen.findByText("Added Lavender Dusk to your cart."),
    ).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("slug")).toBe("lavender-dusk");
    expect(formData?.has("quantity")).toBe(false);
  });

  it("[BR-C1] adds once per click", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "added",
      message: "Added Lavender Dusk to your cart.",
      submittedQuantity: null,
    });
    render(ui(action));
    const button = screen.getByRole("button", { name: "Add to cart" });

    fireEvent.click(button);
    await screen.findByText("Added Lavender Dusk to your cart.");
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(2);
    });
  });

  it("[BR-B8] is disabled and sends nothing when out of stock", () => {
    const action = vi.fn<Action>();
    render(ui(action, 0));
    const button = screen.getByRole("button", { name: "Add to cart" });

    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(action).not.toHaveBeenCalled();
  });

  it("[BR-C1] is enabled in the server HTML, since the form works before hydration", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(ui(vi.fn<Action>()));

    const button = container.querySelector("button");
    expect(button?.textContent).toBe("Add to cart");
    expect(button?.disabled).toBe(false);
    expect(button?.type).toBe("submit");
  });

  it("[BR-B8] is disabled in the server HTML when out of stock", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(ui(vi.fn<Action>(), 0));

    expect(container.querySelector("button")?.disabled).toBe(true);
  });

  it("[BR-C1] is described by the element it is given and keeps the name Add to cart", () => {
    render(ui(vi.fn<Action>()));

    const button = screen.getByRole("button", { name: "Add to cart" });
    expect(button).toHaveAttribute("aria-describedby", "lavender-heading");
    expect(button).toHaveAccessibleDescription("Lavender Dusk");
  });
});
