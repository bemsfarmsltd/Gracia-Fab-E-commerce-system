import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Vitest's esbuild pass doesn't always pick up the automatic JSX runtime
  // that @vitejs/plugin-react provides for `vite build`/`vite dev` — set it
  // explicitly so test files don't need `import React from "react"`.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    globals: false,
    // GitHub's CI machines are slower than a laptop: the default 5s per test
    // made docs-only commits fail at random (22 Nov). Same limit we use locally.
    testTimeout: 30000,
  },
});
