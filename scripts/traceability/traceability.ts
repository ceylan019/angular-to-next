import ts from "typescript";

export type Layer = "legacy" | "web" | "api" | "e2e";
export type Flow = "browse" | "cart" | "checkout";
export type Requirement = {
  id: string;
  flow: Flow;
  rule: string;
  layers: Layer[];
};
export type SourceFile = { path: string; layer: Layer; content: string };
export type Hit = { id: string; layer: Layer; path: string; title: string };
export type TraceabilityInput = {
  requirements: readonly Requirement[];
  knownDifferences: readonly string[];
  hits: readonly Hit[];
  enabledFlows: readonly string[];
};

type Title = { text: string; literal: string };
type TitledCall = { callee: string; title: Title };
type Row = { id: string; listed: readonly Layer[]; required: readonly Layer[] };

const LAYERS: readonly Layer[] = ["legacy", "web", "api", "e2e"];
const FLOWS: readonly Flow[] = ["browse", "cart", "checkout"];
const KNOWN_DIFFERENCE_LAYERS: readonly Layer[] = ["legacy", "e2e"];
const TEST_CALLEES: ReadonlySet<string> = new Set([
  "it",
  "test",
  "describe",
  "test.describe",
  "it.each()",
  "test.each()",
  "describe.each()",
]);
const FLOW_CALLEES: ReadonlySet<string> = new Set(["test", "test.describe"]);
const REQUIREMENT_ROW = /^\|\s*BR-/;
const KNOWN_DIFFERENCE_HEADING = /^## KD-\d+/gm;
const ID = /\[(?:BR-[A-Z]\d+|KD-\d+)\]/g;
const FLOW_TAG = /(?<!\S)@(?:shell|browse|cart|checkout)(?!\S)/g;
const SEPARATOR = "\u0000";
export const FLOWS_MODULE = "e2e/support/flows.ts";
const INVALID_FLOWS = `ENABLED_NEXT_FLOWS in ${FLOWS_MODULE} must be an array of string literals`;

const isLayer = (value: string): value is Layer =>
  LAYERS.some((layer) => layer === value);

const isFlow = (value: string): value is Flow =>
  FLOWS.some((flow) => flow === value);

const byCodeUnit = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

const byId = (a: string, b: string): number =>
  a.localeCompare(b, "en", { numeric: true });

function parseRow(line: string): Requirement {
  const cells = line
    .split("|")
    .slice(1)
    .map((cell) => cell.trim());
  if (cells.at(-1) === "") {
    cells.pop();
  }
  const [id, flow, rule, layerCell] = cells as [string, string, string, string];
  if (cells.length !== 4) {
    throw new Error(`${id} needs four cells: ID, flow, rule and layers`);
  }
  if (!isFlow(flow)) {
    throw new Error(`${id} has an unknown flow: ${flow}`);
  }
  const layers = layerCell
    .split(",")
    .map((layer) => layer.trim())
    .filter((layer) => layer !== "");
  if (layers.length === 0) {
    throw new Error(`${id} lists no layers`);
  }
  if (!layers.every(isLayer)) {
    const unknown = layers.filter((layer) => !isLayer(layer));
    throw new Error(`${id} lists unknown layers: ${unknown.join(", ")}`);
  }
  return { id, flow, rule, layers };
}

export function parseRequirements(markdown: string): Requirement[] {
  const requirements = markdown
    .split("\n")
    .filter((line) => REQUIREMENT_ROW.test(line.trim()))
    .map(parseRow);
  const duplicate = requirements.find(
    (requirement, index) =>
      requirements.findIndex((other) => other.id === requirement.id) !== index,
  );
  if (duplicate !== undefined) {
    throw new Error(`${duplicate.id} is listed twice`);
  }
  return requirements;
}

export function parseKnownDifferences(markdown: string): string[] {
  return [
    ...new Set(
      Array.from(markdown.matchAll(KNOWN_DIFFERENCE_HEADING), (match) =>
        match[0].slice(3),
      ),
    ),
  ];
}

function calleeName(expression: ts.Expression, source: ts.SourceFile): string {
  if (ts.isPropertyAccessExpression(expression)) {
    return `${calleeName(expression.expression, source)}.${expression.name.text}`;
  }
  if (ts.isCallExpression(expression)) {
    return `${calleeName(expression.expression, source)}()`;
  }
  return expression.getText(source);
}

function titleOf(expression: ts.Expression, source: ts.SourceFile): Title {
  if (ts.isStringLiteralLike(expression)) {
    return { text: expression.text, literal: expression.text };
  }
  if (ts.isTemplateExpression(expression)) {
    const spans = expression.templateSpans;
    return {
      text: [
        expression.head.text,
        ...spans.map(
          (span) =>
            `\${${span.expression.getText(source)}}${span.literal.text}`,
        ),
      ].join(""),
      literal: [
        expression.head.text,
        ...spans.map((span) => span.literal.text),
      ].join(SEPARATOR),
    };
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = titleOf(expression.left, source);
    const right = titleOf(expression.right, source);
    return {
      text: left.text + right.text,
      literal: left.literal + right.literal,
    };
  }
  return { text: `\${${expression.getText(source)}}`, literal: SEPARATOR };
}

function titledCall(
  call: ts.CallExpression,
  source: ts.SourceFile,
  callees: ReadonlySet<string>,
): TitledCall | undefined {
  const callee = calleeName(call.expression, source);
  const [first] = call.arguments;
  if (!callees.has(callee) || first === undefined) {
    return undefined;
  }
  const title = titleOf(first, source);
  return {
    callee,
    title: {
      text: title.text.replace(/\s+/g, " ").trim(),
      literal: title.literal,
    },
  };
}

