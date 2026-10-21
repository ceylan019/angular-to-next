import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { CartQuantityProvider, StatusRegion } from "@/components/status-region";
import {
  removeFromCart,
  type CartActionState,
  type QuantityChange,
} from "./cart-actions";
import { CartTable } from "./cart-table";
import type { CartRow } from "./cart-view";

vi.mock("./cart-actions", () => ({ removeFromCart: vi.fn() }));

type QuantityAction = (change: QuantityChange) => Promise<CartActionState>;

const lavenderRow: CartRow = {
  productId: 7,
  slug: "lavender-dusk",
  name: "Lavender Dusk",
  unitPriceCents: 1615,
  quantity: 2,
  lineTotalCents: 3230,
  cap: 10,
};

const emberRow: CartRow = {
  productId: 9,
  slug: "ember-clove",
  name: "Ember & Clove",
  unitPriceCents: 123456,
  quantity: 2,
  lineTotalCents: 246912,
  cap: 3,
};

const capped: CartActionState = {
  status: "clamped",
  message: "You can buy at most 10 of Lavender Dusk.",
  submittedQuantity: "15",
};

function ui(rows: CartRow[], action: QuantityAction): ReactElement {
  return (
    <CartQuantityProvider action={action}>
      <StatusRegion />
      <CartTable rows={rows} />
    </CartQuantityProvider>
  );
}

function answering(...states: CartActionState[]): Mock<QuantityAction> {
  const action = vi.fn<QuantityAction>();
  for (const state of states) action.mockResolvedValueOnce(state);
  return action;
}

function quantityFor(name: string): HTMLInputElement {
  return screen.getByRole("spinbutton", { name: `Quantity for ${name}` });
}

function type(input: HTMLInputElement, value: string): void {
  fireEvent.input(input, { target: { value } });
}

