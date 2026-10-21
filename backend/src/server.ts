import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";

const config = loadConfig(process.env);
const { db } = createDb(config.databaseUrl);
const app = createApp({ db, config });

app.listen(config.port, () => {
  console.log(`backend listening on ${String(config.port)}`);
});
