import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "traceability/**/*.test.ts",
      "metrics/**/*.test.ts",
      "results/**/*.test.ts",
    ],
    environment: "node",
  },
});
