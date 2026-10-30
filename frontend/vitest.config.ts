import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const configuredWorkers = process.env.VERA_TEST_WORKERS;
const testWorkers =
  configuredWorkers && /^[1-9]\d*$/.test(configuredWorkers) ? Number(configuredWorkers) : 4;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // Several test runs share one machine; raise it with VERA_TEST_WORKERS.
    maxWorkers: testWorkers,
    minWorkers: testWorkers,
  },
});
