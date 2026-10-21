import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { StatusRegion, StatusRegionProvider } from "@/components/status-region";
import type { CartActionState } from "./cart-actions";
import { QuantityAddForm } from "./quantity-add-form";

type Action = (
  state: CartActionState,
  formData: FormData,
) => Promise<CartActionState>;

function ui(action: Action, cap = 10) {
  return (
    <StatusRegionProvider action={action}>
      <StatusRegion />
      <QuantityAddForm slug="lavender-dusk" cap={cap} />
    </StatusRegionProvider>
  );
}

function typedQuantity(formData: FormData): string | null {
  const typed = formData.get("quantity");
  return typeof typed === "string" ? typed : null;
}

function echoing(
  outcome:
    { status: "added" | "clamped"; message: string } | { status: "error" },
): Mock<Action> {
  return vi.fn<Action>((_state, formData) =>
    Promise.resolve({ ...outcome, submittedQuantity: typedQuantity(formData) }),
  );
}

function added(): Mock<Action> {
  return echoing({
    status: "added",
    message: "Added Lavender Dusk to your cart.",
  });
}

function clamped(): Mock<Action> {
  return echoing({
    status: "clamped",
    message: "You can buy at most 10 of Lavender Dusk.",
  });
}

function quantity() {
  return screen.getByRole("spinbutton", { name: "Quantity" });
}

function addButton() {
  return screen.getByRole("button", { name: "Add to cart" });
}

const serverContainers: HTMLElement[] = [];

afterEach(() => {
  for (const container of serverContainers.splice(0)) container.remove();
});

function serverHtml(element: ReactElement): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  document.body.append(container);
  serverContainers.push(container);
  return container;
}

