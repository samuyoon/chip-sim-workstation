# Chip Sim Workstation: Milestone One Design

Date: 2026-08-10
Status: Approved

## Purpose

Build a local-first Electron workstation for defining an electrical circuit board as code, compiling it to SPICE, running a bundled ngspice solver, and inspecting circuit topology and simulation results. The first milestone proves one complete electrical workflow before adding graphical schematic authoring, manufacturer-model discovery, datasheet ingestion, measurement calibration, or acoustic-field simulation.

The product's long-term purpose is to let engineers modify virtual hardware configurations and run reproducible simulations without constructing each configuration physically. Milestone one focuses on the foundation required by every later capability: a stable board representation, composable component models, a real solver, understandable diagnostics, and inspectable results.

## Success Criteria

The prototype succeeds when a user can:

1. Open a bundled power-and-transducer example project on an Apple Silicon Mac.
2. Read and edit the board's declarative source inside the desktop application.
3. Change a parameter such as a DC source from `9 V` to `6 V`.
4. See validation errors tied to the relevant source location.
5. View a generated, clickable diagram of components and connections.
6. Run DC operating-point, DC sweep, and transient analyses with a bundled ngspice executable.
7. Plot selected node voltages and component currents with units.
8. Inspect the generated SPICE netlist, solver log, run configuration, and component-model provenance.
9. Cancel a running simulation and distinguish cancelled, failed, and successful runs.
10. Run the example without installing ngspice, creating an account, or using a cloud service.

## Explicit Non-Goals

Milestone one will not include:

- drag-and-drop schematic authoring;
- bidirectional synchronization between a graphical schematic and source code;
- KiCad, Altium, or other EDA project import;
- automatic manufacturer-model discovery;
- PDF or datasheet ingestion;
- measurement-instrument control or calibration;
- arbitrary user-authored executable model code;
- IBIS, S-parameter, Verilog-A, firmware, or multiphysics co-simulation;
- detailed acoustic propagation or ultrasound safety analysis;
- Windows, Linux, or Intel Mac packaging;
- accounts, cloud storage, collaboration, or telemetry.

These are later subsystems, not compatibility modes inside the first implementation.

## Architecture

The application uses Electron with a TypeScript and React renderer. It separates untrusted UI content from filesystem and process access:

```text
Renderer
  editor, diagram, plots, diagnostics
        |
        | typed IPC through a narrow preload bridge
        v
Electron main process
  project files, native resources, solver lifecycle
        |
        v
Core packages
  board parser, validation, canonical model, SPICE compiler
        |
        v
Bundled Apple Silicon ngspice process
```

The renderer has no direct Node.js, filesystem, or shell access. The main process exposes explicit operations for opening a project, reading and saving project files, validating a board, starting and cancelling a simulation, and retrieving run artifacts.

ngspice runs as a child process in an isolated run directory. Project-derived values are passed through generated files and fixed process arguments, never interpolated into a shell command.

## Repository Organization

The implementation will use a TypeScript monorepo with focused packages:

```text
apps/
  desktop/                 Electron main, preload, and React renderer
packages/
  board-schema/            Project-file schema, parsing, source locations
  circuit-core/            Canonical board model and semantic validation
  component-library/       Foundation definitions and provenance
  spice-compiler/          Deterministic SPICE generation and source maps
  solver-ngspice/          Process adapter and result parsing
  simulation-results/      Solver-independent result types
examples/
  power-transducer/        Bundled working project
resources/
  ngspice/darwin-arm64/    Bundled solver and required notices
docs/
  superpowers/specs/       Approved designs
```

Package boundaries are solver-independent. The canonical board model must not contain ngspice-specific syntax. Future importers and solvers must translate through the same core types rather than introduce parallel representations.

## Project Model

A simulation project is an ordinary local directory:

```text
example-board/
  board.yaml
  models/
    piezo-40khz.model.yaml
  simulations/
    operating-point.yaml
    supply-sweep.yaml
    startup.yaml
  README.md
```

`board.yaml` is the human-authored source of truth. YAML provides readable, diffable, non-executable configuration. Physical quantities are strings containing an explicit numeric value and unit, such as `9 V`, `330 ohm`, or `100 uF`.

The parser produces a canonical board model containing:

- globally unique component instance identifiers;
- resolved component definitions;
- typed and named ports;
- physical values normalized to SI units;
- explicit electrical nets;
- model provenance and confidence metadata;
- source locations for user-authored entities.

Generated netlists and raw solver output live in application-managed run directories. They are inspectable from the application but do not modify the project unless the user explicitly exports them.

## Component Model

Every component consists of a reusable definition and one or more board instances.

A definition declares identity, category, ports, allowed parameters, implementation, provenance, and validity information. An instance declares its board-local name and permitted parameter values.

The architecture distinguishes three library tiers:

1. **Foundation primitives** are generic, parameterized simulation elements.
2. **Catalog components** represent real products whose intrinsic identity and behavior are not freely mutable.
3. **Custom components** explicitly represent user-provided or derived models and retain their provenance.

Milestone one implements the foundation tier and the format needed to load project-local custom definitions. The user interface does not yet provide a general import wizard.

The built-in foundation library contains:

- electrical ground;
- DC voltage source;
- pulse voltage source;
- DC current source;
- resistor;
- capacitor;
- inductor;
- diode;
- voltage-controlled switch;
- generic resistive load.

The example project includes an illustrative piezoelectric transducer composite built from an equivalent RLC network. It is labeled as illustrative and low-confidence, not presented as a specific commercial part.

Supported implementation kinds are:

- `spice_primitive`;
- `spice_subcircuit`;
- `composite_component`.

