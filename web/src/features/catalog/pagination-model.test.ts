import { describe, expect, it } from "vitest";
import { paginationModel } from "./pagination-model";

const hidden = {
  show: false,
  outOfRange: false,
  previous: null,
  next: null,
  pages: [],
};

describe("paginationModel", () => {
  it("[BR-B4] pagination model", () => {
    expect(paginationModel(1, 3)).toEqual({
      show: true,
      outOfRange: false,
      previous: null,
      next: 2,
      pages: [1, 2, 3],
    });
    expect(paginationModel(3, 3)).toEqual({
      show: true,
      outOfRange: false,
      previous: 2,
      next: null,
      pages: [1, 2, 3],
    });
    expect(paginationModel(9, 3)).toEqual({
      show: false,
      outOfRange: true,
      previous: null,
      next: null,
      pages: [],
    });
    expect(paginationModel(1, 1).show).toBe(false);
    expect(paginationModel(1, 0)).toEqual(hidden);
  });

  it("[BR-B4] a middle page links both ways", () => {
    expect(paginationModel(2, 3)).toEqual({
      show: true,
      outOfRange: false,
      previous: 1,
      next: 3,
      pages: [1, 2, 3],
    });
  });

  it("[BR-B4] two pages are enough to show pagination", () => {
    expect(paginationModel(1, 2)).toEqual({
      show: true,
      outOfRange: false,
      previous: null,
      next: 2,
      pages: [1, 2],
    });
    expect(paginationModel(2, 2)).toEqual({
      show: true,
      outOfRange: false,
      previous: 1,
      next: null,
      pages: [1, 2],
    });
  });

  it("[BR-B4] a single page shows nothing", () => {
    expect(paginationModel(1, 1)).toEqual(hidden);
  });

  it("[BR-B4] the first page past the end is out of range", () => {
    expect(paginationModel(4, 3)).toEqual({ ...hidden, outOfRange: true });
    expect(paginationModel(2, 1)).toEqual({ ...hidden, outOfRange: true });
  });

  it("[BR-B4] [BR-B5] no pages is never out of range, so no matches wins", () => {
    expect(paginationModel(5, 0)).toEqual(hidden);
    expect(paginationModel(9999, 0)).toEqual(hidden);
  });

  it("[BR-B4] lists every page number in order", () => {
    expect(paginationModel(5, 7).pages).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
