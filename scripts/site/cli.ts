import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { layoutSite } from "./layout.ts";

const DEFAULT_REPO = "https://github.com/ceylan019/angular-to-next";

const { values } = parseArgs({
  options: {
    artifacts: { type: "string", default: "artifacts" },
    out: { type: "string", default: "site" },
    repo: { type: "string", default: DEFAULT_REPO },
  },
});

const out = resolve(values.out);
const { missing } = layoutSite(
  resolve(values.artifacts),
  out,
  values.repo,
  process.cwd(),
);

console.log(
  `Wrote ${join(out, "index.html")}. Missing artifacts: ${missing.length === 0 ? "none" : missing.join(", ")}.`,
);