function commit(input: HTMLInputElement): void {
  fireEvent.change(input);
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

describe("CartTable", () => {
  it("[BR-C5] table shows headers, labeled quantity inputs and named remove buttons", () => {
    render(ui([lavenderRow, emberRow], answering()));

    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Candle", "Price", "Quantity", "Total", "Actions"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(quantityFor("Lavender Dusk")).toHaveValue(2);
    expect(quantityFor("Ember & Clove")).toHaveValue(2);

    const remove = screen.getByRole("button", { name: "Remove Lavender Dusk" });
    expect(remove.firstChild?.textContent).toBe("Remove");
    const hiddenName = within(remove).getByText("Lavender Dusk");
    expect(hiddenName).toHaveClass("sr-only");
    expect(hiddenName.textContent).toBe(" Lavender Dusk");
    expect(
      screen.getByRole("button", { name: "Remove Ember & Clove" }),
    ).toBeInTheDocument();
  });

  it("[BR-C1] links each name to its detail page beside the unit price and the line total", () => {
    render(ui([lavenderRow, emberRow], answering()));

    const [, lavender, ember] = screen.getAllByRole("row");
    if (lavender === undefined || ember === undefined) {
      throw new Error("Expected two product rows");
    }
    expect(
      within(lavender).getByRole("link", { name: "Lavender Dusk" }),
    ).toHaveAttribute("href", "/products/lavender-dusk");
    expect(
      within(lavender)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Lavender Dusk",
      "$16.15",
      "Quantity for Lavender Dusk",
      "$32.30",
      "Remove Lavender Dusk",
    ]);
    expect(
      within(ember).getByRole("link", { name: "Ember & Clove" }),
    ).toHaveAttribute("href", "/products/ember-clove");
    expect(within(ember).getByText("$1,234.56")).toBeInTheDocument();
    expect(within(ember).getByText("$2,469.12")).toBeInTheDocument();
  });

  it("[BR-C2] bounds each quantity input by 1 and the cap of its line", () => {
    render(
      ui(
        [
          lavenderRow,
          emberRow,
          {
            ...emberRow,
            productId: 11,
            slug: "gone-dark",
            name: "Gone Dark",
            cap: 0,
          },
        ],
        answering(),
      ),
    );

    expect(quantityFor("Lavender Dusk")).toHaveAttribute("min", "1");
    expect(quantityFor("Lavender Dusk")).toHaveAttribute("max", "10");
    expect(quantityFor("Ember & Clove")).toHaveAttribute("min", "1");
    expect(quantityFor("Ember & Clove")).toHaveAttribute("max", "3");
    expect(quantityFor("Gone Dark")).toHaveAttribute("max", "0");
  });

  it("[BR-C2] commits the typed quantity on change, not while typing", async () => {
    const action = answering({ status: "updated", submittedQuantity: "4" });
    render(ui([lavenderRow], action));
    const input = quantityFor("Lavender Dusk");

    type(input, "4");

    expect(input).toHaveValue(4);
    expect(action).not.toHaveBeenCalled();

    commit(input);

    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    expect(action).toHaveBeenCalledWith({ productId: 7, quantity: "4" });
  });

  it("[BR-C2] sends the raw text of the input so the server can normalize it", async () => {
    const action = answering(
      { status: "updated", submittedQuantity: "" },
      { status: "updated", submittedQuantity: "2.5" },
    );
    render(ui([lavenderRow], action));
    const input = quantityFor("Lavender Dusk");

    type(input, "");
    commit(input);
    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    type(input, "2.5");
    commit(input);

    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(2);
    });
    expect(action.mock.calls).toEqual([
      [{ productId: 7, quantity: "" }],
      [{ productId: 7, quantity: "2.5" }],
    ]);
  });

  it("[BR-C2] shows the cap message and puts the cap back in a line already at the cap", async () => {
    render(ui([{ ...lavenderRow, quantity: 10 }], answering(capped)));
    const input = quantityFor("Lavender Dusk");

    type(input, "15");
    commit(input);

    expect(
      await screen.findByText("You can buy at most 10 of Lavender Dusk."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /^You can buy at most 10 of Lavender Dusk\.$/,
    );
    expect(input).toHaveValue(10);
  });

  it("[BR-C3] keeps showing the typed value while the change is on its way", async () => {
    const answers: ((state: CartActionState) => void)[] = [];
    const action = vi.fn<QuantityAction>(
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        }),
    );
    render(ui([lavenderRow], action));
    const input = quantityFor("Lavender Dusk");

    type(input, "0");
    commit(input);
    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });

    expect(input).toHaveValue(0);

    answers[0]?.({ status: "updated", submittedQuantity: "0" });

    await vi.waitFor(() => {
      expect(input).toHaveValue(2);
    });
  });

  it("[BR-C3] shows the quantity of the re-rendered cart once the change lands", async () => {
    const action = answering({ status: "updated", submittedQuantity: "0" });
    const { rerender } = render(ui([{ ...lavenderRow, quantity: 3 }], action));
    const input = quantityFor("Lavender Dusk");

    type(input, "0");
    commit(input);
    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    rerender(ui([{ ...lavenderRow, quantity: 1 }], action));

    await vi.waitFor(() => {
      expect(input).toHaveValue(1);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("[BR-C3] puts the cart quantity back when the change fails", async () => {
    render(
      ui([lavenderRow], answering({ status: "error", submittedQuantity: "7" })),
    );
    const input = quantityFor("Lavender Dusk");

    type(input, "7");
    commit(input);

    await vi.waitFor(() => {
      expect(input).toHaveValue(2);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("[BR-C3] sends each change with the product id of its own row", async () => {
    const action = answering({ status: "updated", submittedQuantity: "1" });
    render(ui([lavenderRow, emberRow], action));
    const input = quantityFor("Ember & Clove");

    type(input, "1");
    commit(input);

    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledWith({ productId: 9, quantity: "1" });
    });
    expect(quantityFor("Lavender Dusk")).toHaveValue(2);
  });

  it("[BR-C3] Remove submits the form bound to removeFromCart for its row", async () => {
    render(ui([lavenderRow, emberRow], answering()));

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Ember & Clove" }),
    );

    await vi.waitFor(() => {
      expect(removeFromCart).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(removeFromCart).mock.calls[0]?.[0]).toBe(9);
  });

  it("[BR-C3] the quantity input waits for hydration while Remove works at once", () => {
    const container = serverHtml(ui([lavenderRow], answering()));

    const input = within(container).getByRole("spinbutton", {
      name: "Quantity for Lavender Dusk",
    });
    expect(input).toBeDisabled();
    expect(input).toHaveValue(2);
    const remove = within(container).getByRole("button", {
      name: "Remove Lavender Dusk",
    });
    expect(remove).toBeEnabled();
    expect(remove).toHaveAttribute("type", "submit");
    expect(remove.closest("form")).not.toBeNull();
  });

  it("[BR-C3] hydrates without a mismatch and then accepts changes", async () => {
    const consoleError = vi.spyOn(console, "error");
    const recoverable = vi.fn();
    const action = answering({ status: "updated", submittedQuantity: "3" });
    const element = ui([lavenderRow], action);
    const container = serverHtml(element);

    render(element, {
      container,
      hydrate: true,
      onRecoverableError: recoverable,
    });

    const input = within(container).getByRole("spinbutton", {
      name: "Quantity for Lavender Dusk",
    });
    await vi.waitFor(() => {
      expect(input).toBeEnabled();
    });
    type(input, "3");
    commit(input);

    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledWith({ productId: 7, quantity: "3" });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("stops listening for changes once the row is gone", () => {
    const action = answering();
    const { rerender } = render(ui([lavenderRow], action));
    const input = quantityFor("Lavender Dusk");

    rerender(ui([], action));
    type(input, "4");
    commit(input);

    expect(action).not.toHaveBeenCalled();
  });
});
