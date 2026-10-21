import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countVulnerabilities, ReportError } from "./audit.ts";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, "..", "results", "fixtures", name),
      "utf8",
    ),
  );

const report = (vulnerabilities: unknown): unknown => ({
  metadata: { vulnerabilities },
});

const expectUnreadable = (read: () => unknown): void => {
  expect(read).toThrow(ReportError);
  expect(read).toThrow(new ReportError("report unreadable"));
};

const severities = {
  info: 0,
  low: 0,
  moderate: 0,
  high: 0,
  critical: 0,
};

describe("countVulnerabilities", () => {
  it("counts npm 6 audit vulnerabilities", () => {
    expect(countVulnerabilities(fixture("npm6-audit.json"))).toEqual({
      critical: 2,
      high: 5,
      moderate: 3,
      low: 1,
      total: 11,
    });
  });

  it("counts pnpm audit vulnerabilities", () => {
    expect(countVulnerabilities(fixture("pnpm-audit.json"))).toEqual({
      critical: 0,
      high: 0,
      moderate: 1,
      low: 2,
      total: 3,
    });
  });

  it("leaves info advisories out of the total", () => {
    expect(
      countVulnerabilities(report({ ...severities, info: 7, low: 1 })),
    ).toEqual({ critical: 0, high: 0, moderate: 0, low: 1, total: 1 });
  });

  it("counts a clean report as zero", () => {
    expect(countVulnerabilities(report(severities))).toEqual({
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      total: 0,
    });
  });

  it("reads a report without an info count", () => {
    expect(
      countVulnerabilities(
        report({ low: 4, moderate: 3, high: 2, critical: 1 }),
      ),
    ).toEqual({ critical: 1, high: 2, moderate: 3, low: 4, total: 10 });
  });

  it.each([
    ["null", null],
    ["a string", "audit"],
    ["a number", 3],
    ["an array", []],
    ["an empty object", {}],
    ["an audit error", { error: { code: "ENOAUDIT", summary: "failed" } }],
    ["null metadata", { metadata: null }],
    ["metadata as an array", { metadata: [] }],
    ["metadata without vulnerabilities", { metadata: { dependencies: 3 } }],
    ["null vulnerabilities", report(null)],
    ["vulnerabilities as an array", report([1, 2, 3, 4])],
  ])("rejects %s", (_name, value) => {
    expectUnreadable(() => countVulnerabilities(value));
  });

  it.each(["low", "moderate", "high", "critical"])(
    "rejects a report whose %s count is missing or not a whole number of zero or more",
    (severity) => {
      for (const value of [
        undefined,
        null,
        "1",
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
      ]) {
        expectUnreadable(() =>
          countVulnerabilities(report({ ...severities, [severity]: value })),
        );
      }
    },
  );

  it("throws report errors that name themselves", () => {
    const error = new ReportError("report unreadable");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ReportError");
    expect(error.message).toBe("report unreadable");
  });
});
