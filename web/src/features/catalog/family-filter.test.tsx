import { fireEvent, render, screen, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdNavigation, landNavigation, push } from "@/test/navigation";
import { CatalogNavigation } from "./catalog-navigation";
import type { CatalogQuery } from "./catalog-query";
import { FamilyFilter } from "./family-filter";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

beforeEach(() => {
  push.mockReset();
  vi.mocked(useRouter).mockReturnValue({ push } as never);
});

afterEach(landNavigation);

const LABELS = ["Floral", "Woody", "Fresh", "Gourmand", "Spicy", "Herbal"];

function query(overrides: Partial<CatalogQuery> = {}): CatalogQuery {
  return { families: [], sort: "name-asc", page: 1, ...overrides };
}

function ui(current: CatalogQuery) {
  return (
    <CatalogNavigation query={current}>
      <FamilyFilter />
    </CatalogNavigation>
  );
}

function checkbox(name: string) {
  return screen.getByRole("checkbox", { name });
}

describe("FamilyFilter", () => {
  it("[BR-B2] lists the six scent families in order inside the Scent family group", () => {
    render(ui(query()));

    const group = screen.getByRole("group", { name: "Scent family" });
    const boxes = within(group).getAllByRole("checkbox");
    expect(boxes).toHaveLength(6);
    LABELS.forEach((label, index) => {
      expect(boxes[index]).toHaveAccessibleName(label);
    });
  });

  it("[BR-B2] checks exactly the families in the query", () => {
    render(ui(query({ families: ["floral", "spicy"] })));

    for (const label of LABELS) {
      if (label === "Floral" || label === "Spicy") {
        expect(checkbox(label)).toBeChecked();
      } else {
        expect(checkbox(label)).not.toBeChecked();
      }
    }
  });

  it("[BR-B2] checking a family pushes the toggled href", () => {
    render(ui(query({ families: ["woody"], sort: "price-desc", page: 3 })));

    fireEvent.click(checkbox("Floral"));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      "/?family=floral&family=woody&sort=price-desc",
    );
  });

  it("[BR-B2] unchecking the last family pushes the default URL", () => {
    render(ui(query({ families: ["floral"], page: 2 })));

    fireEvent.click(checkbox("Floral"));

    expect(push).toHaveBeenCalledWith("/");
  });

  it("[BR-B2] unchecking one of two families keeps the other and the sort", () => {
    render(ui(query({ families: ["floral", "woody"], sort: "price-asc" })));

    fireEvent.click(checkbox("Woody"));

    expect(push).toHaveBeenCalledWith("/?family=floral&sort=price-asc");
  });

  it("[BR-B2] shows the new choice at once while the navigation is pending", () => {
    holdNavigation();
    render(ui(query()));

    fireEvent.click(checkbox("Woody"));

    expect(checkbox("Woody")).toBeChecked();
    expect(checkbox("Floral")).not.toBeChecked();
    expect(push).toHaveBeenCalledWith("/?family=woody");
  });

  it("[BR-B2] a second choice during a pending navigation builds on the first", () => {
    holdNavigation();
    render(ui(query()));

    fireEvent.click(checkbox("Woody"));
    fireEvent.click(checkbox("Floral"));

    expect(push.mock.calls).toEqual([
      ["/?family=woody"],
      ["/?family=floral&family=woody"],
    ]);
    expect(checkbox("Woody")).toBeChecked();
    expect(checkbox("Floral")).toBeChecked();
  });

  it("[BR-B2] follows the URL once the navigation lands", async () => {
    holdNavigation();
    const { rerender } = render(ui(query()));

    fireEvent.click(checkbox("Fresh"));
    rerender(ui(query({ families: ["fresh", "spicy"] })));
    expect(checkbox("Spicy")).not.toBeChecked();
    await landNavigation();

    expect(checkbox("Fresh")).toBeChecked();
    expect(checkbox("Spicy")).toBeChecked();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("[BR-B2] falls back to the URL state when a navigation ends without changing it", async () => {
    holdNavigation();
    render(ui(query({ families: ["herbal"] })));

    fireEvent.click(checkbox("Fresh"));
    expect(checkbox("Fresh")).toBeChecked();
    await landNavigation();

    expect(checkbox("Fresh")).not.toBeChecked();
    expect(checkbox("Herbal")).toBeChecked();
  });

  it("[BR-B2] two filters on one page each label their own checkboxes", () => {
    render(
      <>
        {ui(query())}
        {ui(query({ families: ["woody"] }))}
      </>,
    );

    const groups = screen.getAllByRole("group", { name: "Scent family" });
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      for (const label of LABELS) {
        expect(
          within(group).getByRole("checkbox", { name: label }),
        ).toBeInTheDocument();
      }
    }
    const [first, second] = groups as [HTMLElement, HTMLElement];
    expect(
      within(first).getByRole("checkbox", { name: "Woody" }),
    ).not.toBeChecked();
    expect(
      within(second).getByRole("checkbox", { name: "Woody" }),
    ).toBeChecked();
  });

  it("[BR-B2] the checkboxes are disabled in the server HTML and enabled after hydration", async () => {
    const consoleError = vi.spyOn(console, "error");
    const recoverable = vi.fn();
    const element = ui(query({ families: ["woody"] }));
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.append(container);

    const serverBoxes = within(container).getAllByRole("checkbox");
    expect(serverBoxes).toHaveLength(6);
    for (const box of serverBoxes) expect(box).toBeDisabled();
    expect(
      within(container).getByRole("checkbox", { name: "Woody" }),
    ).toBeChecked();

    render(element, {
      container,
      hydrate: true,
      onRecoverableError: recoverable,
    });

    await vi.waitFor(() => {
      for (const box of within(container).getAllByRole("checkbox")) {
        expect(box).toBeEnabled();
      }
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    fireEvent.click(within(container).getByRole("checkbox", { name: "Spicy" }));
    expect(push).toHaveBeenCalledWith("/?family=woody&family=spicy");
  });
});
