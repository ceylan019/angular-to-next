import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { CheckoutForm } from "./checkout-form";
import type { CheckoutValues } from "./checkout-schema";
import type { PlaceOrderActionResult } from "./place-order-action";

type Action = (values: CheckoutValues) => Promise<PlaceOrderActionResult>;

const LABELS: Record<keyof CheckoutValues, string> = {
  email: "Email",
  fullName: "Full name",
  line1: "Address line 1",
  line2: "Address line 2 (optional)",
  city: "City",
  postalCode: "Postal code",
  country: "Country",
  cardNumber: "Card number",
  expiry: "Expiry (MM/YY)",
  cvc: "CVC",
};

const REQUIRED: [string, string][] = [
  ["Email", "Enter your email address"],
  ["Full name", "Enter your full name"],
  ["Address line 1", "Enter your address"],
  ["City", "Enter your city"],
  ["Postal code", "Enter your postal code"],
  ["Country", "Select your country"],
  ["Card number", "Enter your card number"],
  ["Expiry (MM/YY)", "Enter the card expiry date"],
  ["CVC", "Enter the CVC"],
];

const VALID: CheckoutValues = {
  email: "ada@example.com",
  fullName: "Ada Lovelace",
  line1: "12 Analytical Way",
  line2: "",
  city: "London",
  postalCode: "SW1A 1AA",
  country: "GB",
  cardNumber: "4242 4242 4242 4242",
  expiry: "12/40",
  cvc: "123",
};

const DECLINED = "Your card was declined.";
const PRICE_CHANGED =
  "Prices changed for some items. Please review your order and place it again.";

function outOfStock(name: string): string {
  return `${name} is no longer available in the quantity you chose. We updated your cart.`;
}

function answering(...results: PlaceOrderActionResult[]): Mock<Action> {
  const action = vi.fn<Action>();
  for (const result of results) action.mockResolvedValueOnce(result);
  return action;
}

const holds: ((result: PlaceOrderActionResult) => void)[][] = [];

function holding(): {
  action: Mock<Action>;
  answer: (result: PlaceOrderActionResult) => Promise<void>;
} {
  const answers: ((result: PlaceOrderActionResult) => void)[] = [];
  holds.push(answers);
  const action = vi.fn<Action>(
    () =>
      new Promise((resolve) => {
        answers.push(resolve);
      }),
  );
  return {
    action,
    answer: async (result) => {
      await waitFor(() => {
        expect(answers).not.toHaveLength(0);
      });
      await act(async () => {
        answers.shift()?.(result);
        await Promise.resolve();
      });
    },
  };
}

function control(label: string): HTMLInputElement | HTMLSelectElement {
  return screen.getByLabelText(label, { exact: true });
}

function type(label: string, value: string): void {
  fireEvent.change(control(label), { target: { value } });
}

function fill(overrides: Partial<CheckoutValues> = {}): void {
  const values = { ...VALID, ...overrides };
  for (const [name, label] of Object.entries(LABELS)) {
    type(label, values[name as keyof CheckoutValues]);
  }
}

function placeOrderButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Place order" });
}

function placeOrder(): void {
  fireEvent.click(placeOrderButton());
}

function alertRegion(): HTMLElement {
  return screen.getByRole("alert");
}

function errorFor(label: string): string | null {
  const describedBy = control(label).getAttribute("aria-describedby");
  if (describedBy === null) return null;
  return document.getElementById(describedBy)?.textContent ?? null;
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
}

const serverContainers: HTMLElement[] = [];

afterEach(async () => {
  for (const container of serverContainers.splice(0)) container.remove();
  await act(async () => {
    for (const answers of holds.splice(0)) {
      for (const resolve of answers.splice(0)) resolve({ status: "declined" });
    }
    await Promise.resolve();
  });
});

function serverHtml(element: ReactElement): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  document.body.append(container);
  serverContainers.push(container);
  return container;
}

