import "server-only";
import { parseEnv } from "./parse-env";

export { parseEnv };
export type { Env } from "./parse-env";

export const env = parseEnv(process.env);
