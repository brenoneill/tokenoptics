import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Mirror the "@/*" path alias from tsconfig.json so tests import the same way
// app code does. Named .mts so Vite loads this config as ESM (the project has
// no "type": "module").
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    environment: "node",
  },
});
