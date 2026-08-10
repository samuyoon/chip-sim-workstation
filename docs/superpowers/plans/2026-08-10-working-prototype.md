# Chip Sim Workstation Working Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a packaged, local-first Apple Silicon Electron prototype that edits a YAML circuit, validates and compiles it to SPICE, runs bundled ngspice analyses, visualizes topology, and plots results.

**Architecture:** A sandboxed Electron renderer communicates through a typed preload bridge with the main process. Focused TypeScript workspace packages parse the project, construct a solver-independent canonical circuit, compile it to deterministic SPICE, execute ngspice in an isolated directory, and return typed datasets to the renderer.

**Tech Stack:** Electron 43, electron-vite 5, React 19, TypeScript 7, Zod 4, YAML 2, Vitest 4, Monaco React, XYFlow React, uPlot, npm workspaces, ngspice.

---

## File Map

```text
package.json                         workspace scripts and pinned dependencies
tsconfig.base.json                   shared strict TypeScript settings
vitest.config.ts                     workspace test discovery
electron.vite.config.ts              main/preload/renderer builds
electron-builder.yml                 macOS arm64 packaging and resources
apps/desktop/src/main/index.ts        secure BrowserWindow and project service
apps/desktop/src/main/project.ts      project open/save/run orchestration
apps/desktop/src/preload/index.ts     typed renderer bridge
apps/desktop/src/shared/ipc.ts        IPC request and response types
apps/desktop/src/renderer/*           workstation React interface
packages/board-schema/src/*           YAML parsing, units, source diagnostics
packages/component-library/src/*      foundation component definitions
packages/circuit-core/src/*           canonical board and semantic validation
packages/spice-compiler/src/*         deterministic netlist generation
packages/simulation-results/src/*     solver-independent datasets and run states
packages/solver-ngspice/src/*          isolated process execution and raw parsing
examples/power-transducer/*           runnable circuit and three analyses
resources/ngspice/darwin-arm64/*       solver executable, manifest, notices
scripts/stage-ngspice.mjs             copy and verify local ngspice dependency
tests/e2e/prototype.spec.ts            packaged vertical-slice acceptance
```

### Task 1: Scaffold the typed Electron workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `electron.vite.config.ts`
- Create: `electron-builder.yml`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/main.tsx`
- Create: `apps/desktop/src/renderer/App.tsx`
- Test: `apps/desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write the failing renderer smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the workstation title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Chip Sim Workstation" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Create the pinned workspace manifest and build configuration**

Use npm workspaces for `apps/*` and `packages/*`. Add scripts `dev`, `build`, `test`, `typecheck`, `package:mac`, and `stage:ngspice`. Configure electron-vite entries for main, preload, and renderer. Configure electron-builder for `mac`/`arm64`, hardened runtime, and `resources/ngspice` as an extra resource.

- [ ] **Step 3: Add the minimal sandboxed Electron shell**

```ts
const window = new BrowserWindow({
  width: 1440,
  height: 960,
  minWidth: 1100,
  minHeight: 720,
  webPreferences: {
    preload: join(__dirname, "../preload/index.js"),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
  },
});
```

Render an `App` whose only content is `<h1>Chip Sim Workstation</h1>`.

- [ ] **Step 4: Install dependencies and run the smoke test**

Run: `npm install && npm test -- apps/desktop/src/renderer/App.test.tsx`

Expected: one passing test.

- [ ] **Step 5: Verify typecheck and production build**

Run: `npm run typecheck && npm run build`

