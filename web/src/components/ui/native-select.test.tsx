import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NativeSelect, NativeSelectOption } from "./native-select";

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
});
