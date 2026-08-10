import type { Diagnostic } from "@chip-sim/board-schema";
import type { CanonicalCircuit } from "@chip-sim/circuit-core";
import type { SimulationRun } from "@chip-sim/simulation-results";
import type { SimulationAnalysis } from "@chip-sim/spice-compiler";
import { useCallback, useEffect, useReducer } from "react";

interface State {
  projectName?: string;
  projectPath?: string;
  source: string;
  dirty: boolean;
  validating: boolean;
  diagnostics: Diagnostic[];
  circuit?: CanonicalCircuit;
  activeRun?: SimulationRun;
  lastSuccessfulRun?: SimulationRun;
  selectedEntity?: string;
  error?: string;
}

type Action =
  | { type: "opened"; name: string; path: string; source: string }
  | { type: "source"; source: string }
  | { type: "validating" }
  | { type: "validated"; diagnostics: Diagnostic[]; circuit?: CanonicalCircuit }
  | { type: "saved" }
  | { type: "run"; run: SimulationRun }
  | { type: "selected"; id: string }
  | { type: "error"; message: string };

const initialState: State = { source: "", dirty: false, validating: false, diagnostics: [] };

function reducer(state: State, action: Action): State {
  if (action.type === "opened") return { ...initialState, projectName: action.name, projectPath: action.path, source: action.source };
  if (action.type === "source") return { ...state, source: action.source, dirty: true };
  if (action.type === "validating") return { ...state, validating: true };
  if (action.type === "validated") {
    return { ...state, validating: false, diagnostics: action.diagnostics, ...(action.circuit ? { circuit: action.circuit } : {}) };
  }
  if (action.type === "saved") return { ...state, dirty: false };
  if (action.type === "run") {
    return {
      ...state,
      activeRun: action.run,
      ...(action.run.status === "completed" ? { lastSuccessfulRun: action.run } : {})
    };
  }
  if (action.type === "selected") return { ...state, selectedEntity: action.id };
  return { ...state, error: action.message };
}

function probes(circuit?: CanonicalCircuit) {
  return (circuit?.nets ?? [])
    .filter((net) => !net.connections.some((connection) => circuit?.components.find((item) => item.id === connection.componentId)?.definition.implementation.device === "ground"))
    .map((net) => ({ id: net.name, kind: "voltage" as const, target: net.name }));
}

function makeAnalysis(kind: "operating_point" | "dc_sweep" | "transient", circuit?: CanonicalCircuit): SimulationAnalysis {
  const voltageProbes = probes(circuit);
  if (kind === "operating_point") return { id: "operating-point", type: kind, probes: voltageProbes };
  if (kind === "transient") return { id: "startup", type: kind, stepSeconds: 0.00001, stopSeconds: 0.01, probes: voltageProbes };
  const source = circuit?.components.find((component) => component.definition.implementation.device === "voltage");
  if (!source) throw new Error("A DC sweep requires a DC voltage source");
  return { id: "supply-sweep", type: kind, sourceComponentId: source.id, start: 6, stop: 12, step: 0.25, probes: voltageProbes };
}

export function useWorkstation() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => window.chipSim.onRunUpdate((run) => dispatch({ type: "run", run })), []);
  useEffect(() => {
    if (!state.projectPath) return;
    dispatch({ type: "validating" });
    const timer = window.setTimeout(() => {
      void window.chipSim
        .validateBoard(state.source)
        .then((result) => dispatch({ type: "validated", diagnostics: result.diagnostics, ...(result.circuit ? { circuit: result.circuit } : {}) }))
        .catch((error: unknown) => dispatch({ type: "error", message: error instanceof Error ? error.message : "Validation failed" }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state.projectPath, state.source]);

  const openProject = useCallback(async () => {
    const project = await window.chipSim.openProject();
    if (project) dispatch({ type: "opened", name: project.name, path: project.rootPath, source: project.source });
  }, []);

  const save = useCallback(async () => {
    await window.chipSim.saveBoard(state.source);
    dispatch({ type: "saved" });
  }, [state.source]);

  const run = useCallback(
    async (kind: "operating_point" | "dc_sweep" | "transient") => {
      if (state.dirty) await window.chipSim.saveBoard(state.source);
      dispatch({ type: "saved" });
      const result = await window.chipSim.runSimulation(makeAnalysis(kind, state.circuit));
      dispatch({ type: "run", run: result });
    },
    [state.circuit, state.dirty, state.source]
  );

  return {
    state,
    openProject,
    save,
    run,
    cancel: () => window.chipSim.cancelSimulation(),
    setSource: (source: string) => dispatch({ type: "source", source }),
    select: (id: string) => dispatch({ type: "selected", id })
  };
}