Expected: both commands exit 0 and `out/` contains main, preload, and renderer assets.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts electron.vite.config.ts electron-builder.yml apps
git commit -m "build: scaffold Electron workstation"
```

### Task 2: Parse board YAML and physical units

**Files:**
- Create: `packages/board-schema/src/types.ts`
- Create: `packages/board-schema/src/units.ts`
- Create: `packages/board-schema/src/parse-board.ts`
- Create: `packages/board-schema/src/index.ts`
- Test: `packages/board-schema/src/units.test.ts`
- Test: `packages/board-schema/src/parse-board.test.ts`

- [ ] **Step 1: Write failing unit parser tests**

```ts
expect(parseQuantity("9 V", "voltage")).toEqual({ siValue: 9, unit: "V" });
expect(parseQuantity("100 uF", "capacitance")).toEqual({ siValue: 0.0001, unit: "F" });
expect(() => parseQuantity("9 amps", "voltage")).toThrow("expected voltage");
```

- [ ] **Step 2: Run tests and confirm the missing implementation failure**

Run: `npm test -- packages/board-schema/src/units.test.ts`

Expected: FAIL because `parseQuantity` does not exist.

- [ ] **Step 3: Implement strict quantity parsing**

Support `V`, `A`, `ohm`, `F`, `H`, `s`, and SI prefixes `p`, `n`, `u`, `m`, `k`, and `M`. Return normalized SI values and reject nonfinite, negative-when-disallowed, unknown-unit, and quantity-mismatch inputs. Do not accept SPICE's ambiguous `M` convention in user source.

- [ ] **Step 4: Write failing board parser tests**

```ts
const result = parseBoardYaml(`
version: 1
name: Demo
components:
  supply:
    type: foundation.dc_voltage_source
    parameters: { voltage: 9 V }
connections:
  - [supply.positive, rail]
  - [supply.negative, ground]
`);
expect(result.ok).toBe(true);
expect(result.board?.components.supply.type).toBe("foundation.dc_voltage_source");
```

Also test duplicate YAML keys, malformed endpoints, missing version/name, and source locations for a bad component parameter.

- [ ] **Step 5: Implement Zod-backed YAML parsing with diagnostics**

Return `{ ok, board?, diagnostics }`; never throw for user-authored YAML. Each diagnostic includes `code`, `severity`, `message`, and best-effort `{ line, column }`.

- [ ] **Step 6: Run package tests and typecheck**

Run: `npm test -- packages/board-schema && npm run typecheck`

Expected: all board-schema tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/board-schema
git commit -m "feat: parse board YAML and physical units"
```

### Task 3: Resolve foundation components into a canonical circuit

**Files:**
- Create: `packages/component-library/src/types.ts`
- Create: `packages/component-library/src/foundation.ts`
- Create: `packages/component-library/src/index.ts`
- Create: `packages/circuit-core/src/types.ts`
- Create: `packages/circuit-core/src/build-circuit.ts`
- Create: `packages/circuit-core/src/index.ts`
- Test: `packages/circuit-core/src/build-circuit.test.ts`

- [ ] **Step 1: Write failing semantic-validation tests**

Test a valid source/resistor circuit and assert normalized voltage and resistance. Test unknown component type, unknown port, unknown component reference, duplicate connection, missing ground, and unconnected required ports. Expect stable codes such as `UNKNOWN_COMPONENT_TYPE`, `UNKNOWN_PORT`, and `MISSING_GROUND`.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- packages/circuit-core/src/build-circuit.test.ts`

Expected: FAIL because `buildCircuit` and the library do not exist.

- [ ] **Step 3: Define the component contract and foundation library**

```ts
export interface ComponentDefinition {
  id: string;
  name: string;
  category: "source" | "passive" | "semiconductor" | "reference" | "load";
  ports: Record<string, { domain: "electrical"; required: boolean }>;
  parameters: Record<string, ParameterDefinition>;
  implementation: SpicePrimitiveImplementation | SpiceSubcircuitImplementation | CompositeImplementation;
  provenance: { tier: "foundation" | "catalog" | "custom"; confidence: "high" | "medium" | "low"; source: string };
}
```

Implement ground, DC/pulse voltage, DC current, resistor, capacitor, inductor, diode, voltage-controlled switch, and resistive load definitions.

- [ ] **Step 4: Implement canonical circuit construction**

Resolve definitions, validate instance parameters, normalize units, create deterministic net IDs from connection aliases, retain source/provenance references, and return diagnostics without partial executable output when errors exist.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- packages/circuit-core packages/component-library && npm run typecheck`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/component-library packages/circuit-core
git commit -m "feat: build canonical circuits from component definitions"
```

### Task 4: Compile deterministic SPICE netlists

**Files:**
- Create: `packages/spice-compiler/src/types.ts`
- Create: `packages/spice-compiler/src/identifiers.ts`
- Create: `packages/spice-compiler/src/compile.ts`
- Create: `packages/spice-compiler/src/index.ts`
- Test: `packages/spice-compiler/src/compile.test.ts`
- Test: `packages/spice-compiler/src/__snapshots__/compile.test.ts.snap`

- [ ] **Step 1: Write failing golden-netlist tests**

Build the same canonical circuit with components inserted in different object orders and assert identical generated netlists. Snapshot operating-point, DC-sweep, and transient analyses. Assert the source map connects each generated device line to the correct component ID.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- packages/spice-compiler/src/compile.test.ts`