export function extractTestIds(file: SourceFile): Hit[] {
  const source = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
  );
  const hits: Hit[] = [];
  const visit = (node: ts.Node): void => {
    const titled = ts.isCallExpression(node)
      ? titledCall(node, source, TEST_CALLEES)
      : undefined;
    if (titled !== undefined) {
      const ids = new Set(
        Array.from(titled.title.literal.matchAll(ID), (match) =>
          match[0].slice(1, -1),
        ),
      );
      for (const id of ids) {
        hits.push({
          id,
          layer: file.layer,
          path: file.path,
          title: titled.title.text,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

export function parseEnabledFlows(source: string): string[] {
  const file = ts.createSourceFile(
    FLOWS_MODULE,
    source,
    ts.ScriptTarget.Latest,
  );
  const declaration = file.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((candidate) => candidate.name.getText(file) === "ENABLED_NEXT_FLOWS");
  if (declaration === undefined) {
    throw new Error(`ENABLED_NEXT_FLOWS is missing from ${FLOWS_MODULE}`);
  }
  const list = declaration.initializer;
  if (list === undefined || !ts.isArrayLiteralExpression(list)) {
    throw new Error(INVALID_FLOWS);
  }
  const flows = list.elements.filter(ts.isStringLiteral);
  if (flows.length !== list.elements.length) {
    throw new Error(INVALID_FLOWS);
  }
  return flows.map((flow) => flow.text);
}

function cell(row: Row, layer: Layer, hits: readonly Hit[]): string {
  const tests = new Set(
    hits
      .filter((found) => found.id === row.id && found.layer === layer)
      .sort(
        (a, b) => byCodeUnit(a.path, b.path) || byCodeUnit(a.title, b.title),
      )
      .map(
        (found) => `\`${found.path}\` ${found.title.replaceAll("|", "\\|")}`,
      ),
  );
  if (tests.size > 0) {
    return [...tests].join("<br>");
  }
  if (row.required.includes(layer)) {
    return "missing";
  }
  return row.listed.includes(layer) ? "pending" : "not required";
}

export function buildTraceability({
  requirements,
  knownDifferences,
  hits,
  enabledFlows,
}: TraceabilityInput): { markdown: string; problems: string[] } {
  const requirementRows: Row[] = [...requirements]
    .sort((a, b) => byId(a.id, b.id))
    .map((requirement) => ({
      id: requirement.id,
      listed: requirement.layers,
      required: requirement.layers.filter(
        (layer) => layer !== "web" || enabledFlows.includes(requirement.flow),
      ),
    }));
  const knownDifferenceRows: Row[] = [...knownDifferences]
    .sort(byId)
    .map((id) => ({
      id,
      listed: KNOWN_DIFFERENCE_LAYERS,
      required: KNOWN_DIFFERENCE_LAYERS,
    }));
  const documented = new Set([
    ...requirements.map((requirement) => requirement.id),
    ...knownDifferences,
  ]);
  const problems = [
    ...[...requirementRows, ...knownDifferenceRows].flatMap((row) =>
      LAYERS.filter(
        (layer) =>
          row.required.includes(layer) &&
          !hits.some((found) => found.id === row.id && found.layer === layer),
      ).map((layer) => `${row.id} has no ${layer} test`),
    ),
    ...[...new Set(hits.map((found) => found.id))]
      .filter((id) => !documented.has(id))
      .sort(byId)
      .map((id) => `${id} is used in tests but is not documented`),
  ];
  const table = (heading: string, rows: readonly Row[]): string[] => [
    `| ${heading} | Legacy | Web | API | E2E |`,
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.id} | ${LAYERS.map((layer) => cell(row, layer, hits)).join(" | ")} |`,
    ),
  ];
  const flows = enabledFlows.length > 0 ? enabledFlows.join(", ") : "none";
  const markdown = [
    "# Traceability",
    "",
    "Generated by `pnpm traceability` from the requirement and known difference IDs in test titles. Do not edit it by hand.",
    "",
    `Rules live in [requirements.md](requirements.md) and known differences in [known-differences.md](known-differences.md). A requirement needs a test in every layer it lists, and a known difference needs a legacy and an e2e test. Web tests become required once their flow is enabled for the next project; until then the cell reads pending. Flows enabled for the next project: ${flows}.`,
    "",
    "## Requirements",
    "",
    ...table("Requirement", requirementRows),
    "",
    "## Known differences",
    "",
    ...table("Known difference", knownDifferenceRows),
    "",
  ].join("\n");
  return { markdown, problems };
}

export function checkFlowTags(
  files: readonly { path: string; content: string }[],
): string[] {
  return files.flatMap((file) => {
    const source = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
    );
    const calls = source.statements.flatMap((statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression)
        ? [statement.expression]
        : [],
    );
    const titled = calls.flatMap(
      (call) => titledCall(call, source, FLOW_CALLEES) ?? [],
    );
    const untagged = titled
      .filter(({ title }) => new Set(title.literal.match(FLOW_TAG)).size !== 1)
      .map(
        ({ title }) =>
          `${file.path}: "${title.text}" needs exactly one flow tag (@shell, @browse, @cart or @checkout)`,
      );
    return titled.some(({ callee }) => callee === "test.describe")
      ? untagged
      : [`${file.path} has no top level test.describe`, ...untagged];
  });
}
