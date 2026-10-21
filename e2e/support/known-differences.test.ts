import type { TestInfo } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { byTarget, KNOWN_DIFFERENCES } from "./known-differences.js";

function info(name: string, annotations: TestInfo["annotations"] = []) {
  return { project: { name }, annotations };
}

describe("KNOWN_DIFFERENCES", () => {
  it("registers KD-01 to KD-06 with the rules they break", () => {
    const rules = Object.fromEntries(
      Object.entries(KNOWN_DIFFERENCES).map(([id, kd]) => [id, kd.rules]),
    );

    expect(rules).toEqual({
      "KD-01": ["BR-C5"],
      "KD-02": ["BR-B7", "BR-K7"],
      "KD-03": ["BR-C5"],
      "KD-04": ["BR-C4"],
      "KD-05": ["BR-K6"],
      "KD-06": ["BR-C2"],
    });
  });

  it("gives every known difference a distinct title", () => {
    const titles = Object.values(KNOWN_DIFFERENCES).map((kd) => kd.title);

    expect(new Set(titles).size).toBe(6);
    for (const title of titles) {
      expect(title.length).toBeGreaterThan(10);
    }
  });
});

describe("byTarget", () => {
  it("returns the legacy value on the legacy project", () => {
    expect(byTarget("KD-02", { legacy: 200, next: 404 }, info("legacy"))).toBe(
      200,
    );
  });

  it("returns the next value on the next project", () => {
    expect(byTarget("KD-02", { legacy: 200, next: 404 }, info("next"))).toBe(
      404,
    );
  });

  it("returns falsy values as they are", () => {
    expect(byTarget("KD-05", { legacy: 0, next: 1 }, info("legacy"))).toBe(0);
    expect(byTarget("KD-04", { legacy: "x", next: "" }, info("next"))).toBe("");
  });

  it("annotates the test with the known difference", () => {
    const target = info("next", [{ type: "issue", description: "42" }]);

    byTarget("KD-03", { legacy: "$5.95", next: "Free" }, target);

    expect(target.annotations).toEqual([
      { type: "issue", description: "42" },
      { type: "known-difference", description: "KD-03" },
    ]);
  });

  it("annotates each known difference once however often it is used", () => {
    const target = info("legacy");

    byTarget("KD-01", { legacy: "$16.14", next: "$16.15" }, target);
    byTarget("KD-03", { legacy: "$5.95", next: "Free" }, target);
    byTarget("KD-01", { legacy: "$22.09", next: "$22.10" }, target);

    expect(target.annotations).toEqual([
      { type: "known-difference", description: "KD-01" },
      { type: "known-difference", description: "KD-03" },
    ]);
  });

  it("keeps an annotation of another type that shares the description", () => {
    const target = info("legacy", [{ type: "issue", description: "KD-01" }]);

    byTarget("KD-01", { legacy: 1, next: 2 }, target);

    expect(target.annotations).toEqual([
      { type: "issue", description: "KD-01" },
      { type: "known-difference", description: "KD-01" },
    ]);
  });

  it.each(["", "chromium", "Legacy", "legacy ", "web"])(
    "throws and annotates nothing on the project %j",
    (name) => {
      const target = info(name);

      expect(() =>
        byTarget("KD-02", { legacy: 200, next: 404 }, target),
      ).toThrow(
        `KD-02 has values for the legacy and next projects only, not "${name}"`,
      );
      expect(target.annotations).toEqual([]);
    },
  );
});
