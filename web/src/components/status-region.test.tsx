import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import type {
  CartActionState,
  QuantityChange,
} from "@/features/cart/cart-actions";
import {
  CartQuantityProvider,
  StatusRegion,
  StatusRegionProvider,
  useCartActionState,
  useCartFormAction,
  useCartQuantityAction,
} from "./status-region";

type Action = (
  state: CartActionState,
  formData: FormData,
) => Promise<CartActionState>;

function SendForm({ label, slug }: { label: string; slug: string }) {
  const action = useCartFormAction();
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <button type="submit">{label}</button>
    </form>
  );
}

function renderRegion(action: Action) {
  return render(
    <StatusRegionProvider action={action}>
      <StatusRegion />
      <SendForm label="Send one" slug="lavender-dusk" />
      <SendForm label="Send two" slug="orange-grove" />
    </StatusRegionProvider>,
  );
}

function results(...states: CartActionState[]): Mock<Action> {
  const action = vi.fn<Action>();
  for (const state of states) action.mockResolvedValueOnce(state);
  return action;
}

const added: CartActionState = {
  status: "added",
  message: "Added Lavender Dusk to your cart.",
  submittedQuantity: null,
};

describe("StatusRegion", () => {
  it("[BR-C1] is present and empty before anything is added", () => {
    renderRegion(results());

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("[BR-C1] shows the message the cart action returns", async () => {
    const action = results(added);
    renderRegion(action);

    fireEvent.click(screen.getByRole("button", { name: "Send one" }));

    expect(
      await screen.findByText("Added Lavender Dusk to your cart."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Added Lavender Dusk to your cart.",
    );
    expect(action).toHaveBeenCalledTimes(1);
    const [state, formData] = action.mock.calls[0] ?? [];
    expect(state).toEqual({ status: "idle" });
    expect(formData?.get("slug")).toBe("lavender-dusk");
  });

  it("[BR-C2] shows the clamped message", async () => {
    renderRegion(
      results({
        status: "clamped",
        message: "You can buy at most 10 of Lavender Dusk.",
        submittedQuantity: null,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Send one" }));

    expect(
      await screen.findByText("You can buy at most 10 of Lavender Dusk."),
    ).toBeInTheDocument();
  });

  it("[BR-C1] every form reports to the one region and passes the previous result on", async () => {
    const action = results(added, {
      status: "added",
      message: "Added Orange Grove to your cart.",
      submittedQuantity: null,
    });
    renderRegion(action);

    fireEvent.click(screen.getByRole("button", { name: "Send one" }));
    await screen.findByText("Added Lavender Dusk to your cart.");
    fireEvent.click(screen.getByRole("button", { name: "Send two" }));

    expect(
      await screen.findByText("Added Orange Grove to your cart."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      /^Added Orange Grove to your cart\.$/,
    );
    expect(action.mock.calls[1]?.[0]).toEqual(added);
    expect(action.mock.calls[1]?.[1].get("slug")).toBe("orange-grove");
  });

  it("[BR-C1] clears the region when an add fails", async () => {
    renderRegion(results(added, { status: "error", submittedQuantity: null }));

    fireEvent.click(screen.getByRole("button", { name: "Send one" }));
    await screen.findByText("Added Lavender Dusk to your cart.");
    fireEvent.click(screen.getByRole("button", { name: "Send one" }));

    await vi.waitFor(() => {
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });

  it("[BR-C2] replaces the message node when the same cap message comes back, so it is announced again", async () => {
    const capped: CartActionState = {
      status: "clamped",
      message: "You can buy at most 10 of Lavender Dusk.",
      submittedQuantity: null,
    };
    renderRegion(results(capped, { ...capped }));

    fireEvent.click(screen.getByRole("button", { name: "Send one" }));
    const first = await screen.findByText(
      "You can buy at most 10 of Lavender Dusk.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Send one" }));

    await vi.waitFor(() => {
      expect(
        screen.getByText("You can buy at most 10 of Lavender Dusk."),
      ).not.toBe(first);
    });
    expect(first).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /^You can buy at most 10 of Lavender Dusk\.$/,
    );
  });

  it("refuses to render outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<StatusRegion />)).toThrow("StatusRegionProvider");
    expect(() =>
      render(<SendForm label="Send" slug="lavender-dusk" />),
    ).toThrow("StatusRegionProvider");
  });
});

type QuantityAction = (change: QuantityChange) => Promise<CartActionState>;

function SendChange({
  label,
  change,
}: {
  label: string;
  change: QuantityChange;
}) {
  const commit = useCartQuantityAction();
  return (
    <button
      type="button"
      onClick={() => {
        commit(change);
      }}
    >
      {label}
    </button>
  );
}

function LastStatus() {
  return <p data-testid="last-status">{useCartActionState().status}</p>;
}

function renderQuantityRegion(action: QuantityAction) {
  return render(
    <CartQuantityProvider action={action}>
      <StatusRegion />
      <LastStatus />
      <SendChange label="Set 15" change={{ productId: 7, quantity: "15" }} />
      <SendChange label="Set 2" change={{ productId: 7, quantity: "2" }} />
    </CartQuantityProvider>,
  );
}

function quantityResults(...states: CartActionState[]): Mock<QuantityAction> {
  const action = vi.fn<QuantityAction>();
  for (const state of states) action.mockResolvedValueOnce(state);
  return action;
}

const capped: CartActionState = {
  status: "clamped",
  message: "You can buy at most 10 of Lavender Dusk.",
  submittedQuantity: "15",
};

describe("CartQuantityProvider", () => {
  it("starts idle with one empty status region", () => {
    renderQuantityRegion(quantityResults());

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByTestId("last-status")).toHaveTextContent("idle");
  });

  it("[BR-C2] sends the change to its action and shows the cap message", async () => {
    const action = quantityResults(capped);
    renderQuantityRegion(action);

    fireEvent.click(screen.getByRole("button", { name: "Set 15" }));

    expect(
      await screen.findByText("You can buy at most 10 of Lavender Dusk."),
    ).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith({ productId: 7, quantity: "15" });
    expect(screen.getByTestId("last-status")).toHaveTextContent("clamped");
  });

  it("[BR-C2] clears an earlier cap message after a change that is not clamped", async () => {
    const action = quantityResults(capped, {
      status: "updated",
      submittedQuantity: "2",
    });
    renderQuantityRegion(action);

    fireEvent.click(screen.getByRole("button", { name: "Set 15" }));
    await screen.findByText("You can buy at most 10 of Lavender Dusk.");
    fireEvent.click(screen.getByRole("button", { name: "Set 2" }));

    await vi.waitFor(() => {
      expect(screen.getByTestId("last-status")).toHaveTextContent("updated");
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(action).toHaveBeenLastCalledWith({ productId: 7, quantity: "2" });
  });

  it("[BR-C2] keeps the region empty when a change fails", async () => {
    renderQuantityRegion(
      quantityResults({ status: "error", submittedQuantity: "15" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Set 15" }));

    await vi.waitFor(() => {
      expect(screen.getByTestId("last-status")).toHaveTextContent("error");
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("[BR-C2] announces the same cap message again on a repeated clamp", async () => {
    renderQuantityRegion(quantityResults(capped, { ...capped }));

    fireEvent.click(screen.getByRole("button", { name: "Set 15" }));
    const first = await screen.findByText(
      "You can buy at most 10 of Lavender Dusk.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Set 15" }));

    await vi.waitFor(() => {
      expect(
        screen.getByText("You can buy at most 10 of Lavender Dusk."),
      ).not.toBe(first);
    });
  });

  it("hands out one commit function across renders and results", async () => {
    const seen: ((change: QuantityChange) => void)[] = [];
    function Probe() {
      seen.push(useCartQuantityAction());
      useCartActionState();
      return null;
    }
    const action = quantityResults(capped);
    const tree = (
      <CartQuantityProvider action={action}>
        <Probe />
        <SendChange label="Set 15" change={{ productId: 7, quantity: "15" }} />
      </CartQuantityProvider>
    );
    const { rerender } = render(tree);

    rerender(
      <CartQuantityProvider action={action}>
        <Probe />
        <SendChange label="Set 15" change={{ productId: 7, quantity: "15" }} />
      </CartQuantityProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set 15" }));
    await vi.waitFor(() => {
      expect(seen.length).toBeGreaterThanOrEqual(3);
    });

    expect(new Set(seen).size).toBe(1);
  });

  it("refuses quantity changes outside a quantity provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <StatusRegionProvider action={vi.fn()}>
          <SendChange label="Set" change={{ productId: 7, quantity: "1" }} />
        </StatusRegionProvider>,
      ),
    ).toThrow("CartQuantityProvider");
  });

  it("offers no add form action under the quantity provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <CartQuantityProvider action={vi.fn()}>
          <SendForm label="Send" slug="lavender-dusk" />
        </CartQuantityProvider>,
      ),
    ).toThrow("StatusRegionProvider");
  });
});
