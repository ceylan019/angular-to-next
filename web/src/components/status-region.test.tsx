import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { CartActionState } from "@/features/cart/cart-actions";
import {
  StatusRegion,
  StatusRegionProvider,
  useCartFormAction,
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
    renderRegion(results(added, { status: "error" }));

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
