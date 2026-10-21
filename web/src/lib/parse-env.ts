import { z } from "zod";

const envSchema = z.object({
  BACKEND_URL: z
    .url({ protocol: /^https?$/ })
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
