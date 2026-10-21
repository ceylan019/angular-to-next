import { describe, expect, it } from "vitest";
import {
  buildTraceability,
  checkFlowTags,
  extractTestIds,
  parseEnabledFlows,
  parseKnownDifferences,
  parseRequirements,
  type Hit,
  type Layer,
  type Requirement,
} from "./traceability.ts";

const table = (...rows: string[]): string =>
  [
    "# Requirements",
    "",
    "| ID | Flow | Rule | Layers |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");

const legacy = (content: string, path = "legacy/src/app/a.spec.ts") =>
  extractTestIds({ path, layer: "legacy", content });

const ids = (content: string): string[] => legacy(content).map((hit) => hit.id);

const requirement = (
  id: string,
  flow: Requirement["flow"],
  layers: Layer[],
): Requirement => ({ id, flow, rule: `Rule ${id}`, layers });

const hit = (
  id: string,
  layer: Layer,
  path = `${layer}/a.test.ts`,
  title = `[${id}] covers it`,
): Hit => ({ id, layer, path, title });

const build = (input: {
  requirements?: Requirement[];
  knownDifferences?: string[];
  hits?: Hit[];
  enabledFlows?: string[];
}) =>
  buildTraceability({
    requirements: input.requirements ?? [],
    knownDifferences: input.knownDifferences ?? [],
    hits: input.hits ?? [],
    enabledFlows: input.enabledFlows ?? [],
  });

const rowOf = (markdown: string, id: string): string | undefined =>
  markdown.split("\n").find((line) => line.startsWith(`| ${id} |`));

const spec = (content: string, path = "e2e/tests/cart/cart.spec.ts") => ({
  path,
  content,
});

const needsTag = (path: string, title: string): string =>
  `${path}: "${title}" needs exactly one flow tag (@shell, @browse, @cart or @checkout)`;

describe("parseRequirements", () => {
  it("parses requirement rows", () => {
    const markdown = table(
      "| BR-B1 | browse | The list shows 12 candles per page. | legacy, web, api, e2e |",
      "| BR-C5 | cart | Shipping is free at $50.00. | legacy, e2e |",
    );

    expect(parseRequirements(markdown)).toEqual([
      {
        id: "BR-B1",
        flow: "browse",
        rule: "The list shows 12 candles per page.",
        layers: ["legacy", "web", "api", "e2e"],
      },
      {
        id: "BR-C5",
        flow: "cart",
        rule: "Shipping is free at $50.00.",
        layers: ["legacy", "e2e"],
      },
    ]);
  });

  it("trims extra spaces around cells and layers", () => {
    const markdown = table(
      "   |   BR-K3   |  checkout  |   Card 4242 succeeds.   |   e2e ,legacy,   api   |   ",
      "|BR-K4|checkout|Stock is rechecked.|api|",
    );

    expect(parseRequirements(markdown)).toEqual([
      {
        id: "BR-K3",
        flow: "checkout",
        rule: "Card 4242 succeeds.",
        layers: ["e2e", "legacy", "api"],
      },
      {
        id: "BR-K4",
        flow: "checkout",
        rule: "Stock is rechecked.",
        layers: ["api"],
      },
    ]);
  });

  it("reads a row without a closing pipe and skips empty layer items", () => {
    expect(
      parseRequirements(table("| BR-B2 | browse | Filters. | legacy, , e2e")),
    ).toEqual([
      {
        id: "BR-B2",
        flow: "browse",
        rule: "Filters.",
        layers: ["legacy", "e2e"],
      },
    ]);
  });

  it("ignores headers, separators, prose and rows that are not requirements", () => {
    const markdown = [
      "# Requirements",
      "",
      "BR-B1 is mentioned in prose | legacy |",
      "- BR-B2 is mentioned in a list",
      "| ID | Flow | Rule | Layers |",
      "|:---|:---:|---|---:|",
      "| KD-01 | cart | Not a requirement. | e2e |",
      "Text | BR-B3 | browse | Not a row. | e2e |",
      "",
    ].join("\n");

    expect(parseRequirements(markdown)).toEqual([]);
  });

  it("returns no requirements for an empty table or document", () => {
    expect(parseRequirements(table())).toEqual([]);
    expect(parseRequirements("")).toEqual([]);
  });

  it("rejects an unknown layer name", () => {
    expect(() =>
      parseRequirements(table("| BR-B1 | browse | Rule. | legacy, unit |")),
    ).toThrow(new Error("BR-B1 lists unknown layers: unit"));
    expect(() =>
      parseRequirements(table("| BR-B1 | browse | Rule. | unit, e2e, ui |")),
    ).toThrow(new Error("BR-B1 lists unknown layers: unit, ui"));
  });

  it("rejects an unknown flow", () => {
    expect(() =>
      parseRequirements(table("| BR-B1 | shell | Rule. | legacy |")),
    ).toThrow(new Error("BR-B1 has an unknown flow: shell"));
  });

  it("rejects a requirement without layers", () => {
    expect(() =>
      parseRequirements(table("| BR-B1 | browse | Rule. |  |")),
    ).toThrow(new Error("BR-B1 lists no layers"));
    expect(() =>
      parseRequirements(table("| BR-B1 | browse | Rule. | , |")),
    ).toThrow(new Error("BR-B1 lists no layers"));
  });

  it("rejects a row with the wrong number of cells", () => {
    expect(() =>
      parseRequirements(table("| BR-B1 | browse | legacy, e2e |")),
    ).toThrow(new Error("BR-B1 needs four cells: ID, flow, rule and layers"));
    expect(() =>
      parseRequirements(table("| BR-B1 | browse | Rule. | e2e | extra |")),
    ).toThrow(new Error("BR-B1 needs four cells: ID, flow, rule and layers"));
  });

  it("rejects a requirement listed twice", () => {
    expect(() =>
      parseRequirements(
        table(
          "| BR-B1 | browse | Rule. | e2e |",
          "| BR-B2 | browse | Rule. | e2e |",
          "| BR-B1 | browse | Again. | legacy |",
        ),
      ),
    ).toThrow(new Error("BR-B1 is listed twice"));
  });
});

