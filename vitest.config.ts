import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { loadEnvConfig } from "@next/env";
import { transformWithEsbuild } from "vite";

loadEnvConfig(process.cwd());

export default defineConfig({
  plugins: [
    {
      name: "compile-jsx-for-vitest",
      async transform(code, id) {
        if (id.endsWith(".tsx") || id.endsWith(".jsx")) {
          return transformWithEsbuild(code, id, {
            loader: id.endsWith(".tsx") ? "tsx" : "jsx",
            jsx: "automatic",
          });
        }
        return null;
      },
    },
    react(),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["vitest.setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/e2e/**",
      "**/stories.snapshot.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
