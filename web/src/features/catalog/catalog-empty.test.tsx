import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyPage, NoMatches } from "./catalog-empty";

describe("catalog empty states", () => {
  it("[BR-B5] no matches shows the message and a Clear filters link to the shop", () => {
    render(<NoMatches />);

    expect(
      screen.getByText("No candles match these filters"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("[BR-B4] an empty page shows the message and a Go to page 1 link that keeps families and sort", () => {
    render(
      <EmptyPage
        query={{ families: ["floral"], sort: "price-desc", page: 3 }}
      />,
    );

    expect(screen.getByText("This page is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to page 1" })).toHaveAttribute(
      "href",
      "/?family=floral&sort=price-desc",
    );
  });

  it("[BR-B4] the Go to page 1 link of an unfiltered empty page is the shop", () => {
    render(<EmptyPage query={{ families: [], sort: "name-asc", page: 9 }} />);

    expect(screen.getByRole("link", { name: "Go to page 1" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