describe("parseKnownDifferences", () => {
  it("reads known difference ids from section headings", () => {
    const markdown = [
      "# Known differences",
      "",
      "## KD-01 Cart totals lose a cent",
      "",
      "Breaks BR-C5, unlike KD-09.",
      "",
      "## KD-02 Not found pages answer 200",
      "### KD-07 A subsection",
      "# KD-08 A title",
      " ## KD-06 Indented",
      "## Background",
      "## KD-10 Two digits",
    ].join("\n");

    expect(parseKnownDifferences(markdown)).toEqual([
      "KD-01",
      "KD-02",
      "KD-10",
    ]);
  });

  it("lists a repeated heading once", () => {
    expect(parseKnownDifferences("## KD-01 First\n## KD-01 Again")).toEqual([
      "KD-01",
    ]);
  });

  it("returns no ids for a document without sections", () => {
    expect(parseKnownDifferences("# Known differences\n\nNone yet.")).toEqual(
      [],
    );
  });
});

describe("extractTestIds", () => {
  it("finds ids in it, test and describe titles", () => {
    const content = [
      'describe("[BR-B1] list", () => {',
      "  it('[BR-C5] [KD-03] ships free', () => {});",
      '  test("[BR-B2] filters", async () => {});',
      "});",
      'test.describe("[BR-B3] sort @browse", () => {});',
    ].join("\n");

    expect(legacy(content)).toEqual([
      {
        id: "BR-B1",
        layer: "legacy",
        path: "legacy/src/app/a.spec.ts",
        title: "[BR-B1] list",
      },
      {
        id: "BR-C5",
        layer: "legacy",
        path: "legacy/src/app/a.spec.ts",
        title: "[BR-C5] [KD-03] ships free",
      },
      {
        id: "KD-03",
        layer: "legacy",
        path: "legacy/src/app/a.spec.ts",
        title: "[BR-C5] [KD-03] ships free",
      },
      {
        id: "BR-B2",
        layer: "legacy",
        path: "legacy/src/app/a.spec.ts",
        title: "[BR-B2] filters",
      },
      {
        id: "BR-B3",
        layer: "legacy",
        path: "legacy/src/app/a.spec.ts",
        title: "[BR-B3] sort @browse",
      },
    ]);
  });

  it("finds ids in it.each, test.each and describe.each titles but not in their tables", () => {
    const content = [
      'it.each([["[BR-B9]", 1]])("[BR-B4] page %s is kept", (v, n) => {});',
      'test.each(["[BR-B8]"])("[BR-K3] luhn %s", () => {});',
      'describe.each([1])("[BR-C2] cap %d", () => {});',
    ].join("\n");

    expect(legacy(content).map(({ id, title }) => ({ id, title }))).toEqual([
      { id: "BR-B4", title: "[BR-B4] page %s is kept" },
      { id: "BR-K3", title: "[BR-K3] luhn %s" },
      { id: "BR-C2", title: "[BR-C2] cap %d" },
    ]);
  });

  it("recognises callees split across lines", () => {
    const content = [
      "test",
      '  .describe("[BR-B3] split describe @browse", () => {});',
      "it",
      '  .each([1])("[BR-B4] split each %s", () => {});',
    ].join("\n");

    expect(ids(content)).toEqual(["BR-B3", "BR-B4"]);
  });

  it("reads a template literal title and keeps its placeholders", () => {
    const content = [
      "for (const row of ROWS) {",
      "  test(`[BR-K2] ${row.title} is rejected`, async () => {});",
      "  test(`[BR-K2] ${row.field} and ${row.value}`, async () => {});",
      "  test(`[BR-K1] no placeholder`, async () => {});",
      "}",
    ].join("\n");

    expect(legacy(content).map(({ id, title }) => ({ id, title }))).toEqual([
      { id: "BR-K2", title: "[BR-K2] ${row.title} is rejected" },
      { id: "BR-K2", title: "[BR-K2] ${row.field} and ${row.value}" },
      { id: "BR-K1", title: "[BR-K1] no placeholder" },
    ]);
  });

  it("reads a title built by concatenation", () => {
    const content = [
      "it(",
      "  '[BR-B6] shows ' +",
      "    c.text +",
      "    ' with max ' +",
      "    c.max,",
      "  () => {},",
      ");",
    ].join("\n");

    expect(legacy(content).map(({ id, title }) => ({ id, title }))).toEqual([
      { id: "BR-B6", title: "[BR-B6] shows ${c.text} with max ${c.max}" },
    ]);
  });

  it("reads ids from every literal part of a title", () => {
    const content = [
      "it('lead ' + x + ' [BR-C6] tail', () => {});",
      "it(`${a} [BR-C7] ${b}`, () => {});",
      "it(`${a} end [KD-04]`, () => {});",
      'it("[BR-" + "C1] joined", () => {});',
    ].join("\n");

    expect(ids(content)).toEqual(["BR-C6", "BR-C7", "KD-04", "BR-C1"]);
  });

  it("collapses whitespace in titles", () => {
    const content = [
      "it(`[BR-B1] spans",
      "     two lines`, () => {});",
      'it("  [BR-B2]   padded\\tout  ", () => {});',
    ].join("\n");

    expect(legacy(content).map((found) => found.title)).toEqual([
      "[BR-B1] spans two lines",
      "[BR-B2] padded out",
    ]);
  });

  it("counts an id once per title", () => {
    expect(ids("it('[BR-C5] [BR-C5] twice [KD-01]', () => {});")).toEqual([
      "BR-C5",
      "KD-01",
    ]);
  });

  it("ignores ids outside test titles", () => {
    const content = [
      'const title = "[BR-B1] in a variable";',
      "// it('[BR-B2] in a line comment', () => {});",
      "/* it('[BR-B3] in a block comment', () => {}); */",
      "it(title, () => {",
      '  expect(value, "[BR-B4] in an assertion message").toBe(1);',
      "});",
      'it("plain title", () => { log("[BR-B5] in another call"); });',
      'grep.test("[BR-B6] in a member call named test");',
      'test.step("[BR-B7] in a step", async () => {});',
      'test.skip("[BR-B8] in a skipped test", () => {});',
      'it(`covers ${ids["[BR-C1]"]}`, () => {});',
      'it("[BR-" + x + "C2]", () => {});',
      "it(`[BR-${x}C3]`, () => {});",
      'it("[BR-C4] fallback" || other, () => {});',
      'x["it"]("[BR-C5] by element access", () => {});',
      'it("plain", "[BR-C6] second argument");',
      "it();",
    ].join("\n");

    expect(legacy(content)).toEqual([]);
  });

  it("recognises two digit numbers and malformed ids so they can be reported", () => {
    expect(
      ids("it('[BR-B10] [KD-123] [BR-Z1] [br-c5] [BR-C] [KD-] [BR-5]', f);"),
    ).toEqual(["BR-B10", "KD-123", "BR-Z1"]);
  });

  it("parses tsx test files", () => {
    const content = [
      'it("[BR-B1] renders the list", () => {',
      "  render(<List items={[]} />);",
      '  expect(screen.getByRole("list")).toBeVisible();',
      "});",
    ].join("\n");

    expect(
      extractTestIds({ path: "web/src/list.test.tsx", layer: "web", content }),
    ).toEqual([
      {
        id: "BR-B1",
        layer: "web",
        path: "web/src/list.test.tsx",
        title: "[BR-B1] renders the list",
      },
    ]);
  });
});

