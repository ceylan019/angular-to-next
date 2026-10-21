import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { seedIfEmpty } from "./db/seed.js";

const config = loadConfig(process.env);
const { db } = createDb(config.databaseUrl);
await runMigrations(db);
await seedIfEmpty(db);
const app = createApp({ db, config });

app.listen(config.port, () => {
  console.log(`backend listening on ${String(config.port)}`);
});