describe("CheckoutForm", () => {
  it("[BR-K2] groups the labeled fields under Contact, Shipping address and Payment", () => {
    render(<CheckoutForm action={answering()} />);

    const groups = screen.getAllByRole("group");
    expect(
      groups.map((group) => group.querySelector("legend")?.textContent),
    ).toEqual(["Contact", "Shipping address", "Payment"]);
    const fieldsIn = (name: string) =>
      [
        ...screen
          .getByRole("group", { name })
          .querySelectorAll("input, select"),
      ].map((element) => element.id);
    expect(fieldsIn("Contact")).toEqual([control("Email").id]);
    expect(fieldsIn("Shipping address")).toEqual(
      [
        "Full name",
        "Address line 1",
        "Address line 2 (optional)",
        "City",
        "Postal code",
        "Country",
      ].map((label) => control(label).id),
    );
    expect(fieldsIn("Payment")).toEqual(
      ["Card number", "Expiry (MM/YY)", "CVC"].map(
        (label) => control(label).id,
      ),
    );
    for (const label of Object.values(LABELS)) {
      expect(control(label)).toHaveValue("");
      expect(control(label)).toBeEnabled();
      expect(control(label)).not.toHaveAttribute("aria-invalid");
      expect(control(label)).not.toHaveAttribute("aria-describedby");
    }
  });

  it("[BR-K2] offers the five countries after an empty first choice", () => {
    render(<CheckoutForm action={answering()} />);

    const options = within(control("Country")).getAllByRole("option");
    expect(
      options.map((option) => [
        option.textContent,
        option.getAttribute("value"),
      ]),
    ).toEqual([
      ["Select a country", ""],
      ["United States", "US"],
      ["Canada", "CA"],
      ["United Kingdom", "GB"],
      ["Germany", "DE"],
      ["Netherlands", "NL"],
    ]);
    expect(control("Country").tagName).toBe("SELECT");
  });

  it("[BR-K2] helps the browser fill every field", () => {
    render(<CheckoutForm action={answering()} />);

    expect(
      Object.values(LABELS).map((label) => [
        label,
        control(label).getAttribute("autocomplete"),
      ]),
    ).toEqual([
      ["Email", "email"],
      ["Full name", "name"],
      ["Address line 1", "address-line1"],
      ["Address line 2 (optional)", "address-line2"],
      ["City", "address-level2"],
      ["Postal code", "postal-code"],
      ["Country", "country"],
      ["Card number", "cc-number"],
      ["Expiry (MM/YY)", "cc-exp"],
      ["CVC", "cc-csc"],
    ]);
    expect(control("Email")).toHaveAttribute("type", "email");
    expect(control("Card number")).toHaveAttribute("inputmode", "numeric");
    expect(control("CVC")).toHaveAttribute("inputmode", "numeric");
  });

  it("[BR-K2] places one empty alert region above a form the browser does not validate", () => {
    const { container } = render(<CheckoutForm action={answering()} />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form).toHaveAttribute("novalidate");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(alertRegion()).toBeEmptyDOMElement();
    expect(form?.contains(alertRegion())).toBe(false);
    expect(
      alertRegion().compareDocumentPosition(form as HTMLFormElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(placeOrderButton()).toHaveAttribute("type", "submit");
    expect(form?.contains(placeOrderButton())).toBe(true);
  });

  it("[BR-K2] shows every required error after submit and focuses Email", async () => {
    const action = answering();
    render(<CheckoutForm action={action} />);

    placeOrder();

    expect(
      await screen.findByText("Enter your email address"),
    ).toBeInTheDocument();
    for (const [label, message] of REQUIRED) {
      expect(control(label)).toHaveAttribute("aria-invalid", "true");
      expect(errorFor(label)).toBe(message);
    }
    expect(control("Address line 2 (optional)")).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(errorFor("Address line 2 (optional)")).toBeNull();
    await waitFor(() => {
      expect(control("Email")).toHaveFocus();
    });
    expect(action).not.toHaveBeenCalled();
    expect(alertRegion()).toBeEmptyDOMElement();
  });

  it("[BR-K2] focuses the first invalid field only once its error is in the page", async () => {
    render(<CheckoutForm action={answering()} />);
    const email = control("Email");
    const seen: { invalid: string | null; error: string | null }[] = [];
    email.addEventListener("focus", () => {
      seen.push({
        invalid: email.getAttribute("aria-invalid"),
        error: errorFor("Email"),
      });
    });

    placeOrder();

    await waitFor(() => {
      expect(email).toHaveFocus();
    });
    await settle();
    expect(seen).toEqual([
      { invalid: "true", error: "Enter your email address" },
    ]);
  });

  it("[BR-K2] moves focus to the first invalid field in page order on every failed submit", async () => {
    const action = answering();
    render(<CheckoutForm action={action} />);
    fill({ postalCode: "AB", cvc: "12" });

    placeOrder();

    await waitFor(() => {
      expect(control("Postal code")).toHaveFocus();
    });
    expect(errorFor("Postal code")).toBe("Enter a valid postal code");
    expect(errorFor("CVC")).toBe("Enter a valid 3 digit CVC");

    type("Postal code", "SW1A 1AA");
    control("Email").focus();
    placeOrder();

    await waitFor(() => {
      expect(control("CVC")).toHaveFocus();
    });
    expect(errorFor("Postal code")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("[BR-K2] validates the optional second address line too", async () => {
    const action = answering();
    render(<CheckoutForm action={action} />);
    fill({ line2: "a".repeat(201) });

    placeOrder();

    await waitFor(() => {
      expect(control("Address line 2 (optional)")).toHaveFocus();
    });
    expect(errorFor("Address line 2 (optional)")).toBe(
      "Use 200 characters or fewer",
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("[BR-K2] shows no error before the first submit", async () => {
    render(<CheckoutForm action={answering()} />);

    type("Email", "ada@");
    type("CVC", "1");
    await settle();

    expect(errorFor("Email")).toBeNull();
    expect(errorFor("CVC")).toBeNull();
    expect(control("Email")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Enter a valid email address")).toBeNull();
  });

  it("[BR-K2] clears a field error on change after the first submit", async () => {
    render(<CheckoutForm action={answering()} />);
    placeOrder();
    await screen.findByText("Enter your email address");

    type("Email", "ada@example");

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Enter your email address")).toBeNull();
    expect(errorFor("Email")).toBe("Enter a valid email address");

    type("Email", "ada@example.com");

    await waitFor(() => {
      expect(screen.queryByText("Enter a valid email address")).toBeNull();
    });
    expect(control("Email")).not.toHaveAttribute("aria-invalid");
    expect(control("Email")).not.toHaveAttribute("aria-describedby");
    expect(errorFor("Full name")).toBe("Enter your full name");
  });

  it("[BR-K6] [KD-05] submits once when Place order is clicked twice", async () => {
    const { action, answer } = holding();
    render(<CheckoutForm action={action} />);
    fill();

    placeOrder();
    placeOrder();

    const placing = await screen.findByRole("button", {
      name: "Placing order...",
    });
    expect(placing).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Place order" })).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);

    await answer({ status: "declined" });
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(DECLINED)).toBeInTheDocument();
    expect(placeOrderButton()).toBeEnabled();
  });

  it("[BR-K6] allows a new attempt once the field errors are fixed", async () => {
    const action = answering({ status: "declined" });
    render(<CheckoutForm action={action} />);
    placeOrder();
    await screen.findByText("Enter your email address");

    fill();
    placeOrder();

    expect(await screen.findByText(DECLINED)).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("[BR-K3] shows the declined alert and keeps the values", async () => {
    const action = answering({ status: "declined" }, { status: "declined" });
    render(<CheckoutForm action={action} />);
    fill({ cardNumber: "4000 0000 0000 0002", line2: "Flat 2" });

    placeOrder();

    expect(
      await within(alertRegion()).findByText(DECLINED),
    ).toBeInTheDocument();
    expect(action).toHaveBeenCalledWith({
      ...VALID,
      cardNumber: "4000 0000 0000 0002",
      line2: "Flat 2",
    });
    const kept = {
      ...VALID,
      cardNumber: "4000 0000 0000 0002",
      line2: "Flat 2",
    };
    for (const [name, label] of Object.entries(LABELS)) {
      expect(control(label)).toHaveValue(kept[name as keyof CheckoutValues]);
    }
    expect(placeOrderButton()).toBeEnabled();

    placeOrder();

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(2);
    });
    expect(
      await within(alertRegion()).findByText(DECLINED),
    ).toBeInTheDocument();
  });

  it("[BR-K4] shows the out of stock and price alerts", async () => {
    const action = answering(
      {
        status: "out-of-stock",
        messages: [outOfStock("Ember & Clove"), outOfStock("Last Light")],
      },
      { status: "price-changed" },
    );
    render(<CheckoutForm action={action} />);
    fill();

    placeOrder();

    expect(
      await within(alertRegion()).findByText(outOfStock("Ember & Clove")),
    ).toBeInTheDocument();
    expect(
      within(alertRegion()).getByText(outOfStock("Last Light")),
    ).toBeInTheDocument();
    expect(control("Email")).toHaveValue(VALID.email);

    placeOrder();

    expect(
      await within(alertRegion()).findByText(PRICE_CHANGED),
    ).toBeInTheDocument();
    expect(alertRegion().textContent).toBe(PRICE_CHANGED);
    expect(control("CVC")).toHaveValue(VALID.cvc);
  });

  it("[BR-K2] shows the backend validation alert", async () => {
    render(<CheckoutForm action={answering({ status: "invalid" })} />);
    fill();

    placeOrder();

    expect(
      await within(alertRegion()).findByText(
        "Please check your details and try again.",
      ),
    ).toBeInTheDocument();
    expect(control("Full name")).toHaveValue(VALID.fullName);
  });

  it("[BR-K3] keeps the declined alert when the retry fails field validation", async () => {
    const action = answering({ status: "declined" });
    render(<CheckoutForm action={action} />);
    fill();
    placeOrder();
    await within(alertRegion()).findByText(DECLINED);

    type("CVC", "");
    placeOrder();

    await waitFor(() => {
      expect(control("CVC")).toHaveFocus();
    });
    expect(errorFor("CVC")).toBe("Enter the CVC");
    expect(alertRegion()).toHaveTextContent(DECLINED);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("[BR-K3] clears the alert while the order is placed again", async () => {
    const { action, answer } = holding();
    render(<CheckoutForm action={action} />);
    fill();
    placeOrder();
    await answer({ status: "declined" });
    await within(alertRegion()).findByText(DECLINED);

    placeOrder();

    await screen.findByRole("button", { name: "Placing order..." });
    expect(alertRegion()).toBeEmptyDOMElement();

    await answer({ status: "price-changed" });

    expect(
      await within(alertRegion()).findByText(PRICE_CHANGED),
    ).toBeInTheDocument();
    expect(alertRegion()).not.toHaveTextContent(DECLINED);
  });

  it("[BR-K2] sends the trimmed values to the action", async () => {
    const action = answering({ status: "declined" });
    render(<CheckoutForm action={action} />);
    fill({
      fullName: "  Zoë Ångström ",
      line1: " 5 Åkerbärsvägen ",
      city: " Malmö ",
      cvc: " 123 ",
    });

    placeOrder();

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    expect(action).toHaveBeenCalledWith({
      ...VALID,
      fullName: "Zoë Ångström",
      line1: "5 Åkerbärsvägen",
      city: "Malmö",
    });
    expect(control("Full name")).toHaveValue("  Zoë Ångström ");
  });

  it("[BR-K6] renders Place order disabled until hydration while the fields stay enabled", () => {
    const container = serverHtml(<CheckoutForm action={answering()} />);

    const button = within(container).getByRole("button", {
      name: "Place order",
    });
    expect(button).toBeDisabled();
    for (const label of Object.values(LABELS)) {
      expect(
        within(container).getByLabelText(label, { exact: true }),
      ).toBeEnabled();
    }
  });

  it("[BR-K6] hydrates without a mismatch and then enables Place order", async () => {
    const consoleError = vi.spyOn(console, "error");
    const recoverable = vi.fn();
    const action = answering({ status: "declined" });
    const element = <CheckoutForm action={action} />;
    const container = serverHtml(element);

    render(element, {
      container,
      hydrate: true,
      onRecoverableError: recoverable,
    });

    await waitFor(() => {
      expect(placeOrderButton()).toBeEnabled();
    });
    fill();
    placeOrder();
    expect(await screen.findByText(DECLINED)).toBeInTheDocument();
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("[BR-K2] keeps and sends what was typed before hydration", async () => {
    const action = answering({ status: "declined" });
    const element = <CheckoutForm action={action} />;
    const container = serverHtml(element);
    const email = within(container).getByLabelText("Email", { exact: true });
    (email as HTMLInputElement).value = "early@example.com";

    render(element, { container, hydrate: true });

    await waitFor(() => {
      expect(placeOrderButton()).toBeEnabled();
    });
    expect(control("Email")).toHaveValue("early@example.com");
    for (const [name, label] of Object.entries(LABELS)) {
      if (name !== "email") type(label, VALID[name as keyof CheckoutValues]);
    }
    placeOrder();

    expect(await screen.findByText(DECLINED)).toBeInTheDocument();
    expect(action).toHaveBeenCalledWith({
      ...VALID,
      email: "early@example.com",
    });
  });
});