describe("parseEnabledFlows", () => {
  it("reads enabled flows from the flows module", () => {
    expect(
      parseEnabledFlows(
        "export const ENABLED_NEXT_FLOWS: readonly Flow[] = ['shell', 'browse']",
      ),
    ).toEqual(["shell", "browse"]);
  });

  it("reads the empty list of the current module", () => {
    const source = [
      'export type Flow = "shell" | "browse" | "cart" | "checkout";',
      "",
      "export const ENABLED_NEXT_FLOWS: readonly Flow[] = [];",
      "",
      "export function flowGrep(flows: readonly Flow[]): RegExp {",
      '  return new RegExp(flows.join("|"));',
      "}",
    ].join("\n");

    expect(parseEnabledFlows(source)).toEqual([]);
  });

  it("reads a list spread over several lines", () => {
    const source = [
      "export const ENABLED_NEXT_FLOWS: readonly Flow[] = [",
      '  "shell",',
      '  "browse",',
      '  "cart",',
      "];",
    ].join("\n");

    expect(parseEnabledFlows(source)).toEqual(["shell", "browse", "cart"]);
  });

  it("reads the flows declaration, not another list", () => {
    const source = [
      'import { x } from "./x.js";',
      'const OTHER: readonly Flow[] = ["cart"];',
      'export const COUNT = 1, ENABLED_NEXT_FLOWS: readonly Flow[] = ["checkout"];',
    ].join("\n");

    expect(parseEnabledFlows(source)).toEqual(["checkout"]);
  });

  it("throws when the module has no flows declaration", () => {
    expect(() =>
      parseEnabledFlows('export const FLOWS: readonly Flow[] = ["cart"];'),
    ).toThrow(
      new Error("ENABLED_NEXT_FLOWS is missing from e2e/support/flows.ts"),
    );
  });

  it("throws when the flows are not an array of string literals", () => {
    const error = new Error(
      "ENABLED_NEXT_FLOWS in e2e/support/flows.ts must be an array of string literals",
    );

    expect(() =>
      parseEnabledFlows(
        'export const ENABLED_NEXT_FLOWS: readonly Flow[] = [...BASE, "cart"];',
      ),
    ).toThrow(error);
    expect(() =>
      parseEnabledFlows("export const ENABLED_NEXT_FLOWS = flows();"),
    ).toThrow(error);
    expect(() =>
      parseEnabledFlows("export let ENABLED_NEXT_FLOWS: Flow[];"),
    ).toThrow(error);
  });
});

