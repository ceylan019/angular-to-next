import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import ErrorPage from "./error";

function buttonMarkup(element: ReactElement): string | undefined {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(element);
  return container.querySelector("button")?.outerHTML;
}

describe("error page", () => {
  it("shows the error message and retries", () => {
    const retry = vi.fn();
    render(<ErrorPage error={new Error("secret detail")} retry={retry} />);

    expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
    expect(retry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("does not show error details", () => {
    render(
      <ErrorPage
        error={Object.assign(new Error("secret detail"), { digest: "d1g3st" })}
        retry={vi.fn()}
      />,
    );

    expect(screen.queryByText(/secret detail/)).not.toBeInTheDocument();
    expect(screen.queryByText(/d1g3st/)).not.toBeInTheDocument();
  });

  it("offers exactly one action", () => {
    render(<ErrorPage error={new Error("x")} retry={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("renders Try again with the markup of the shared default button", () => {
    const markup = buttonMarkup(
      <ErrorPage error={new Error("x")} retry={vi.fn()} />,
    );

    expect(markup).toBeDefined();
    expect(markup).toBe(buttonMarkup(<Button type="button">Try again</Button>));
  });

  it("retries once per click", () => {
    const retry = vi.fn();
    render(<ErrorPage error={new Error("x")} retry={retry} />);
    const button = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(2);
  });
});