Expected: FAIL because `compileSpice` is missing.

- [ ] **Step 3: Implement safe identifiers and primitive lowering**

Use stable sorted component IDs and generated SPICE names. Map ground to node `0`; generate internal node names for aliases; reject identifiers that cannot be represented safely instead of passing them to ngspice unchecked.

- [ ] **Step 4: Implement analysis and probe generation**

Generate `.op`, `.dc`, or `.tran` directives and explicit `wrdata` output instructions. Include current probes through source device names and voltage probes through canonical net names. End every netlist with `.end`.

- [ ] **Step 5: Run tests and inspect snapshots**

Run: `npm test -- packages/spice-compiler`

Expected: all compiler tests and snapshots pass.

- [ ] **Step 6: Commit**

```bash
git add packages/spice-compiler
git commit -m "feat: compile canonical circuits to deterministic SPICE"
```

### Task 5: Execute ngspice and parse typed results

**Files:**
- Create: `packages/simulation-results/src/types.ts`
- Create: `packages/simulation-results/src/index.ts`
- Create: `packages/solver-ngspice/src/paths.ts`
- Create: `packages/solver-ngspice/src/parse-wrdata.ts`
- Create: `packages/solver-ngspice/src/run-ngspice.ts`
- Create: `packages/solver-ngspice/src/index.ts`
- Create: `scripts/stage-ngspice.mjs`
- Create: `resources/ngspice/NOTICE.md`
- Test: `packages/solver-ngspice/src/parse-wrdata.test.ts`
- Test: `packages/solver-ngspice/src/run-ngspice.integration.test.ts`

- [ ] **Step 1: Write failing result-parser tests**

Use a fixture containing ngspice `wrdata` columns and assert axis name/unit, signal arrays, sample count, min, and max. Test malformed rows, nonfinite values, and unequal column lengths as `RESULT_PARSE_ERROR`.

- [ ] **Step 2: Implement the parser and shared run model**

Define immutable run records with `queued`, `compiling`, `running`, `completed`, `failed`, and `cancelled` states. Parse only expected generated output files; preserve raw stdout/stderr separately.

- [ ] **Step 3: Stage ngspice for Apple Silicon**

Install ngspice with Homebrew if unavailable. `scripts/stage-ngspice.mjs` must locate the arm64 executable, copy it and required non-system dynamic libraries into `resources/ngspice/darwin-arm64`, write a SHA-256 manifest, and fail on a non-arm64 binary. Record `ngspice --version` and licensing/source information in `NOTICE.md`.

- [ ] **Step 4: Write a failing real-solver integration test**

Compile and run a voltage-divider transient, assert exit status `completed`, and verify the midpoint is approximately half the source voltage. Skip only when `CHIP_SIM_SKIP_NGSPICE=1` is explicitly set.

- [ ] **Step 5: Implement isolated execution, cancellation, and timeout**

Use `mkdtemp`, direct `spawn(executable, fixedArgs, { shell: false })`, an `AbortSignal`, and a timer. Validate the bundled solver checksum before execution. Return classified `PROCESS_ERROR`, `SOLVER_ERROR`, or `RESULT_PARSE_ERROR` failures.

