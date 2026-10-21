import { describe, expect, it } from "vitest";
import {
  artifactFolders,
  buildSiteIndex,
  escapeHtml,
  lighthouseLinks,
  planSections,
  SITE_TITLE,
  type SiteSection,
} from "./build-site.ts";

const REPO = "https://github.com/ceylan019/angular-to-next";

const SECTIONS: SiteSection[] = [
  {
    title: "Mutation testing",
    links: [
      { label: "Backend mutation report", href: "mutation/backend/index.html" },
      { label: "Web mutation report", href: "mutation/web/index.html" },
    ],
  },
  {
    title: "Coverage",
    links: [{ label: "Web coverage", href: "coverage/web/index.html" }],
  },
];

const count = (text: string, part: string): number =>
  text.split(part).length - 1;

describe("buildSiteIndex", () => {
  it("lists every section and link", () => {
    const html = buildSiteIndex(SECTIONS, REPO);
    expect(html).toContain("<h2>Mutation testing</h2>");
    expect(html).toContain("<h2>Coverage</h2>");
    expect(html).toContain(
      '<li><a href="mutation/backend/index.html">Backend mutation report</a></li>',
    );
    expect(html).toContain(
      '<li><a href="mutation/web/index.html">Web mutation report</a></li>',
    );
    expect(html).toContain(
      '<li><a href="coverage/web/index.html">Web coverage</a></li>',
    );
    expect(html.indexOf("Mutation testing")).toBeLessThan(
      html.indexOf("<h2>Coverage</h2>"),
    );
  });

  it("renders one list per section", () => {
    const html = buildSiteIndex(SECTIONS, REPO);
    expect(count(html, "<ul>")).toBe(2);
    expect(count(html, "</ul>")).toBe(2);
    expect(count(html, "<h2>")).toBe(2);
    expect(count(html, "<li>")).toBe(3);
  });

  it("escapes labels", () => {
    const html = buildSiteIndex(
      [
        {
          title: "S",
          links: [{ label: "<b>bold</b> & more", href: "a.html" }],
        },
      ],
      REPO,
    );
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt; &amp; more");
    expect(html).not.toContain("<b>");
  });

  it("escapes section titles", () => {
    const html = buildSiteIndex([{ title: "<i>x</i>", links: [] }], REPO);
    expect(html).toContain("<h2>&lt;i&gt;x&lt;/i&gt;</h2>");
    expect(html).not.toContain("<i>");
  });

  it("escapes hrefs so they cannot leave the attribute", () => {
    const html = buildSiteIndex(
      [{ title: "S", links: [{ label: "L", href: 'a"><script>x</script>' }] }],
      REPO,
    );
    expect(html).toContain('href="a&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
    expect(html).not.toContain("<script");
  });

  it("links back to the repository", () => {
    const html = buildSiteIndex(SECTIONS, REPO);
    expect(html).toContain(
      `<a href="${REPO}">Wick &amp; Co. Candles migration repository on GitHub</a>`,
    );
  });

  it("escapes the repository url", () => {
    const html = buildSiteIndex([], 'https://x.test/a"b');
    expect(html).toContain('href="https://x.test/a&quot;b"');
  });

  it("is a static page with a language, a viewport and the title", () => {
    const html = buildSiteIndex(SECTIONS, REPO);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
    );
    expect(html).toContain(
      "<title>Wick &amp; Co. Candles migration reports</title>",
    );
    expect(SITE_TITLE).toBe("Wick & Co. Candles migration reports");
  });

  it("has no scripts, external stylesheets or other resources", () => {
    const html = buildSiteIndex(SECTIONS, REPO);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<link");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("@import");
    expect(html).not.toContain("url(");
    expect(count(html, "<style>")).toBe(1);
  });

  it("has one h1 before the section headings", () => {
    const html = buildSiteIndex(SECTIONS, REPO);
    expect(count(html, "<h1>")).toBe(1);
    expect(html).toContain("<h1>Wick &amp; Co. Candles migration reports</h1>");
    expect(html.indexOf("<h1>")).toBeLessThan(html.indexOf("<h2>"));
    expect(html).not.toContain("<h3>");
    expect(html).toContain("<main>");
  });

  it("states that a section without links is not available in this run", () => {
    const html = buildSiteIndex([{ title: "Coverage", links: [] }], REPO);
    expect(html).toContain("<h2>Coverage</h2>");
    expect(html).toContain('<p class="missing">Not available in this run.</p>');
    expect(html).not.toContain("<ul>");
  });

  it("states that a link without a target is not available in this run", () => {
    const html = buildSiteIndex(
      [
        {
          title: "S",
          links: [
            { label: "Present", href: "a/index.html" },
            { label: "Gone <1>" },
          ],
        },
      ],
      REPO,
    );
    expect(html).toContain(
      '<li class="missing">Gone &lt;1&gt;: not available in this run</li>',
    );
    expect(count(html, "<a ")).toBe(2);
    expect(html).toContain('<li><a href="a/index.html">Present</a></li>');
  });

  it("renders a page with no sections", () => {
    const html = buildSiteIndex([], REPO);
    expect(html).toContain("<h1>");
    expect(html).not.toContain("<h2>");
    expect(html).toContain(REPO);
    expect(html.endsWith("</html>\n")).toBe(true);
  });

  it("keeps the text and link colours readable", () => {
    const html = buildSiteIndex(SECTIONS, REPO);
    expect(html).toContain("color: #1a1a1a");
    expect(html).toContain("background: #ffffff");
    expect(html).toContain("color: #0b4f9e");
    expect(html).toContain("color: #4d4d4d");
  });
});

