import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const aliases = {
  "@chip-sim/board-schema": `${root}packages/board-schema/src/index.ts`,
  "@chip-sim/circuit-core": `${root}packages/circuit-core/src/index.ts`,
  "@chip-sim/component-library": `${root}packages/component-library/src/index.ts`,
  "@chip-sim/spice-compiler": `${root}packages/spice-compiler/src/index.ts`,
  "@chip-sim/simulation-results": `${root}packages/simulation-results/src/index.ts`,
  "@chip-sim/solver-ngspice": `${root}packages/solver-ngspice/src/index.ts`
};

export default defineConfig({
  main: {
    resolve: { alias: aliases },
    build: { rollupOptions: { input: "apps/desktop/src/main/index.ts" } }
  },
  preload: {
    resolve: { alias: aliases },
    build: { rollupOptions: { input: "apps/desktop/src/preload/index.ts" } }
  },
  renderer: {
    root: "apps/desktop",
    build: { rollupOptions: { input: "apps/desktop/index.html" } },
    resolve: { alias: { ...aliases, "@renderer": `${root}apps/desktop/src/renderer` } },
    plugins: [react()]
  }
});