- [ ] **Step 6: Run unit and integration tests**

Run: `npm run stage:ngspice && npm test -- packages/solver-ngspice`

Expected: parser tests pass and the real voltage-divider result is within tolerance.

- [ ] **Step 7: Commit**

```bash
git add packages/simulation-results packages/solver-ngspice scripts resources/ngspice
git commit -m "feat: execute bundled ngspice and parse results"
```

### Task 6: Add secure project and simulation IPC

**Files:**
- Create: `apps/desktop/src/shared/ipc.ts`
- Create: `apps/desktop/src/main/project.ts`
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/global.d.ts`
- Test: `apps/desktop/src/main/project.test.ts`

- [ ] **Step 1: Write failing project-service tests**

Use a temporary project to test open, read, save, validate, run, and cancel. Assert path traversal outside the opened project is rejected and a failed run does not replace `lastSuccessfulRun`.

- [ ] **Step 2: Implement `ProjectService`**

`ProjectService` owns one open project, validates paths through `realpath`, saves with atomic temporary-file replacement, parses/compiles before execution, emits run-state updates, and retains the last successful result in memory.

- [ ] **Step 3: Define and expose a narrow typed bridge**

```ts
contextBridge.exposeInMainWorld("chipSim", {
  openProject: () => ipcRenderer.invoke("project:open"),
  readBoard: () => ipcRenderer.invoke("project:read-board"),
  saveBoard: (source: string) => ipcRenderer.invoke("project:save-board", source),
  validateBoard: (source: string) => ipcRenderer.invoke("project:validate-board", source),
  runSimulation: (request: RunRequest) => ipcRenderer.invoke("simulation:run", request),
  cancelSimulation: () => ipcRenderer.invoke("simulation:cancel"),
  onRunUpdate: (listener: (run: SimulationRun) => void) => subscribe("simulation:update", listener),
});
```

Return an unsubscribe function from every event subscription. Validate renderer inputs in the main process even when TypeScript types appear correct.

- [ ] **Step 4: Run service tests and typecheck**

Run: `npm test -- apps/desktop/src/main/project.test.ts && npm run typecheck`

Expected: all tests pass and the bridge types compile in main, preload, and renderer contexts.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main apps/desktop/src/preload apps/desktop/src/shared apps/desktop/src/renderer/global.d.ts
git commit -m "feat: add secure project and simulation bridge"
```

### Task 7: Build the workstation interface

**Files:**
- Modify: `apps/desktop/src/renderer/App.tsx`
- Create: `apps/desktop/src/renderer/app.css`
- Create: `apps/desktop/src/renderer/state/use-workstation.ts`
- Create: `apps/desktop/src/renderer/components/ProjectExplorer.tsx`
- Create: `apps/desktop/src/renderer/components/BoardEditor.tsx`
- Create: `apps/desktop/src/renderer/components/CircuitDiagram.tsx`
- Create: `apps/desktop/src/renderer/components/SimulationToolbar.tsx`
- Create: `apps/desktop/src/renderer/components/WaveformPlot.tsx`
- Create: `apps/desktop/src/renderer/components/Inspector.tsx`
- Test: `apps/desktop/src/renderer/App.test.tsx`
- Test: `apps/desktop/src/renderer/state/use-workstation.test.tsx`

- [ ] **Step 1: Write failing workstation interaction tests**

Mock `window.chipSim`. Test opening a project, editing `9 V` to `6 V`, validation diagnostics, save-before-run, run-state display, cancellation, selecting a diagram node, adding a signal, and retaining a successful plot after a later failed run.

- [ ] **Step 2: Implement the application state hook**

Keep project source, dirty state, diagnostics, canonical diagram data, available simulations, active run, last successful run, selected entity, and visible signals in one reducer-backed hook. Debounce validation but save and run explicitly.

- [ ] **Step 3: Implement the four-region interface**

Use Monaco for YAML, XYFlow for a read-only fit-to-view topology, and uPlot for waveform rendering. Diagram selection navigates to the component source location. The inspector exposes Diagnostics, Netlist, Solver Log, and Provenance tabs.

