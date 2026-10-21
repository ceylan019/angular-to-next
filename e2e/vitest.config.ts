import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["support/**/*.test.ts", "recording/**/*.test.ts"],
    environment: "node",
  },
});
