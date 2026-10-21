import { describe, expect, it } from "vitest";
import {
  FAMILY_OPTIONS,
  SORT_OPTIONS,
  catalogHref,
  parseCatalogQuery,
  toApiSearchParams,
  toSortKey,
  toggleFamily,
  withSort,
  type CatalogQuery,
} from "./catalog-query";

const defaults: CatalogQuery = { families: [], sort: "name-asc", page: 1 };

describe("parseCatalogQuery", () => {
  it("[BR-B2] [BR-B3] [BR-B4] parses like the backend, with defaults for an empty query", () => {
    expect(parseCatalogQuery({})).toEqual(defaults);
  });

  it("[BR-B2] [BR-B3] [BR-B4] treats undefined values as missing", () => {
    expect(
      parseCatalogQuery({
        family: undefined,
        sort: undefined,
        page: undefined,
      }),
    ).toEqual(defaults);
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
    expect(parseCatalogQuery({ family: [] }).families).toEqual([]);
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
  ])("[BR-B4] page %j falls back to 1", (value) => {
    expect(parseCatalogQuery({ page: value }).page).toBe(1);
  });

  it.each([
    ["1", 1],
    ["2", 2],
    ["99", 99],
    ["9999", 9999],
  ])("[BR-B4] page %s is kept", (value, page) => {
    expect(parseCatalogQuery({ page: value }).page).toBe(page);
  });

  it("[BR-B4] page uses the first value when repeated", () => {
    expect(parseCatalogQuery({ page: ["3", "4"] }).page).toBe(3);
    expect(parseCatalogQuery({ page: ["abc", "4"] }).page).toBe(1);
    expect(parseCatalogQuery({ page: [] }).page).toBe(1);
  });

  it("[BR-B2] [BR-B3] [BR-B4] ignores unknown keys", () => {
    expect(
      parseCatalogQuery({ q: "rose", families: "floral", pages: "2" }),
    ).toEqual(defaults);
  });
});

describe("toSortKey", () => {
  it("[BR-B3] keeps the three sort keys and falls back to name A to Z", () => {
    expect(toSortKey("name-asc")).toBe("name-asc");
    expect(toSortKey("price-asc")).toBe("price-asc");
    expect(toSortKey("price-desc")).toBe("price-desc");
    expect(toSortKey("Price-Desc")).toBe("name-asc");
    expect(toSortKey(" price-asc")).toBe("name-asc");
    expect(toSortKey("")).toBe("name-asc");
    expect(toSortKey(undefined)).toBe("name-asc");
  });
});

describe("catalogHref", () => {
  it("[BR-B2] builds hrefs in canonical order and omits defaults", () => {
    expect(
      catalogHref({
        families: ["floral", "woody"],
        sort: "price-asc",
        page: 2,
      }),
    ).toBe("/?family=floral&family=woody&sort=price-asc&page=2");
    expect(catalogHref({ families: [], sort: "name-asc", page: 1 })).toBe("/");
  });

  it("[BR-B2] writes families in canonical order whatever order they arrive in", () => {
    expect(
      catalogHref({ families: ["woody", "floral"], sort: "name-asc", page: 1 }),
    ).toBe("/?family=floral&family=woody");
    expect(
      catalogHref({
        families: ["herbal", "spicy", "gourmand", "fresh", "woody", "floral"],
        sort: "name-asc",
        page: 1,
      }),
    ).toBe(
      "/?family=floral&family=woody&family=fresh&family=gourmand&family=spicy&family=herbal",
    );
  });

  it("[BR-B2] writes a repeated family once", () => {
    expect(
      catalogHref({ families: ["fresh", "fresh"], sort: "name-asc", page: 1 }),
    ).toBe("/?family=fresh");
  });

  it("[BR-B3] keeps a non default sort on its own", () => {
    expect(catalogHref({ families: [], sort: "price-desc", page: 1 })).toBe(
      "/?sort=price-desc",
    );
  });

  it("[BR-B4] keeps a non default page on its own and after families", () => {
    expect(catalogHref({ families: [], sort: "name-asc", page: 3 })).toBe(
      "/?page=3",
    );
    expect(
      catalogHref({ families: ["spicy"], sort: "name-asc", page: 2 }),
    ).toBe("/?family=spicy&page=2");
  });

  it("[BR-B2] [BR-B4] round trips through parseCatalogQuery", () => {
    const query: CatalogQuery = {
      families: ["fresh", "herbal"],
      sort: "price-desc",
      page: 4,
    };
    const params = new URL(catalogHref(query), "http://shop.test").searchParams;

    expect(
      parseCatalogQuery({
        family: params.getAll("family"),
        sort: params.get("sort") ?? undefined,
        page: params.get("page") ?? undefined,
      }),
    ).toEqual(query);
  });
});

