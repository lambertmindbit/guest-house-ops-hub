import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Booking-conflict and availability tests hit a real Postgres, so run
    // serially in the node environment with env loaded from .env. tests/setup.ts
    // then guards against running against the production database by accident.
    environment: "node",
    setupFiles: ["dotenv/config", "./tests/setup.ts"],
    fileParallelism: false,
  },
});