- [ ] **Step 4: Add accessible states and actionable failures**

All controls have names and keyboard focus. Running disables Run and enables Cancel. Empty results explain how to run a simulation. Failure panels show classification, summary, source link when available, and expandable raw details.

- [ ] **Step 5: Run renderer tests**

Run: `npm test -- apps/desktop/src/renderer`

Expected: all renderer smoke and interaction tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "feat: build circuit simulation workstation UI"
```

### Task 8: Add the runnable power-transducer example

**Files:**
- Create: `examples/power-transducer/board.yaml`
- Create: `examples/power-transducer/models/piezo-40khz.model.yaml`
- Create: `examples/power-transducer/simulations/operating-point.yaml`
- Create: `examples/power-transducer/simulations/supply-sweep.yaml`
- Create: `examples/power-transducer/simulations/startup.yaml`
- Create: `examples/power-transducer/README.md`
- Test: `examples/power-transducer/example.test.ts`

- [ ] **Step 1: Write a failing example acceptance test**

Load the example through the public parser/compiler APIs. Assert no errors, expected components/nets, all three analyses compile, and the transducer provenance is `low` confidence with an illustrative-source label.

- [ ] **Step 2: Create the example circuit**

Model a DC supply, source resistance, reservoir capacitor, indicator branch, pulsed switch, load resistance, and illustrative piezo RLC branch. Probe supply input, power rail, driver output, and supply current.

- [ ] **Step 3: Add analyses and documentation**

Operating point reports DC rails; supply sweep varies 6–12 V; startup transient runs long enough to show capacitor charging and pulse activity. README explains that the piezo is an electrical equivalent only and does not predict acoustic safety or efficacy.

- [ ] **Step 4: Run example tests and a real simulation**

Run: `npm test -- examples/power-transducer && npm run simulate:example`

Expected: tests pass and the CLI summary lists nonempty datasets for all configured probes.

- [ ] **Step 5: Commit**

```bash
git add examples package.json
git commit -m "feat: add power and transducer example project"
```

### Task 9: Package and verify the complete prototype

**Files:**
- Create: `tests/e2e/prototype.spec.ts`
- Create: `scripts/verify-package.mjs`
- Create: `README.md`
- Modify: `electron-builder.yml`
- Modify: `package.json`

- [ ] **Step 1: Write the failing end-to-end acceptance test**

Launch the packaged application with the example project path. Replace `9 V` with `6 V`, run the startup analysis, wait for completion, and assert that the plotted power-rail result changes and run details identify the bundled ngspice version.

- [ ] **Step 2: Add package verification**

`verify-package.mjs` checks that the `.app` exists, targets arm64, contains ngspice and its manifest/notices, launches without a network connection, and can execute the headless example smoke run through the packaged main-process resources.

- [ ] **Step 3: Write user documentation**

Document prerequisites for development, `npm install`, `npm run stage:ngspice`, `npm run dev`, tests, packaging, example operation, architecture boundaries, known prototype limitations, and the model-confidence warning.

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run package:mac
npm run verify:package
```

Expected: every command exits 0; unit/integration/e2e tests pass; a verified arm64 `.app` is produced under `dist/`.

- [ ] **Step 5: Perform a clean-tree audit**

Run: `git status --short && git diff --check`

Expected: only intentional plan-checkbox or documentation changes remain; no generated build output is tracked.

- [ ] **Step 6: Commit**

```bash
git add README.md package.json package-lock.json electron-builder.yml scripts/verify-package.mjs tests/e2e
git commit -m "test: verify packaged chip simulation prototype"
```

## Plan Self-Review

- Every milestone-one success criterion maps to Tasks 2–9.
- Every explicit non-goal remains absent from implementation tasks.
- Board input, canonical circuit, SPICE compilation, solver output, and renderer result types each have one owner.
- Integration tests use the real bundled solver; unit tests isolate parsing and UI state.
- The final acceptance specifically exercises the `9 V` to `6 V` virtual configuration change.
