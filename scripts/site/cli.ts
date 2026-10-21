import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { artifactFolders, buildSiteIndex, planSections } from "./build-site.ts";

const DEFAULT_REPO = "https://github.com/ceylan019/angular-to-next";

const { values } = parseArgs({
  options: {
    artifacts: { type: "string", default: "artifacts" },
    out: { type: "string", default: "site" },
    repo: { type: "string", default: DEFAULT_REPO },
  },
});

const artifacts = resolve(values.artifacts);
const out = resolve(values.out);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const missing: string[] = [];
for (const { artifact, folder } of artifactFolders()) {
  const source = join(artifacts, artifact);
  if (existsSync(source)) {
    cpSync(source, join(out, folder), { recursive: true });
  } else {
    missing.push(artifact);
  }
}

const readManifest = (folder: string): unknown => {
  try {
    return JSON.parse(readFileSync(join(out, folder, "manifest.json"), "utf8"));
  } catch {
    return undefined;
  }
};

const sections = planSections(
  (path) => existsSync(join(out, path)),
  readManifest,
);
writeFileSync(join(out, "index.html"), buildSiteIndex(sections, values.repo));

console.log(
  `Wrote ${join(out, "index.html")}. Missing artifacts: ${missing.length === 0 ? "none" : missing.join(", ")}.`,
);
