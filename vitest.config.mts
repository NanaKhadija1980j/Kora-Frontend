import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { config as loadDotenv } from "dotenv";
import { transformWithEsbuild } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Load .env.local then .env so test env vars are available.
loadDotenv({ path: ".env.local", override: false });
loadDotenv({ path: ".env", override: false });

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
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "coverage/**",
        "dist/**",
        "packages/*/test/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mock/**",
        "**/test/**",
        "**/tests/**",
        "**/__tests__/**",
        "**/*.stories.tsx",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "vitest.setup.ts",
        "vitest.config.mts",
        "eslint.config.js",
        "next.config.js",
        "postcss.config.js",
        "tailwind.config.ts",
        ".eslintrc.json",
        ".prettierrc",
        "middleware.ts",
      ],
      thresholds: {
        lines: 50,
        branches: 40,
        functions: 45,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