describe("escapeHtml", () => {
  it("escapes the five special characters, ampersand first", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves plain text alone", () => {
    expect(escapeHtml("plain text 1/2")).toBe("plain text 1/2");
    expect(escapeHtml("")).toBe("");
  });
});

describe("artifactFolders", () => {
  it("maps every artifact to its folder in the site", () => {
    expect(artifactFolders()).toEqual([
      {
        artifact: "playwright-legacy-ubuntu-24.04",
        folder: "playwright/legacy-ubuntu-24.04",
      },
      {
        artifact: "playwright-legacy-ubuntu-24.04-arm",
        folder: "playwright/legacy-ubuntu-24.04-arm",
      },
      {
        artifact: "playwright-next-ubuntu-24.04",
        folder: "playwright/next-ubuntu-24.04",
      },
      {
        artifact: "playwright-next-ubuntu-24.04-arm",
        folder: "playwright/next-ubuntu-24.04-arm",
      },
      { artifact: "mutation-backend", folder: "mutation/backend" },
      { artifact: "mutation-web", folder: "mutation/web" },
      { artifact: "mutation-legacy", folder: "mutation/legacy" },
      { artifact: "lighthouse-legacy", folder: "lighthouse/legacy" },
      { artifact: "lighthouse-next", folder: "lighthouse/next" },
      { artifact: "coverage-web", folder: "coverage/web" },
      { artifact: "coverage-legacy", folder: "coverage/legacy" },
    ]);
  });
});

const ALL_PAGES = [
  "playwright/legacy-ubuntu-24.04/index.html",
  "playwright/legacy-ubuntu-24.04-arm/index.html",
  "playwright/next-ubuntu-24.04/index.html",
  "playwright/next-ubuntu-24.04-arm/index.html",
  "mutation/backend/index.html",
  "mutation/web/index.html",
  "mutation/legacy/html/index.html",
  "coverage/web/index.html",
  "coverage/legacy/index.html",
  "lighthouse/legacy/a.report.html",
  "lighthouse/next/b.report.html",
];

const manifestFor = (file: string, url: string): unknown => [
  { url, isRepresentativeRun: true, htmlPath: `/runner/work/${file}` },
];

const readerFor = (side: Record<string, unknown>) => (folder: string) =>
  side[folder];

const FULL_MANIFESTS = readerFor({
  "lighthouse/legacy": manifestFor("a.report.html", "http://localhost:4000/"),
  "lighthouse/next": manifestFor("b.report.html", "http://localhost:3000/"),
});

const linksOf = (sections: SiteSection[], title: string) =>
  sections.find((section) => section.title === title)?.links;

