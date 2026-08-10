import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  main: { build: { rollupOptions: { input: "apps/desktop/src/main/index.ts" } } },
  preload: { build: { rollupOptions: { input: "apps/desktop/src/preload/index.ts" } } },
  renderer: {
    root: "apps/desktop",
    build: { rollupOptions: { input: "apps/desktop/index.html" } },
    resolve: { alias: { "@renderer": `${root}apps/desktop/src/renderer` } },
    plugins: [react()]
  }
});
