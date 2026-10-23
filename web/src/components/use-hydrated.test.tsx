import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useHydrated } from "./use-hydrated";

function Probe() {
  return <p>{useHydrated() ? "hydrated" : "server"}</p>;
}

describe("useHydrated", () => {
  it("is false while rendering on the server", () => {
    expect(renderToString(<Probe />)).toBe("<p>server</p>");
  });

  it("starts false during hydration and turns true once hydrated", async () => {
    const consoleError = vi.spyOn(console, "error");
    const recoverable = vi.fn();
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Probe />);
    document.body.append(container);

    expect(container).toHaveTextContent("server");

    render(<Probe />, {
      container,
      hydrate: true,
      onRecoverableError: recoverable,
    });

    expect(await screen.findByText("hydrated")).toBeInTheDocument();
    expect(screen.queryByText("server")).not.toBeInTheDocument();
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("is true for a component mounted on the client", () => {
    render(<Probe />);

    expect(screen.getByText("hydrated")).toBeInTheDocument();
  });

  it("stays true across re-renders", () => {
    const { rerender } = render(<Probe />);
    rerender(<Probe />);

    expect(screen.getByText("hydrated")).toBeInTheDocument();
  });
});