describe("planSections", () => {
  it("links every report that is present", () => {
    const sections = planSections(
      (path) => ALL_PAGES.includes(path),
      FULL_MANIFESTS,
    );
    expect(sections.map((section) => section.title)).toEqual([
      "Playwright end to end reports",
      "Mutation testing reports",
      "Lighthouse reports",
      "Coverage reports",
    ]);
    expect(linksOf(sections, "Playwright end to end reports")).toEqual([
      {
        label: "Legacy Angular app on ubuntu-24.04",
        href: "playwright/legacy-ubuntu-24.04/index.html",
      },
      {
        label: "Legacy Angular app on ubuntu-24.04-arm",
        href: "playwright/legacy-ubuntu-24.04-arm/index.html",
      },
      {
        label: "Next.js app on ubuntu-24.04",
        href: "playwright/next-ubuntu-24.04/index.html",
      },
      {
        label: "Next.js app on ubuntu-24.04-arm",
        href: "playwright/next-ubuntu-24.04-arm/index.html",
      },
    ]);
    expect(linksOf(sections, "Mutation testing reports")).toEqual([
      { label: "Backend mutation report", href: "mutation/backend/index.html" },
      {
        label: "Next.js web app mutation report",
        href: "mutation/web/index.html",
      },
      {
        label: "Legacy Angular app mutation report",
        href: "mutation/legacy/html/index.html",
      },
    ]);
    expect(linksOf(sections, "Coverage reports")).toEqual([
      {
        label: "Next.js web app coverage report",
        href: "coverage/web/index.html",
      },
      {
        label: "Legacy Angular app coverage report",
        href: "coverage/legacy/index.html",
      },
    ]);
    expect(linksOf(sections, "Lighthouse reports")).toEqual([
      {
        label: "Legacy Angular app, page /",
        href: "lighthouse/legacy/a.report.html",
      },
      { label: "Next.js app, page /", href: "lighthouse/next/b.report.html" },
    ]);
  });

  it("leaves out the target of a report whose folder is missing", () => {
    const present = ALL_PAGES.filter(
      (page) =>
        !page.startsWith("mutation/web") &&
        !page.startsWith("playwright/next-ubuntu-24.04-arm"),
    );
    const sections = planSections(
      (path) => present.includes(path),
      FULL_MANIFESTS,
    );
    expect(linksOf(sections, "Mutation testing reports")?.[1]).toEqual({
      label: "Next.js web app mutation report",
    });
    expect(linksOf(sections, "Mutation testing reports")?.[0]?.href).toBe(
      "mutation/backend/index.html",
    );
    expect(linksOf(sections, "Playwright end to end reports")?.[3]).toEqual({
      label: "Next.js app on ubuntu-24.04-arm",
    });
    expect(linksOf(sections, "Playwright end to end reports")?.[2]?.href).toBe(
      "playwright/next-ubuntu-24.04/index.html",
    );
  });

  it("marks everything not available when nothing was downloaded", () => {
    const sections = planSections(
      () => false,
      () => undefined,
    );
    for (const section of sections) {
      expect(section.links.length).toBeGreaterThan(0);
      for (const link of section.links) {
        expect(link.href).toBeUndefined();
      }
    }
    expect(linksOf(sections, "Lighthouse reports")).toEqual([
      { label: "Legacy Angular app" },
      { label: "Next.js app" },
    ]);
  });

  it("marks a lighthouse side not available when its report file is missing", () => {
    const present = ALL_PAGES.filter(
      (page) => page !== "lighthouse/next/b.report.html",
    );
    const sections = planSections(
      (path) => present.includes(path),
      FULL_MANIFESTS,
    );
    expect(linksOf(sections, "Lighthouse reports")).toEqual([
      {
        label: "Legacy Angular app, page /",
        href: "lighthouse/legacy/a.report.html",
      },
      { label: "Next.js app" },
    ]);
  });

  it("marks a lighthouse side not available when its manifest is unusable", () => {
    const sections = planSections(
      (path) => ALL_PAGES.includes(path),
      readerFor({
        "lighthouse/next": manifestFor(
          "b.report.html",
          "http://localhost:3000/cart",
        ),
      }),
    );
    expect(linksOf(sections, "Lighthouse reports")).toEqual([
      { label: "Legacy Angular app" },
      {
        label: "Next.js app, page /cart",
        href: "lighthouse/next/b.report.html",
      },
    ]);
  });
});

describe("lighthouseLinks", () => {
  const entry = (
    overrides: Record<string, unknown>,
  ): Record<string, unknown> => ({
    url: "http://localhost:3000/cart",
    isRepresentativeRun: true,
    htmlPath: "/work/reports/lighthouse/next/cart.report.html",
    ...overrides,
  });

  it("links one representative report per page by file name", () => {
    const links = lighthouseLinks(
      [
        entry({ url: "http://localhost:3000/", htmlPath: "/w/a.report.html" }),
        entry({ isRepresentativeRun: false, htmlPath: "/w/skip.report.html" }),
        entry({
          url: "http://localhost:3000/products/lavender-dusk",
          htmlPath: "/w/c.report.html",
        }),
      ],
      "Next.js app",
      "lighthouse/next",
    );
    expect(links).toEqual([
      { label: "Next.js app, page /", href: "lighthouse/next/a.report.html" },
      {
        label: "Next.js app, page /products/lavender-dusk",
        href: "lighthouse/next/c.report.html",
      },
    ]);
  });

  it("takes the file name from a windows path", () => {
    const [link] = lighthouseLinks(
      [entry({ htmlPath: "C:\\work\\lh\\x.report.html" })],
      "L",
      "lighthouse/legacy",
    );
    expect(link?.href).toBe("lighthouse/legacy/x.report.html");
  });

  it("labels an address that is not a url by the address itself", () => {
    const [link] = lighthouseLinks([entry({ url: "not a url" })], "L", "f");
    expect(link?.label).toBe("L, page not a url");
  });

  it("returns nothing for anything that is not a manifest", () => {
    for (const manifest of [undefined, null, "x", 3, {}, { url: "u" }, []]) {
      expect(lighthouseLinks(manifest, "L", "f")).toEqual([]);
    }
  });

  it("skips entries that are malformed", () => {
    const malformed = [
      null,
      "x",
      7,
      [],
      entry({ htmlPath: 4 }),
      entry({ htmlPath: undefined }),
      entry({ url: 4 }),
      entry({ isRepresentativeRun: "true" }),
      entry({ isRepresentativeRun: undefined }),
      entry({ htmlPath: "" }),
      entry({ htmlPath: "/w/" }),
    ];
    expect(lighthouseLinks(malformed, "L", "f")).toEqual([]);
  });
});
