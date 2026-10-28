import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
  root,
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      { find: "@/lib/multiplayer", replacement: root + "scripts/qa/multiplayer.ts" },
      { find: "@", replacement: root + "src" },
    ],
  },
  server: { host: "127.0.0.1" },
});
