import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Some tests hash passwords and start in-memory databases; with every file
    // running at once (and on CI machines) 5 s isn't always enough.
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
