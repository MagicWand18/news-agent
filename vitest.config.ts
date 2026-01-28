import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/src/__tests__/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@mediabot/shared": path.resolve(__dirname, "packages/shared/src"),
      "@": path.resolve(__dirname, "packages/web/src"),
    },
  },
});
