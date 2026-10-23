import { describe, expect, it } from "vitest";
import { PAGE_SIZE, parseCatalogQuery } from "./catalog-query.js";

describe("parseCatalogQuery", () => {
  it("[BR-B1] page size is 12", () => {
    expect(PAGE_SIZE).toBe(12);
  });

  it("[BR-B2] [BR-B3] [BR-B4] defaults", () => {
    expect(parseCatalogQuery({})).toEqual({
      families: [],
      sort: "name-asc",
      page: 1,
    });
  });

  it("[BR-B2] keeps known families once in canonical order", () => {
    expect(
      parseCatalogQuery({
        family: ["woody", "floral", "floral", "nope", "Floral"],
      }).families,
    ).toEqual(["floral", "woody"]);
  });

  it("[BR-B2] accepts a single family string", () => {
    expect(parseCatalogQuery({ family: "spicy" }).families).toEqual(["spicy"]);
  });

  it("[BR-B2] ignores a single unknown family string", () => {
    expect(parseCatalogQuery({ family: "nope" }).families).toEqual([]);
  });

  it("[BR-B2] returns all six families in canonical order", () => {
    expect(
      parseCatalogQuery({
        family: ["herbal", "spicy", "gourmand", "fresh", "woody", "floral"],
      }).families,
    ).toEqual(["floral", "woody", "fresh", "gourmand", "spicy", "herbal"]);
  });

  it("[BR-B2] ignores empty family values", () => {
    expect(parseCatalogQuery({ family: ["", "fresh"] }).families).toEqual([
      "fresh",
    ]);
  });

  it("[BR-B3] accepts the three sort keys only", () => {
    expect(parseCatalogQuery({ sort: "price-desc" }).sort).toBe("price-desc");
    expect(parseCatalogQuery({ sort: "price-asc" }).sort).toBe("price-asc");
    expect(parseCatalogQuery({ sort: "name-asc" }).sort).toBe("name-asc");
    expect(parseCatalogQuery({ sort: "PRICE-ASC" }).sort).toBe("name-asc");
    expect(parseCatalogQuery({ sort: "" }).sort).toBe("name-asc");
    expect(parseCatalogQuery({ sort: "name-desc" }).sort).toBe("name-asc");
    expect(parseCatalogQuery({ sort: ["price-asc", "price-desc"] }).sort).toBe(
      "price-asc",
    );
    expect(parseCatalogQuery({ sort: ["bogus", "price-desc"] }).sort).toBe(
      "name-asc",
    );
    expect(parseCatalogQuery({ sort: [] }).sort).toBe("name-asc");
  });

  it.each([
    "0",
    "-1",
    "1.5",
    "abc",
    "1e3",
    "",
    "10000",
    "01",
    " 1",
    "1 ",
    "1\n",
  ])("[BR-B4] page %j falls back to 1", (v) => {
    expect(parseCatalogQuery({ page: v }).page).toBe(1);
  });

  it.each([
    ["1", 1],
    ["2", 2],
    ["99", 99],
    ["9999", 9999],
  ])("[BR-B4] page %s is kept", (v, n) => {
    expect(parseCatalogQuery({ page: v }).page).toBe(n);
  });

  it("[BR-B4] page uses the first value when repeated", () => {
    expect(parseCatalogQuery({ page: ["3", "4"] }).page).toBe(3);
    expect(parseCatalogQuery({ page: ["abc", "4"] }).page).toBe(1);
    expect(parseCatalogQuery({ page: [] }).page).toBe(1);
  });
});
