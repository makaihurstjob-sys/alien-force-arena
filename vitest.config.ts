import { defineConfig } from "vitest/config";

// Rules tests run without loading the web app's SSR/deployment plugins.
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
