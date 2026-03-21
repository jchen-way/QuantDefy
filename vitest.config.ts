import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname)
    }
  }
});