describe("buildTraceability", () => {
  it("reports a missing layer", () => {
    const { problems } = build({
      requirements: [requirement("BR-C5", "cart", ["legacy", "e2e"])],
      hits: [hit("BR-C5", "legacy"), hit("BR-C5", "api")],
    });

    expect(problems).toEqual(["BR-C5 has no e2e test"]);
  });

  it("accepts a requirement with a test in every listed layer", () => {
    const { problems } = build({
      requirements: [requirement("BR-C5", "cart", ["legacy", "api", "e2e"])],
      hits: [hit("BR-C5", "legacy"), hit("BR-C5", "api"), hit("BR-C5", "e2e")],
    });

    expect(problems).toEqual([]);
  });

  it("does not require web tests for flows not yet enabled", () => {
    const { problems } = build({
      requirements: [requirement("BR-B1", "browse", ["legacy", "web", "e2e"])],
      hits: [hit("BR-B1", "legacy"), hit("BR-B1", "e2e")],
      enabledFlows: ["shell", "cart"],
    });

    expect(problems).toEqual([]);
  });

  it("requires web tests once the flow is enabled", () => {
    const requirements = [
      requirement("BR-B1", "browse", ["legacy", "web", "e2e"]),
    ];
    const hits = [hit("BR-B1", "legacy"), hit("BR-B1", "e2e")];

    expect(
      build({ requirements, hits, enabledFlows: ["shell", "browse"] }).problems,
    ).toEqual(["BR-B1 has no web test"]);
    expect(
      build({
        requirements,
        hits: [...hits, hit("BR-B1", "web")],
        enabledFlows: ["browse"],
      }).problems,
    ).toEqual([]);
  });

  it("never requires web tests for a requirement that does not list web", () => {
    const { problems } = build({
      requirements: [requirement("BR-B9", "browse", ["legacy", "e2e"])],
      hits: [hit("BR-B9", "legacy"), hit("BR-B9", "e2e")],
      enabledFlows: ["browse"],
    });

    expect(problems).toEqual([]);
  });

  it("requires e2e and legacy tests for every known difference", () => {
    expect(build({ knownDifferences: ["KD-03"] }).problems).toEqual([
      "KD-03 has no legacy test",
      "KD-03 has no e2e test",
    ]);
    expect(
      build({
        knownDifferences: ["KD-03"],
        hits: [hit("KD-03", "web"), hit("KD-03", "api")],
      }).problems,
    ).toEqual(["KD-03 has no legacy test", "KD-03 has no e2e test"]);
    expect(
      build({
        knownDifferences: ["KD-03"],
        hits: [hit("KD-03", "legacy"), hit("KD-03", "e2e")],
      }).problems,
    ).toEqual([]);
  });

  it("reports unknown ids used in tests", () => {
    const { problems } = build({
      requirements: [requirement("BR-C5", "cart", ["e2e"])],
      knownDifferences: ["KD-01"],
      hits: [
        hit("KD-09", "legacy"),
        hit("BR-Z1", "e2e"),
        hit("BR-C5", "e2e"),
        hit("BR-Z1", "legacy"),
        hit("KD-01", "legacy"),
        hit("KD-01", "e2e"),
      ],
    });

    expect(problems).toEqual([
      "BR-Z1 is used in tests but is not documented",
      "KD-09 is used in tests but is not documented",
    ]);
  });

  it("lists problems by requirement, then known difference, then unknown id", () => {
    const { problems } = build({
      requirements: [
        requirement("BR-C1", "cart", ["e2e", "legacy"]),
        requirement("BR-B10", "browse", ["api"]),
        requirement("BR-B2", "browse", ["api"]),
      ],
      knownDifferences: ["KD-02", "KD-01"],
      hits: [
        hit("KD-01", "legacy"),
        hit("KD-02", "e2e"),
        hit("BR-K9", "e2e"),
        hit("BR-B11", "e2e"),
        hit("BR-B3", "e2e"),
      ],
    });

    expect(problems).toEqual([
      "BR-B2 has no api test",
      "BR-B10 has no api test",
      "BR-C1 has no legacy test",
      "BR-C1 has no e2e test",
      "KD-01 has no e2e test",
      "KD-02 has no legacy test",
      "BR-B3 is used in tests but is not documented",
      "BR-B11 is used in tests but is not documented",
      "BR-K9 is used in tests but is not documented",
    ]);
  });

  it("renders a table of requirement, legacy, web, api and e2e tests", () => {
    const shipping = "[BR-C5] [KD-03] charges shipping at $50.00";
    const { markdown, problems } = build({
      requirements: [
        requirement("BR-C5", "cart", ["legacy", "api", "e2e"]),
        requirement("BR-B1", "browse", ["legacy", "web", "e2e"]),
      ],
      knownDifferences: ["KD-03"],
      hits: [
        hit("BR-B1", "legacy", "legacy/src/app/list.spec.ts", "[BR-B1] lists"),
        hit(
          "BR-B1",
          "e2e",
          "e2e/tests/browse/list.spec.ts",
          "[BR-B1] shows 12 | page",
        ),
        hit("BR-C5", "legacy", "legacy/src/app/shop.spec.ts", shipping),
        hit("KD-03", "legacy", "legacy/src/app/shop.spec.ts", shipping),
        hit(
          "BR-C5",
          "api",
          "backend/src/pricing.test.ts",
          "[BR-C5] ships free at 5000",
        ),
        hit(
          "BR-C5",
          "api",
          "backend/src/pricing.test.ts",
          "[BR-C5] charges 595 below 5000",
        ),
      ],
    });

    expect(markdown).toBe(
      [
        "# Traceability",
        "",
        "Generated by `pnpm traceability` from the requirement and known difference IDs in test titles. Do not edit it by hand.",
        "",
        "Rules live in [requirements.md](requirements.md) and known differences in [known-differences.md](known-differences.md). A requirement needs a test in every layer it lists, and a known difference needs a legacy and an e2e test. Web tests become required once their flow is enabled for the next project; until then the cell reads pending. Flows enabled for the next project: none.",
        "",
        "## Requirements",
        "",
        "| Requirement | Legacy | Web | API | E2E |",
        "| --- | --- | --- | --- | --- |",
        "| BR-B1 | `legacy/src/app/list.spec.ts` [BR-B1] lists | pending | not required | `e2e/tests/browse/list.spec.ts` [BR-B1] shows 12 \\| page |",
        "| BR-C5 | `legacy/src/app/shop.spec.ts` [BR-C5] [KD-03] charges shipping at $50.00 | not required | `backend/src/pricing.test.ts` [BR-C5] charges 595 below 5000<br>`backend/src/pricing.test.ts` [BR-C5] ships free at 5000 | missing |",
        "",
        "## Known differences",
        "",
        "| Known difference | Legacy | Web | API | E2E |",
        "| --- | --- | --- | --- | --- |",
        "| KD-03 | `legacy/src/app/shop.spec.ts` [BR-C5] [KD-03] charges shipping at $50.00 | not required | not required | missing |",
        "",
      ].join("\n"),
    );
    expect(problems).toEqual([
      "BR-C5 has no e2e test",
      "KD-03 has no e2e test",
    ]);
  });

  it("names the enabled flows and fills web cells once a flow is enabled", () => {
    const { markdown } = build({
      requirements: [
        requirement("BR-B1", "browse", ["web"]),
        requirement("BR-C1", "cart", ["web"]),
      ],
      hits: [hit("BR-C1", "web", "web/src/cart.test.tsx", "[BR-C1] adds")],
      enabledFlows: ["browse", "cart"],
    });

    expect(markdown).toContain(
      "Flows enabled for the next project: browse, cart.",
    );
    expect(rowOf(markdown, "BR-B1")).toBe(
      "| BR-B1 | not required | missing | not required | not required |",
    );
    expect(rowOf(markdown, "BR-C1")).toBe(
      "| BR-C1 | not required | `web/src/cart.test.tsx` [BR-C1] adds | not required | not required |",
    );
  });

  it("sorts rows by id with numbers in numeric order", () => {
    const { markdown } = build({
      requirements: [
        requirement("BR-C1", "cart", ["e2e"]),
        requirement("BR-B10", "browse", ["e2e"]),
        requirement("BR-B2", "browse", ["e2e"]),
      ],
      knownDifferences: ["KD-10", "KD-02"],
    });

    const order = markdown
      .split("\n")
      .filter((line) => /^\| (BR|KD)-/.test(line))
      .map((line) => line.split(" | ")[0]);

    expect(order).toEqual([
      "| BR-B2",
      "| BR-B10",
      "| BR-C1",
      "| KD-02",
      "| KD-10",
    ]);
  });

  it("sorts tests by path then title and lists each test once", () => {
    const { markdown } = build({
      requirements: [requirement("BR-C2", "cart", ["legacy"])],
      hits: [
        hit("BR-C2", "legacy", "legacy/src/b.spec.ts", "[BR-C2] b"),
        hit("BR-C2", "legacy", "legacy/src/a.spec.ts", "[BR-C2] z"),
        hit("BR-C2", "legacy", "legacy/src/a.spec.ts", "[BR-C2] a"),
        hit("BR-C2", "legacy", "legacy/src/a.spec.ts", "[BR-C2] z"),
        hit("BR-C2", "legacy", "legacy/src/a.spec.ts.bak", "[BR-C2] a"),
        hit("BR-C2", "legacy", "legacy/src/a.spec.ts", "[BR-C2] m"),
        hit("BR-C2", "e2e", "e2e/tests/cart.spec.ts", "[BR-C2] other layer"),
        hit("BR-C3", "legacy", "legacy/src/a.spec.ts", "[BR-C3] other id"),
      ],
    });

    expect(rowOf(markdown, "BR-C2")).toBe(
      [
        "| BR-C2 | `legacy/src/a.spec.ts` [BR-C2] a",
        "`legacy/src/a.spec.ts` [BR-C2] m",
        "`legacy/src/a.spec.ts` [BR-C2] z",
        "`legacy/src/a.spec.ts.bak` [BR-C2] a",
        "`legacy/src/b.spec.ts` [BR-C2] b | not required | not required | `e2e/tests/cart.spec.ts` [BR-C2] other layer |",
      ].join("<br>"),
    );
  });

  it("renders empty tables when nothing is documented", () => {
    const { markdown, problems } = build({});

    expect(markdown).toContain(
      "| Requirement | Legacy | Web | API | E2E |\n| --- | --- | --- | --- | --- |\n\n## Known differences",
    );
    expect(markdown.endsWith("| --- | --- | --- | --- | --- |\n")).toBe(true);
    expect(problems).toEqual([]);
  });
});

