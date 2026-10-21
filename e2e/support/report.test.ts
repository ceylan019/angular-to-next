import { describe, expect, it } from "vitest";
import { reportFolder } from "./report.js";

describe("reportFolder", () => {
  it("names the folder after the project given with an equals sign", () => {
    expect(reportFolder(["test", "--project=legacy"])).toBe(
      "playwright-report/legacy",
    );
  });

  it("names the folder after the project given as a separate argument", () => {
    expect(reportFolder(["test", "--project", "next"])).toBe(
      "playwright-report/next",
    );
  });

  it("joins several projects in the order they were given", () => {
    expect(
      reportFolder(["test", "--project=next", "--project", "legacy"]),
    ).toBe("playwright-report/next-legacy");
  });

  it("uses all when no project is selected", () => {
    expect(reportFolder(["test", "--repeat-each=3"])).toBe(
      "playwright-report/all",
    );
  });

  it("uses all when the project flag has no value", () => {
    expect(reportFolder(["test", "--project"])).toBe("playwright-report/all");
    expect(reportFolder(["test", "--project="])).toBe("playwright-report/all");
    expect(reportFolder(["test", "--project", "--headed"])).toBe(
      "playwright-report/all",
    );
  });

  it("ignores arguments that only look like the project flag", () => {
    expect(reportFolder(["test", "--projects=legacy", "legacy"])).toBe(
      "playwright-report/all",
    );
  });
});
