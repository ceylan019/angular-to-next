import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { layoutSite } from "./layout.ts";

const REPO = "https://github.com/ceylan019/angular-to-next";

const scratch = (): string => mkdtempSync(join(tmpdir(), "site-layout-"));

const put = (root: string, path: string, content: string): void => {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content);
};

const read = (root: string, path: string): string =>
  readFileSync(join(root, path), "utf8");

describe("layoutSite", () => {
  it("copies each artifact into its folder and writes the index", () => {
    const root = scratch();
    const artifacts = join(root, "artifacts");
    put(artifacts, "playwright-legacy-ubuntu-24.04/index.html", "pw");
    put(artifacts, "playwright-legacy-ubuntu-24.04/data/trace.zip", "zip");
    put(artifacts, "mutation-backend/index.html", "mb");
    put(artifacts, "mutation-legacy/html/index.html", "ml");
    put(artifacts, "coverage-web/index.html", "cw");
    put(
      artifacts,
      "lighthouse-next/manifest.json",
      JSON.stringify([
        {
          url: "http://localhost:3000/cart",
          isRepresentativeRun: true,
          htmlPath: "/r/p.report.html",
        },
      ]),
    );
    put(artifacts, "lighthouse-next/p.report.html", "lh");
    const out = join(root, "site");

    layoutSite(artifacts, out, REPO);

    expect(read(out, "playwright/legacy-ubuntu-24.04/index.html")).toBe("pw");
    expect(read(out, "playwright/legacy-ubuntu-24.04/data/trace.zip")).toBe(
      "zip",
    );
    expect(read(out, "mutation/backend/index.html")).toBe("mb");
    expect(read(out, "mutation/legacy/html/index.html")).toBe("ml");
    expect(read(out, "coverage/web/index.html")).toBe("cw");
    expect(read(out, "lighthouse/next/p.report.html")).toBe("lh");
    const index = read(out, "index.html");
    expect(index).toContain(
      '<a href="playwright/legacy-ubuntu-24.04/index.html">',
    );
    expect(index).toContain('<a href="mutation/backend/index.html">');
    expect(index).toContain('<a href="mutation/legacy/html/index.html">');
    expect(index).toContain('<a href="coverage/web/index.html">');
    expect(index).toContain('<a href="lighthouse/next/p.report.html">');
    expect(index).toContain(`<a href="${REPO}">`);
  });

  it("renders a missing artifact as not available in this run", () => {
    const root = scratch();
    const artifacts = join(root, "artifacts");
    put(artifacts, "mutation-backend/index.html", "mb");
    const out = join(root, "site");

    const { missing } = layoutSite(artifacts, out, REPO);

    expect(missing).toContain("mutation-web");
    expect(missing).not.toContain("mutation-backend");
    expect(missing).toHaveLength(10);
    const index = read(out, "index.html");
    expect(index).toContain(
      '<li class="missing">Next.js web app mutation report: not available in this run</li>',
    );
    expect(index).not.toContain('href="mutation/web/');
    expect(existsSync(join(out, "mutation/web"))).toBe(false);
  });

  it("builds an index when the artifacts folder does not exist", () => {
    const root = scratch();
    const out = join(root, "site");

    const { missing } = layoutSite(join(root, "none"), out, REPO);

    expect(missing).toHaveLength(11);
    const index = read(out, "index.html");
    expect(index).toContain("<h1>");
    expect(index).not.toContain('<a href="playwright');
    expect(index).toContain(`<a href="${REPO}">`);
  });

  it("marks a lighthouse side without a usable manifest not available", () => {
    const root = scratch();
    const artifacts = join(root, "artifacts");
    put(artifacts, "lighthouse-legacy/manifest.json", "{not json");
    put(artifacts, "lighthouse-legacy/a.report.html", "x");
    const out = join(root, "site");

    layoutSite(artifacts, out, REPO);

    expect(read(out, "index.html")).toContain(
      '<li class="missing">Legacy Angular app: not available in this run</li>',
    );
  });

  it("replaces whatever a previous run left in the output folder", () => {
    const root = scratch();
    const out = join(root, "site");
    put(out, "stale/old.html", "old");

    layoutSite(join(root, "none"), out, REPO);

    expect(existsSync(join(out, "stale"))).toBe(false);
    expect(existsSync(join(out, "index.html"))).toBe(true);
  });
});
