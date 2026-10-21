import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { artifactFolders, buildSiteIndex, planSections } from "./build-site.ts";

export function layoutSite(
  artifacts: string,
  out: string,
  repoUrl: string,
): { missing: string[] } {
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
      return JSON.parse(
        readFileSync(join(out, folder, "manifest.json"), "utf8"),
      ) as unknown;
    } catch {
      return undefined;
    }
  };

  const sections = planSections(
    (path) => existsSync(join(out, path)),
    readManifest,
  );
  writeFileSync(join(out, "index.html"), buildSiteIndex(sections, repoUrl));
  return { missing };
}
