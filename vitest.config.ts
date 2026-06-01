import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Booking-conflict and availability tests hit a real Postgres, so run
    // serially in the node environment with env loaded from .env.
    environment: "node",
    setupFiles: ["dotenv/config"],
    fileParallelism: false,
  },
});
