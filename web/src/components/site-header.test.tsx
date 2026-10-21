import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("[BR-C4] renders brand, Shop and the cart count", () => {
    render(<SiteHeader cartCount={3} />);

    const banner = screen.getByRole("banner");
    expect(
      within(banner).getByRole("link", { name: "Wick & Co. Candles" }),
    ).toHaveAttribute("href", "/");

    const nav = within(banner).getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Shop" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(nav).getByRole("link", { name: "Cart (3)" })).toHaveAttribute(
      "href",
      "/cart",
    );
  });

  it("[KD-04] shows the real count, including zero and large totals", () => {
    const { rerender } = render(<SiteHeader cartCount={0} />);
    expect(screen.getByRole("link", { name: "Cart (0)" })).toBeInTheDocument();

    rerender(<SiteHeader cartCount={120} />);
    expect(
      screen.getByRole("link", { name: "Cart (120)" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cart (0)" })).toBeNull();
  });

  it("[BR-C4] has exactly one main navigation with two links", () => {
    render(<SiteHeader cartCount={1} />);

    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(
      within(screen.getByRole("navigation", { name: "Main" })).getAllByRole(
        "link",
      ),
    ).toHaveLength(2);
  });
});
