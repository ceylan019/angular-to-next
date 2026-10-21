export type SiteLink = { label: string; href?: string };
export type SiteSection = { title: string; links: SiteLink[] };
export type ArtifactFolder = { artifact: string; folder: string };

type Report = ArtifactFolder & { label: string; entry: string };

export const SITE_TITLE = "Wick & Co. Candles migration reports";
const REPOSITORY_LINK = "Wick & Co. Candles migration repository on GitHub";
const NOT_AVAILABLE = "Not available in this run";

const LEGACY = "Legacy Angular app";
const NEXT = "Next.js app";
const WEB = "Next.js web app";
const RUNNERS = ["ubuntu-24.04", "ubuntu-24.04-arm"] as const;

const PLAYWRIGHT: readonly Report[] = (
  [
    ["legacy", LEGACY],
    ["next", NEXT],
  ] as const
).flatMap(([target, name]) =>
  RUNNERS.map((runner) => ({
    artifact: `playwright-${target}-${runner}`,
    folder: `playwright/${target}-${runner}`,
    entry: "index.html",
    label: `${name} on ${runner}`,
  })),
);

const MUTATION: readonly Report[] = [
  {
    artifact: "mutation-backend",
    folder: "mutation/backend",
    entry: "index.html",
    label: "Backend mutation report",
  },
  {
    artifact: "mutation-web",
    folder: "mutation/web",
    entry: "index.html",
    label: `${WEB} mutation report`,
  },
  {
    artifact: "mutation-legacy",
    folder: "mutation/legacy",
    entry: "html/index.html",
    label: `${LEGACY} mutation report`,
  },
];

const LIGHTHOUSE: readonly ArtifactFolder[] = [
  { artifact: "lighthouse-legacy", folder: "lighthouse/legacy" },
  { artifact: "lighthouse-next", folder: "lighthouse/next" },
];
const LIGHTHOUSE_LABELS = [LEGACY, NEXT] as const;

const COVERAGE: readonly Report[] = [
  {
    artifact: "coverage-web",
    folder: "coverage/web",
    entry: "index.html",
    label: `${WEB} coverage report`,
  },
  {
    artifact: "coverage-legacy",
    folder: "coverage/legacy",
    entry: "index.html",
    label: `${LEGACY} coverage report`,
  },
];

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? "");
}

const STYLE = `
    body { margin: 0; padding: 1.5rem 1rem; background: #ffffff; color: #1a1a1a; font: 1rem/1.5 system-ui, sans-serif; }
    main { max-width: 42rem; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin: 0 0 1.5rem; }
    h2 { font-size: 1.25rem; margin: 2rem 0 0.5rem; }
    a { color: #0b4f9e; }
    .missing { color: #4d4d4d; }
    footer { margin-top: 2.5rem; }`;

function renderLink(link: SiteLink): string {
  const label = escapeHtml(link.label);
  if (link.href === undefined) {
    return `<li class="missing">${label}: ${NOT_AVAILABLE.toLowerCase()}</li>`;
  }
  return `<li><a href="${escapeHtml(link.href)}">${label}</a></li>`;
}

function renderSection(section: SiteSection): string {
  const body =
    section.links.length === 0
      ? `<p class="missing">${NOT_AVAILABLE}.</p>`
      : `<ul>\n${section.links.map(renderLink).join("\n")}\n</ul>`;
  return `<section>\n<h2>${escapeHtml(section.title)}</h2>\n${body}\n</section>`;
}

export function buildSiteIndex(
  sections: readonly SiteSection[],
  repoUrl: string,
): string {
  const title = escapeHtml(SITE_TITLE);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${STYLE}
</style>
</head>
<body>
<main>
<h1>${title}</h1>
${sections.map(renderSection).join("\n")}
<footer>
<p><a href="${escapeHtml(repoUrl)}">${escapeHtml(REPOSITORY_LINK)}</a></p>
</footer>
</main>
</body>
</html>
`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? "";

function pageOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function lighthouseLinks(
  manifest: unknown,
  label: string,
  folder: string,
): SiteLink[] {
  if (!Array.isArray(manifest)) {
    return [];
  }
  const links: SiteLink[] = [];
  for (const entry of manifest as unknown[]) {
    if (
      isRecord(entry) &&
      entry["isRepresentativeRun"] === true &&
      typeof entry["url"] === "string" &&
      typeof entry["htmlPath"] === "string" &&
      fileName(entry["htmlPath"]) !== ""
    ) {
      links.push({
        label: `${label}, page ${pageOf(entry["url"])}`,
        href: `${folder}/${fileName(entry["htmlPath"])}`,
      });
    }
  }
  return links;
}

export function artifactFolders(): ArtifactFolder[] {
  return [...PLAYWRIGHT, ...MUTATION, ...LIGHTHOUSE, ...COVERAGE].map(
    ({ artifact, folder }) => ({ artifact, folder }),
  );
}

function reportLinks(
  reports: readonly Report[],
  exists: (path: string) => boolean,
): SiteLink[] {
  return reports.map(({ label, folder, entry }) => {
    const href = `${folder}/${entry}`;
    return exists(href) ? { label, href } : { label };
  });
}

export function planSections(
  exists: (path: string) => boolean,
  readManifest: (folder: string) => unknown,
): SiteSection[] {
  const lighthouse = LIGHTHOUSE.flatMap(({ folder }, index) => {
    const label = LIGHTHOUSE_LABELS[index] ?? folder;
    const links = lighthouseLinks(readManifest(folder), label, folder).filter(
      (link) => link.href !== undefined && exists(link.href),
    );
    return links.length === 0 ? [{ label }] : links;
  });
  return [
    {
      title: "Playwright end to end reports",
      links: reportLinks(PLAYWRIGHT, exists),
    },
    { title: "Mutation testing reports", links: reportLinks(MUTATION, exists) },
    { title: "Lighthouse reports", links: lighthouse },
    { title: "Coverage reports", links: reportLinks(COVERAGE, exists) },
  ];
}
