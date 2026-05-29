import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: "./tests/e2e/setup.ts",
    include: ["tests/e2e/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
