import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.string().regex(/^\d+$/, "PORT must be a whole number").optional(),
  TEST_MODE: z.string().optional(),
});

export type Config = {
  port: number;
  databaseUrl: string;
  testMode: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = envSchema.parse(env);
  const port = parsed.PORT === undefined ? 8080 : Number(parsed.PORT);
  if (port < 1 || port > 65535) {
    throw new Error("PORT must be between 1 and 65535");
  }
  return {
    port,
    databaseUrl: parsed.DATABASE_URL,
    testMode: parsed.TEST_MODE === "true",
  };
}
