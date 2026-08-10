import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@chip-sim/board-schema": `${root}packages/board-schema/src/index.ts`,
      "@chip-sim/circuit-core": `${root}packages/circuit-core/src/index.ts`,
      "@chip-sim/component-library": `${root}packages/component-library/src/index.ts`,
      "@chip-sim/spice-compiler": `${root}packages/spice-compiler/src/index.ts`,
      "@chip-sim/simulation-results": `${root}packages/simulation-results/src/index.ts`,
      "@chip-sim/solver-ngspice": `${root}packages/solver-ngspice/src/index.ts`,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: [".worktrees/**", "dist/**", "out/**", "node_modules/**"],
  },
});
