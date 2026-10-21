import { z } from "zod";

function isPlainBase(value: string): boolean {
  if (!URL.canParse(value)) return true;
  if (value.includes("?") || value.includes("#")) return false;
  const url = new URL(value);
  return url.username === "" && url.password === "";
}

const envSchema = z.object({
  BACKEND_URL: z
    .url({ protocol: /^https?$/ })
    .refine(isPlainBase, "must not contain a query, fragment or credentials")
    .transform((url) => url.replace(/\/+$/, "")),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(env: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }
  return result.data;
}
