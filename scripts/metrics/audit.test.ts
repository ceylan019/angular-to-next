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

const advisory = (id: number, severity: unknown): unknown => ({
  findings: [{ version: "1.0.0", paths: ["fixture-module"] }],
  id,
  title: `Fixture advisory ${String(id)}`,
  module_name: "fixture-module",
  severity,
});

const report = (...severities: unknown[]): unknown => ({
  advisories: Object.fromEntries(
    severities.map((severity, index) => [
      String(1000 + index),
      advisory(1000 + index, severity),
    ]),
  ),
});

const expectUnreadable = (read: () => unknown): void => {
  expect(read).toThrow(ReportError);
  expect(read).toThrow(new ReportError("report unreadable"));
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

  it("counts each advisory once by severity, not the per path totals in the metadata", () => {
    const counted = {
      ...(report("high", "high", "low", "critical", "moderate") as object),
      metadata: {
        vulnerabilities: { info: 0, low: 9, moderate: 9, high: 9, critical: 9 },
      },
    };

    expect(countVulnerabilities(counted)).toEqual({
      critical: 1,
      high: 2,
      moderate: 1,
      low: 1,
      total: 5,
    });
  });

  it("leaves info advisories out of the total", () => {
    expect(countVulnerabilities(report("info", "low", "info"))).toEqual({
      critical: 0,
      high: 0,
      moderate: 0,
      low: 1,
      total: 1,
    });
  });

  it("counts a report without advisories as zero", () => {
    expect(countVulnerabilities(report())).toEqual({
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      total: 0,
    });
  });

  it.each([
    ["null", null],
    ["a string", "audit"],
    ["a number", 3],
    ["an array", []],
    ["an empty object", {}],
    ["an audit error", { error: { code: "ENOAUDIT", summary: "failed" } }],
    [
      "a report with only metadata",
      { metadata: { vulnerabilities: { low: 1 } } },
    ],
    ["null advisories", { advisories: null }],
    ["advisories as a list", { advisories: [advisory(1, "high")] }],
    ["a null advisory", { advisories: { "1": null } }],
    ["an advisory as a list", { advisories: { "1": ["high"] } }],
    ["an advisory without a severity", { advisories: { "1": { id: 1 } } }],
    ["a severity that is not a string", report(3)],
    ["an unknown severity", report("high", "severe")],
    ["a severity in the wrong case", report("High")],
  ])("rejects %s", (_name, value) => {
    expectUnreadable(() => countVulnerabilities(value));
  });

  it("throws report errors that name themselves", () => {
    const error = new ReportError("report unreadable");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ReportError");
    expect(error.message).toBe("report unreadable");
  });
});
