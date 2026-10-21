import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NativeSelect, NativeSelectOption } from "./native-select";

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
