import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NativeSelect, NativeSelectOption } from "./native-select";

vi.mock("lucide-react", () => {
  throw new Error("lucide-react ships its icons as client components");
});

function PlainSelect(props: ComponentProps<"select">) {
  return <select {...props} />;
}

function MarkedSelect(props: ComponentProps<"select">) {
  return <select data-control="marked" {...props} />;
}

describe("NativeSelect", () => {
  it("renders a native select named by its label", () => {
    render(
      <>
        <label htmlFor="sort">Sort by</label>
        <NativeSelect id="sort" defaultValue="price-asc">
          <NativeSelectOption value="name-asc">Name: A to Z</NativeSelectOption>
          <NativeSelectOption value="price-asc">
            Price: low to high
          </NativeSelectOption>
        </NativeSelect>
      </>,
    );

    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveValue("price-asc");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Name: A to Z", "Price: low to high"]);
  });

  it("draws the chevron as a decorative icon", () => {
    const { container } = render(<NativeSelect aria-label="Country" />);

    expect(
      container.querySelector('[data-slot="native-select-icon"]')?.outerHTML,
    ).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none" aria-hidden="true" data-slot="native-select-icon"><path d="m6 9 6 6 6-6"></path></svg>',
    );
  });

  it("disables the select", () => {
    render(<NativeSelect aria-label="Country" disabled />);

    expect(screen.getByRole("combobox", { name: "Country" })).toBeDisabled();
  });

  it("renders the select through the given control with its props and options", () => {
    render(
      <>
        <label htmlFor="sort">Sort by</label>
        <NativeSelect
          id="sort"
          control={MarkedSelect}
          size="sm"
          defaultValue="price-asc"
        >
          <NativeSelectOption value="name-asc">Name: A to Z</NativeSelectOption>
          <NativeSelectOption value="price-asc">
            Price: low to high
          </NativeSelectOption>
        </NativeSelect>
      </>,
    );

    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(select).toHaveAttribute("data-control", "marked");
    expect(select).toHaveAttribute("data-slot", "native-select");
    expect(select).toHaveAttribute("data-size", "sm");
    expect(select).toHaveValue("price-asc");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Name: A to Z", "Price: low to high"]);
  });

  it("gives the same markup through a plain control as without one", () => {
    const options = (
      <>
        <NativeSelectOption value="name-asc">Name: A to Z</NativeSelectOption>
        <NativeSelectOption value="price-asc">
          Price: low to high
        </NativeSelectOption>
      </>
    );

    expect(
      renderToStaticMarkup(
        <NativeSelect
          id="sort"
          control={PlainSelect}
          className="w-full"
          defaultValue="price-asc"
        >
          {options}
        </NativeSelect>,
      ),
    ).toBe(
      renderToStaticMarkup(
        <NativeSelect id="sort" className="w-full" defaultValue="price-asc">
          {options}
        </NativeSelect>,
      ),
    );
  });
});
