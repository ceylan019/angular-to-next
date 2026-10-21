import { fireEvent, render, screen, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdNavigation, landNavigation, push } from "@/test/navigation";
import { CatalogNavigation } from "./catalog-navigation";
import type { CatalogQuery } from "./catalog-query";
import { SortSelect } from "./sort-select";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

beforeEach(() => {
  push.mockReset();
  vi.mocked(useRouter).mockReturnValue({ push } as never);
});

afterEach(landNavigation);

function query(overrides: Partial<CatalogQuery> = {}): CatalogQuery {
  return { families: [], sort: "name-asc", page: 1, ...overrides };
}

function ui(current: CatalogQuery) {
  return (
    <CatalogNavigation query={current}>
      <SortSelect />
    </CatalogNavigation>
  );
}

function select() {
  return screen.getByRole("combobox", { name: "Sort by" });
}

describe("SortSelect", () => {
  it("[BR-B3] offers the three sort options with name A to Z selected by default", () => {
    render(ui(query()));

    expect(select().tagName).toBe("SELECT");
    expect(
      within(select())
        .getAllByRole("option")
        .map((option) => [option.getAttribute("value"), option.textContent]),
    ).toEqual([
      ["name-asc", "Name: A to Z"],
      ["price-asc", "Price: low to high"],
      ["price-desc", "Price: high to low"],
    ]);
    expect(select()).toHaveValue("name-asc");
  });

  it("[BR-B3] selects the sort from the query", () => {
    render(ui(query({ sort: "price-desc" })));

    expect(select()).toHaveValue("price-desc");
  });

  it("[BR-B3] choosing a sort pushes the new href", () => {
    render(ui(query({ families: ["floral"], page: 2 })));

    fireEvent.change(select(), { target: { value: "price-asc" } });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/?family=floral&sort=price-asc");
  });

  it("[BR-B3] choosing name A to Z drops the sort from the URL", () => {
    render(ui(query({ sort: "price-desc", page: 3 })));

    fireEvent.change(select(), { target: { value: "name-asc" } });

    expect(push).toHaveBeenCalledWith("/");
  });

  it("[BR-B3] an unknown value falls back to name A to Z", () => {
    render(ui(query({ families: ["woody"], sort: "price-asc" })));

    fireEvent.change(select(), { target: { value: "PRICE-DESC" } });

    expect(push).toHaveBeenCalledWith("/?family=woody");
  });

  it("[BR-B3] shows the new sort at once while the navigation is pending", () => {
    holdNavigation();
    render(ui(query()));

    fireEvent.change(select(), { target: { value: "price-desc" } });

    expect(select()).toHaveValue("price-desc");
  });

  it("[BR-B3] falls back to the URL sort when a navigation ends without changing it", async () => {
    holdNavigation();
    render(ui(query({ sort: "price-asc" })));

    fireEvent.change(select(), { target: { value: "price-desc" } });
    await landNavigation();

    expect(select()).toHaveValue("price-asc");
  });

  it("[BR-B3] two sort selects on one page each have their own label", () => {
    render(
      <>
        {ui(query())}
        {ui(query({ sort: "price-desc" }))}
      </>,
    );

    const selects = screen.getAllByRole("combobox", { name: "Sort by" });
    expect(selects).toHaveLength(2);
    expect(selects[0]).toHaveValue("name-asc");
    expect(selects[1]).toHaveValue("price-desc");
  });

  it("[BR-B3] the sort select is disabled in the server HTML and enabled after hydration", async () => {
    const consoleError = vi.spyOn(console, "error");
    const recoverable = vi.fn();
    const element = ui(query({ sort: "price-asc" }));
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.append(container);

    const serverSelect = within(container).getByRole("combobox", {
      name: "Sort by",
    });
    expect(serverSelect).toBeDisabled();
    expect(serverSelect).toHaveValue("price-asc");

    render(element, {
      container,
      hydrate: true,
      onRecoverableError: recoverable,
    });

    await vi.waitFor(() => {
      expect(
        within(container).getByRole("combobox", { name: "Sort by" }),
      ).toBeEnabled();
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    fireEvent.change(
      within(container).getByRole("combobox", { name: "Sort by" }),
      { target: { value: "price-desc" } },
    );
    expect(push).toHaveBeenCalledWith("/?sort=price-desc");
  });
});