describe("toApiSearchParams", () => {
  it("[BR-B2] [BR-B3] [BR-B4] sends the same canonical parameters as the page URL", () => {
    const params = toApiSearchParams({
      families: ["woody", "floral"],
      sort: "price-asc",
      page: 2,
    });

    expect(params).toBeInstanceOf(URLSearchParams);
    expect(params.toString()).toBe(
      "family=floral&family=woody&sort=price-asc&page=2",
    );
  });

  it("[BR-B2] [BR-B3] [BR-B4] sends nothing for the defaults", () => {
    expect(toApiSearchParams(defaults).toString()).toBe("");
  });
});

describe("toggleFamily", () => {
  it("[BR-B2] toggling a family resets the page", () => {
    expect(
      toggleFamily(
        { families: ["woody"], sort: "price-asc", page: 3 },
        "floral",
      ),
    ).toEqual({ families: ["floral", "woody"], sort: "price-asc", page: 1 });
  });

  it("[BR-B2] unchecking a chosen family removes it and resets the page", () => {
    expect(
      toggleFamily(
        { families: ["floral", "woody"], sort: "price-desc", page: 2 },
        "floral",
      ),
    ).toEqual({ families: ["woody"], sort: "price-desc", page: 1 });
  });

  it("[BR-B2] unchecking the last family leaves no families", () => {
    expect(
      toggleFamily(
        { families: ["herbal"], sort: "name-asc", page: 1 },
        "herbal",
      ),
    ).toEqual(defaults);
  });

  it("[BR-B2] adding a family keeps the others in canonical order", () => {
    expect(
      toggleFamily(
        { families: ["floral", "spicy"], sort: "name-asc", page: 1 },
        "fresh",
      ).families,
    ).toEqual(["floral", "fresh", "spicy"]);
  });

  it("[BR-B2] leaves the given query untouched", () => {
    const query: CatalogQuery = {
      families: ["woody"],
      sort: "price-asc",
      page: 3,
    };

    toggleFamily(query, "floral");
    toggleFamily(query, "woody");

    expect(query).toEqual({ families: ["woody"], sort: "price-asc", page: 3 });
  });
});

describe("withSort", () => {
  it("[BR-B3] changing the sort resets the page", () => {
    expect(
      withSort(
        { families: ["floral"], sort: "name-asc", page: 2 },
        "price-desc",
      ),
    ).toEqual({ families: ["floral"], sort: "price-desc", page: 1 });
  });

  it("[BR-B3] choosing the current sort still resets the page", () => {
    expect(
      withSort({ families: [], sort: "price-asc", page: 3 }, "price-asc"),
    ).toEqual({ families: [], sort: "price-asc", page: 1 });
  });

  it("[BR-B3] leaves the given query untouched", () => {
    const query: CatalogQuery = {
      families: ["spicy"],
      sort: "name-asc",
      page: 2,
    };

    withSort(query, "price-asc");

    expect(query).toEqual({ families: ["spicy"], sort: "name-asc", page: 2 });
  });
});

describe("filter and sort options", () => {
  it("[BR-B2] lists the six families with their labels in contract order", () => {
    expect(FAMILY_OPTIONS).toEqual([
      { slug: "floral", label: "Floral" },
      { slug: "woody", label: "Woody" },
      { slug: "fresh", label: "Fresh" },
      { slug: "gourmand", label: "Gourmand" },
      { slug: "spicy", label: "Spicy" },
      { slug: "herbal", label: "Herbal" },
    ]);
  });

  it("[BR-B3] lists the three sort options with their labels in contract order", () => {
    expect(SORT_OPTIONS).toEqual([
      { value: "name-asc", label: "Name: A to Z" },
      { value: "price-asc", label: "Price: low to high" },
      { value: "price-desc", label: "Price: high to low" },
    ]);
  });
});