describe("checkFlowTags", () => {
  it("accepts a spec whose top level describe carries one flow tag", () => {
    const content = [
      'import { test } from "../../support/fixtures.js";',
      "",
      "const ITEMS = [1, 2];",
      "",
      "test.beforeEach(async () => {});",
      'test.describe.configure({ mode: "serial" });',
      "helper();",
      "",
      'test.describe("cart @cart", () => {',
      '  test("[BR-C1] adds", async () => {});',
      '  test.describe("nested without a tag", () => {});',
      "});",
    ].join("\n");

    expect(checkFlowTags([spec(content)])).toEqual([]);
  });

  it("reports a spec without a top level test.describe", () => {
    const path = "e2e/tests/cart/helpers.spec.ts";

    expect(
      checkFlowTags([spec('const ITEMS = ["@cart"];\nhelper();', path)]),
    ).toEqual([`${path} has no top level test.describe`]);
  });

  it("reports a describe that only exists inside another statement", () => {
    const path = "e2e/tests/cart/loop.spec.ts";
    const content = [
      "for (const item of ITEMS) {",
      '  test.describe("cart @cart", () => {});',
      "}",
    ].join("\n");

    expect(checkFlowTags([spec(content, path)])).toEqual([
      `${path} has no top level test.describe`,
    ]);
  });

  it("reports a top level describe without exactly one flow tag", () => {
    const path = "e2e/tests/cart/cart.spec.ts";
    const content = [
      'test.describe("cart", () => {',
      '  test.describe("inner @cart", () => {});',
      "});",
      'test.describe("cart @cart @checkout", () => {});',
      'test.describe("cart @cartography", () => {});',
      'test.describe("x@cart y", () => {});',
      'test.describe("cart @cart,", () => {});',
    ].join("\n");

    expect(checkFlowTags([spec(content, path)])).toEqual([
      needsTag(path, "cart"),
      needsTag(path, "cart @cart @checkout"),
      needsTag(path, "cart @cartography"),
      needsTag(path, "x@cart y"),
      needsTag(path, "cart @cart,"),
    ]);
  });

  it("accepts a flow tag anywhere in the title, repeated or beside unknown tags", () => {
    const content = [
      'test.describe("@shell header", () => {});',
      'test.describe("header @shell", () => {});',
      'test.describe("header @browse lists", () => {});',
      'test.describe("cart @cart @cart", () => {});',
      'test.describe("checkout @checkout @smoke", () => {});',
      "test.describe(`list ${name} @browse`, () => {});",
    ].join("\n");

    expect(checkFlowTags([spec(content)])).toEqual([]);
  });

  it("reports top level tests without exactly one flow tag", () => {
    const path = "e2e/tests/cart/loose.spec.ts";
    const content = [
      'test("loose test", async () => {});',
      'test.describe("cart @cart", () => {});',
      'test("tagged loose test @cart", async () => {});',
      "test.describe(`${name} cart`, () => {});",
      "test();",
    ].join("\n");

    expect(checkFlowTags([spec(content, path)])).toEqual([
      needsTag(path, "loose test"),
      needsTag(path, "${name} cart"),
    ]);
  });

  it("checks every file and reports only the bad ones", () => {
    const good = spec(
      'test.describe("cart @cart", () => {});',
      "e2e/tests/cart/good.spec.ts",
    );
    const bad = spec(
      'test("loose", async () => {});',
      "e2e/tests/cart/bad.spec.ts",
    );

    expect(checkFlowTags([good, bad])).toEqual([
      "e2e/tests/cart/bad.spec.ts has no top level test.describe",
      needsTag("e2e/tests/cart/bad.spec.ts", "loose"),
    ]);
  });
});
