import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdNavigation, landNavigation, push } from "@/test/navigation";
import { CatalogNavigation, useCatalogNavigation } from "./catalog-navigation";
import type { CatalogQuery } from "./catalog-query";
import { FamilyFilter } from "./family-filter";
import { SortSelect } from "./sort-select";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

beforeEach(() => {
  push.mockReset();
  vi.mocked(useRouter).mockReturnValue({ push } as never);
});

afterEach(landNavigation);

function controls(current: CatalogQuery) {
  return (
    <CatalogNavigation query={current}>
      <FamilyFilter />
      <SortSelect />
    </CatalogNavigation>
  );
}

function Probe() {
  const { query } = useCatalogNavigation();
  return <p>{JSON.stringify(query)}</p>;
}

describe("CatalogNavigation", () => {
  it("[BR-B2] [BR-B3] a sort chosen while a filter navigation is pending keeps that filter", () => {
    holdNavigation();
    render(controls({ families: [], sort: "name-asc", page: 2 }));

    fireEvent.click(screen.getByRole("checkbox", { name: "Floral" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "price-asc" },
    });

    expect(push.mock.calls).toEqual([
      ["/?family=floral"],
      ["/?family=floral&sort=price-asc"],
    ]);
  });

  it("[BR-B2] [BR-B3] a filter chosen while a sort navigation is pending keeps that sort", () => {
    holdNavigation();
    render(controls({ families: ["woody"], sort: "name-asc", page: 1 }));

    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "price-desc" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Herbal" }));

    expect(push.mock.calls).toEqual([
      ["/?family=woody&sort=price-desc"],
      ["/?family=woody&family=herbal&sort=price-desc"],
    ]);
  });

  it("[BR-B2] [BR-B3] hands the URL query to its controls", () => {
    render(
      <CatalogNavigation
        query={{ families: ["fresh"], sort: "price-asc", page: 2 }}
      >
        <Probe />
      </CatalogNavigation>,
    );

    expect(
      screen.getByText(
        JSON.stringify({ families: ["fresh"], sort: "price-asc", page: 2 }),
      ),
    ).toBeInTheDocument();
  });

  it("refuses to render controls outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow("CatalogNavigation");
    expect(() => render(<FamilyFilter />)).toThrow("CatalogNavigation");
    expect(() => render(<SortSelect />)).toThrow("CatalogNavigation");
  });
});