Arbitrary JavaScript, Python, C, or shell-backed component implementations are excluded.

## Compilation and Validation

Compilation is a deterministic pipeline:

1. Parse project YAML while retaining source locations.
2. Validate structural syntax and physical units.
3. Resolve each component definition.
4. Validate parameters, constraints, and port names.
5. Construct electrical nets from named connections.
6. Enforce required references such as electrical ground.
7. Detect invalid and disconnected connections.
8. Lower supported component implementations to SPICE.
9. Attach the selected simulation analysis and requested probes.
10. Emit a deterministic netlist and a source map.

Errors block execution. Warnings remain visible and do not necessarily block execution. Diagnostics contain a severity, stable code, human-readable message, project file, source location, and relevant component or net identifier.

The generated source map connects SPICE devices and netlist lines back to board entities. Compiler and solver errors should identify the board component whenever that mapping is available.

## Simulation Execution

Milestone one supports:

- DC operating point;
- DC parameter sweep;
- transient analysis.

Each execution creates an immutable run record with:

- a run identifier;
- a snapshot hash of the project inputs;
- selected simulation configuration;
- resolved component-model versions;
- generated netlist;
- ngspice version;
- timestamps and duration;
- compiler diagnostics;
- solver standard output and error output;
- structured result data;
- terminal status.

Run states are `queued`, `compiling`, `running`, `completed`, `failed`, and `cancelled`.

Only one run may execute per project at a time. The user can cancel it. Cancellation terminates the solver process and records a cancelled result without overwriting the most recent successful run. A configurable timeout guards against a hung process.

Failures are classified as project, compilation, solver, process, or result-parsing errors. The UI presents an actionable summary and expandable technical details. Empty charts or generic failure messages are not acceptable error states.

## Result Model

Solver output is converted to solver-independent datasets. A dataset contains:

- an independent axis such as time or sweep voltage;
- named signals;
- physical quantity and display unit for every axis and signal;
- sample count and simple statistics;
- a reference to the originating component, port, or net;
- run and model provenance.

The renderer never parses raw ngspice output. It receives validated result objects over typed IPC.

## Workstation Experience

The desktop layout uses four persistent regions:

```text
+------------------+-----------------------------+
| Project/Library  | Source editor               |
| explorer         |                             |
+------------------+-----------------------------+
| Diagnostics/Run  | Diagram or waveform results |
| details          |                             |
+------------------+-----------------------------+
```

The source editor provides YAML syntax highlighting, save state, line diagnostics, and navigation from errors. The generated diagram is read-only but clickable: selecting a component or net focuses the corresponding source and makes its available signals easy to add to a plot.

Simulation controls allow the user to choose an analysis, run, cancel, and inspect status. The results area supports multiple traces, units, zooming, cursors or hover values, and a legend. Separate inspector tabs expose diagnostics, generated netlist, solver log, and provenance.

Milestone one optimizes for a coherent engineering workstation, not visual polish or a complete CAD interaction model.

## Local-First Packaging

The first supported target is Apple Silicon macOS. The packaged application includes a compatible ngspice executable and its required runtime resources. Build-time verification records the solver checksum and version. Distributed builds include all required open-source notices and comply with ngspice licensing obligations.

The application does not require network access. Projects, preferences, and run artifacts remain local. No telemetry is collected.

If the bundled solver is missing or fails integrity validation, the application reports a process error and does not silently fall back to another executable on the machine.

## Testing Strategy

Tests are organized by boundary:

### Board schema

- valid and invalid project fixtures;
- physical-unit parsing and normalization;
- duplicate IDs, unknown component types, bad ports, and malformed connections;
- stable diagnostic codes and source locations.

### Circuit core

- deterministic net construction;
- ground-reference enforcement;
- parameter constraints;
- component and model resolution;
- provenance propagation.

### SPICE compiler

- golden netlists for foundation components and analyses;
- deterministic output independent of map iteration order;
- identifier escaping;
- source-map accuracy;
- no shell interpretation of project content.

### ngspice adapter

- solver discovery and integrity checks;
- successful operating-point, sweep, and transient runs;
- cancellation and timeout behavior;
- convergence and syntax failures;
- raw-result parsing into typed datasets.

### Desktop application

- preload IPC contract tests;
- open, edit, save, validate, and run flow;
- diagram-to-source selection;
- signal selection and plotting;
- error and cancellation presentation.

### End-to-end acceptance

The packaged application opens the bundled example, changes the supply from `9 V` to `6 V`, reruns the simulation, and displays the resulting downstream voltage change. This acceptance test runs against the bundled ngspice binary rather than a mocked solver.

## Security and Trust Boundaries

- Renderer sandboxing and context isolation remain enabled.
- The renderer has no direct filesystem, process, or native-module access.
- Project files are data, not executable code.
- Solver execution uses fixed arguments without a shell.
- Run directories use generated paths and cannot be selected by project content.
- Imported SPICE text is treated as solver input and is not executed by a shell.
- Raw logs are escaped when rendered.
- The application distinguishes built-in, catalog, and custom model provenance.

## Evolution Path

Later milestones build on this foundation in the following order:

1. SPICE model import and custom-component authoring.
2. KiCad schematic import into the canonical board model.
3. Graphical schematic editing of the same canonical representation.
4. Manufacturer-model discovery and catalog packages.
5. Datasheet-assisted candidate-model generation with evidence and confidence.
6. Measurement import, calibration, and validation reports.
7. Acoustic, thermal, electromagnetic, and other solver adapters.
8. Reduced-order and learned surrogate models for expensive subsystems.

Each addition must preserve one canonical board representation and one provenance model. No feature may add a parallel board format, bypass validation, or silently replace missing physical information with an unmarked approximation.
