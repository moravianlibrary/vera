import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        cn: fileURLToPath(new URL("./src/lib/utils.ts", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8080",
          changeOrigin: true,
          // Development only: names this dev server's fixture person to the engine, which
          // honours it only in development (docs/develop/engine.md, Dev servers and signing in).
          headers:
            env.VITE_API_MODE === "live" && env.VITE_MOCK_USER
              ? { "X-Vera-Dev-Person": env.VITE_MOCK_USER }
              : {},
        },
      },
    },
  };
});
