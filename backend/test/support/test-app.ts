import { inject } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig, type Config } from "../../src/config.js";
import { createDb } from "../../src/db/client.js";

export async function createTestApp(overrides: Partial<Config> = {}) {
  const config: Config = {
    ...loadConfig({ DATABASE_URL: inject("databaseUrl") }),
    ...overrides,
  };
  const { db } = createDb(config.databaseUrl);
  const app = createApp({ db, config });
  return Promise.resolve({ app, db });
}
