import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["traceability/**/*.test.ts"], environment: "node" },
});
