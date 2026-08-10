# Chip Sim Workstation

A local-first Apple Silicon desktop prototype for iterating on circuit-board configurations as code. It reads a `board.yaml`, validates electrical connectivity and physical units, compiles a deterministic SPICE netlist, runs a bundled ngspice process, and presents topology, diagnostics, logs, and waveforms in one Electron workstation.

## Try it

Requirements: an Apple Silicon Mac and Node.js 22 or newer.

```sh
npm install
npm run stage:ngspice
npm test
npm run dev
```

In the app, choose **Open project** and select `examples/power-transducer`. Change the supply from `9 V` to `6 V`, then run the startup transient or supply sweep. Project data stays on the local filesystem.

To exercise the solver without the GUI:

```sh
npm run simulate:example
```

To create and verify the native Mac build:

```sh
npm run package:mac
npm run verify:package
```

The app bundle is written under `dist/mac-arm64`, with a DMG under `dist`.

## Architecture

The sandboxed renderer has no Node.js access. A typed preload bridge exposes only project open/read/save/validate and simulation run/cancel operations. The main process owns paths and performs atomic saves. The model pipeline is deliberately separated into board parsing, a solver-neutral canonical circuit, deterministic SPICE compilation, isolated ngspice execution, and solver-neutral datasets.

Foundation components currently include voltage/current sources, R/L/C passives, a diode, a voltage-controlled switch, a resistive load, and ground. User quantities use conventional SI prefixes; they are normalized before SPICE generation.

## Prototype boundaries

- This predicts lumped electrical behavior, subject to the accuracy of its component models. It is not a field, thermal, mechanical, acoustic, manufacturing-tolerance, or biological simulation.
- The included piezo model is an illustrative low-confidence electrical equivalent. It cannot establish acoustic performance, efficacy, or safety.
- Manufacturer PDF ingestion, encrypted/proprietary models, PCB-layout parasitics, tolerance sweeps, custom subcircuits, and bench calibration are future layers—not hidden approximations in this prototype.
- The bundled ngspice runtime is GPL software; see `resources/ngspice/NOTICE.md`. Review redistribution and source-offer obligations before distributing the application externally.
- The prototype is unsigned and not notarized. macOS may require local approval to open a packaged build.
