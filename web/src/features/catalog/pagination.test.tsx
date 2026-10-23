import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CatalogQuery } from "./catalog-query";
import { Pagination } from "./pagination";

function query(overrides: Partial<CatalogQuery> = {}): CatalogQuery {
  return { families: [], sort: "name-asc", page: 1, ...overrides };
}

function nav() {
  return within(screen.getByRole("navigation", { name: "Pagination" }));
}

function links() {
  return nav()
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("Pagination", () => {
  it("[BR-B4] links Previous, every page and Next, marking the current page", () => {
    render(<Pagination query={query({ page: 2 })} totalPages={3} />);

    expect(links()).toEqual([
      ["Previous", "/"],
      ["1", "/"],
      ["2", "/?page=2"],
      ["3", "/?page=3"],
      ["Next", "/?page=3"],
    ]);
    expect(nav().getByRole("link", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(nav().getByRole("link", { name: "1" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(nav().getByRole("link", { name: "3" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("[BR-B4] has no Previous on the first page", () => {
    render(<Pagination query={query()} totalPages={3} />);

    expect(links()).toEqual([
      ["1", "/"],
      ["2", "/?page=2"],
      ["3", "/?page=3"],
      ["Next", "/?page=2"],
    ]);
    expect(nav().getByRole("link", { name: "1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("[BR-B4] has no Next on the last page", () => {
    render(<Pagination query={query({ page: 3 })} totalPages={3} />);

    expect(links()).toEqual([
      ["Previous", "/?page=2"],
      ["1", "/"],
      ["2", "/?page=2"],
      ["3", "/?page=3"],
    ]);
  });

  it("[BR-B4] page links keep the families and sort", () => {
    render(
      <Pagination
        query={query({ families: ["floral", "woody"], sort: "price-asc" })}
        totalPages={2}
      />,
    );

    expect(links()).toEqual([
      ["1", "/?family=floral&family=woody&sort=price-asc"],
      ["2", "/?family=floral&family=woody&sort=price-asc&page=2"],
      ["Next", "/?family=floral&family=woody&sort=price-asc&page=2"],
    ]);
  });

  it.each([
    [1, 1],
    [1, 0],
    [4, 3],
  ])("[BR-B4] renders nothing for page %i of %i", (page, totalPages) => {
    const { container } = render(
      <Pagination query={query({ page })} totalPages={totalPages} />,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
