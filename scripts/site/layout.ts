import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { artifactFolders, buildSiteIndex, planSections } from "./build-site.ts";

const contains = (folder: string, path: string): boolean => {
  const way = relative(folder, path);
  return way !== ".." && !way.startsWith(`..${sep}`);
};

function refusal(
  out: string,
  artifacts: string,
  workdir: string,
): string | undefined {
  if (out === workdir) return "it is the working directory";
  if (contains(out, workdir)) return "it holds the working directory";
  if (out === artifacts) return "it is the artifacts folder";
  if (contains(out, artifacts)) return "it holds the artifacts folder";
  if (!contains(workdir, out)) return "it is outside the working directory";
  return undefined;
}

export function layoutSite(
  artifactsPath: string,
  outPath: string,
  repoUrl: string,
  workdirPath: string,
): { missing: string[] } {
  const workdir = resolve(workdirPath);
  const artifacts = resolve(workdir, artifactsPath);
  const out = resolve(workdir, outPath);
  const reason = refusal(out, artifacts, workdir);
  if (reason !== undefined) {
    throw new Error(`Refusing to replace ${out}: ${reason}.`);
  }

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