describe("QuantityAddForm", () => {
  it("[BR-C1] submits the chosen quantity", async () => {
    const action = added();
    render(ui(action));

    fireEvent.change(quantity(), { target: { value: "3" } });
    fireEvent.click(addButton());

    expect(
      await screen.findByText("Added Lavender Dusk to your cart."),
    ).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("slug")).toBe("lavender-dusk");
    expect(formData?.get("quantity")).toBe("3");
  });

  it("[BR-C1] submits 1 when the quantity is left at its default", async () => {
    const action = added();
    render(ui(action));

    fireEvent.click(addButton());

    await screen.findByText("Added Lavender Dusk to your cart.");
    expect(action.mock.calls[0]?.[1].get("quantity")).toBe("1");
  });

  it("[BR-C2] sends a quantity above the cap so the server clamps it and shows why", async () => {
    const action = clamped();
    render(ui(action));

    fireEvent.change(quantity(), { target: { value: "12" } });
    fireEvent.click(addButton());

    expect(
      await screen.findByText("You can buy at most 10 of Lavender Dusk."),
    ).toBeInTheDocument();
    expect(action.mock.calls[0]?.[1].get("quantity")).toBe("12");
  });

  it("[BR-C1] keeps the typed quantity after an add", async () => {
    render(ui(added()));

    fireEvent.change(quantity(), { target: { value: "2" } });
    fireEvent.click(addButton());

    await screen.findByText("Added Lavender Dusk to your cart.");
    expect(quantity()).toHaveValue(2);
  });

  it("[BR-C2] keeps the typed quantity after a clamped add", async () => {
    render(ui(clamped()));

    fireEvent.change(quantity(), { target: { value: "12" } });
    fireEvent.click(addButton());

    await screen.findByText("You can buy at most 10 of Lavender Dusk.");
    expect(quantity()).toHaveValue(12);
  });

  it("[BR-C2] keeps the latest typed quantity across adds, from added to clamped", async () => {
    const action = vi.fn<Action>();
    action.mockImplementationOnce(added());
    action.mockImplementationOnce(clamped());
    render(ui(action));

    fireEvent.change(quantity(), { target: { value: "2" } });
    fireEvent.click(addButton());
    await screen.findByText("Added Lavender Dusk to your cart.");
    expect(quantity()).toHaveValue(2);

    fireEvent.change(quantity(), { target: { value: "12" } });
    fireEvent.click(addButton());
    await screen.findByText("You can buy at most 10 of Lavender Dusk.");

    expect(quantity()).toHaveValue(12);
    expect(
      action.mock.calls.map(([, formData]) => formData.get("quantity")),
    ).toEqual(["2", "12"]);
  });

  it("[BR-C1] keeps the typed quantity when an add fails", async () => {
    const action = vi.fn<Action>();
    action.mockImplementationOnce(added());
    action.mockImplementationOnce(echoing({ status: "error" }));
    render(ui(action));

    fireEvent.click(addButton());
    await screen.findByText("Added Lavender Dusk to your cart.");
    fireEvent.change(quantity(), { target: { value: "3" } });
    fireEvent.click(addButton());

    await vi.waitFor(() => {
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
    expect(quantity()).toHaveValue(3);
  });

  it("[BR-C1] falls back to 1 when the server sends no typed quantity", async () => {
    const action = vi.fn<Action>().mockResolvedValue({
      status: "added",
      message: "Added Lavender Dusk to your cart.",
      submittedQuantity: null,
    });
    render(ui(action));

    fireEvent.change(quantity(), { target: { value: "4" } });
    fireEvent.click(addButton());

    await screen.findByText("Added Lavender Dusk to your cart.");
    expect(quantity()).toHaveValue(1);
  });

  it("[BR-C2] sends an emptied quantity as is, which the server counts as 1", async () => {
    const action = added();
    render(ui(action));

    fireEvent.change(quantity(), { target: { value: "" } });
    fireEvent.click(addButton());

    await screen.findByText("Added Lavender Dusk to your cart.");
    expect(action.mock.calls[0]?.[1].get("quantity")).toBe("");
  });

  it("[BR-C2] skips browser validation so a value above the maximum still reaches the server", () => {
    render(ui(added()));

    const form = addButton().closest("form");
    expect(form).not.toBeNull();
    expect(form?.noValidate).toBe(true);
  });

  it("[BR-C1] labels a whole number input Quantity with a minimum and default of 1", () => {
    render(ui(added()));

    expect(quantity()).toHaveAttribute("type", "number");
    expect(quantity()).toHaveAttribute("name", "quantity");
    expect(quantity()).toHaveAttribute("min", "1");
    expect(quantity()).toHaveValue(1);
    expect(quantity()).toBeEnabled();
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveAttribute("type", "submit");
  });

  it.each([[10], [3], [1]])(
    "[BR-C2] uses the cap %i as the quantity maximum",
    (cap) => {
      render(ui(added(), cap));

      expect(quantity()).toHaveAttribute("max", String(cap));
      expect(quantity()).toBeEnabled();
      expect(addButton()).toBeEnabled();
    },
  );

  it("[BR-B8] is disabled and sends nothing when the cap is 0", () => {
    const action = vi.fn<Action>();
    render(ui(action, 0));

    expect(quantity()).toBeDisabled();
    expect(addButton()).toBeDisabled();

    fireEvent.click(addButton());

    expect(action).not.toHaveBeenCalled();
  });

  it("[BR-C1] adds once per click", async () => {
    const action = added();
    render(ui(action));

    fireEvent.click(addButton());
    await screen.findByText("Added Lavender Dusk to your cart.");
    fireEvent.click(addButton());

    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(2);
    });
  });

  it("[BR-C1] the input and button are enabled in the server HTML, since the form works before hydration", () => {
    const container = serverHtml(ui(vi.fn<Action>()));

    const input = within(container).getByRole("spinbutton", {
      name: "Quantity",
    });
    const button = within(container).getByRole("button", {
      name: "Add to cart",
    });
    expect(input).toBeEnabled();
    expect(input).toHaveValue(1);
    expect(input).toHaveAttribute("max", "10");
    expect(button).toBeEnabled();
    expect(button.closest("form")?.noValidate).toBe(true);
  });

  it("[BR-B8] the input and button are disabled in the server HTML when out of stock", () => {
    const container = serverHtml(ui(vi.fn<Action>(), 0));

    expect(
      within(container).getByRole("spinbutton", { name: "Quantity" }),
    ).toBeDisabled();
    expect(
      within(container).getByRole("button", { name: "Add to cart" }),
    ).toBeDisabled();
  });

  it("[BR-C1] hydrates without a mismatch and still submits", async () => {
    const consoleError = vi.spyOn(console, "error");
    const recoverable = vi.fn();
    const action = added();
    const element = ui(action, 3);
    const container = serverHtml(element);

    render(element, {
      container,
      hydrate: true,
      onRecoverableError: recoverable,
    });

    fireEvent.change(
      within(container).getByRole("spinbutton", { name: "Quantity" }),
      { target: { value: "2" } },
    );
    fireEvent.click(
      within(container).getByRole("button", { name: "Add to cart" }),
    );

    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    expect(action.mock.calls[0]?.[1].get("quantity")).toBe("2");
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("[BR-C1] two forms on one page each label their own input", () => {
    render(
      <>
        {ui(added(), 10)}
        {ui(added(), 3)}
      </>,
    );

    const inputs = screen.getAllByRole("spinbutton", { name: "Quantity" });
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveAttribute("max", "10");
    expect(inputs[1]).toHaveAttribute("max", "3");
  });

  it("refuses to render outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(<QuantityAddForm slug="lavender-dusk" cap={10} />),
    ).toThrow("StatusRegionProvider");
  });
});
