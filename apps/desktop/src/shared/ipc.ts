import type { Diagnostic } from "@chip-sim/board-schema";
import type { CanonicalCircuit } from "@chip-sim/circuit-core";
import type { SimulationRun } from "@chip-sim/simulation-results";
import type { SimulationAnalysis } from "@chip-sim/spice-compiler";

export type RunRequest = SimulationAnalysis;

export interface ProjectSnapshot {
  rootPath: string;
  name: string;
  source: string;
}

export interface ValidationResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  circuit?: CanonicalCircuit;
}

export interface ChipSimBridge {
  openProject(): Promise<ProjectSnapshot | null>;
  readBoard(): Promise<string>;
  saveBoard(source: string): Promise<void>;
  validateBoard(source: string): Promise<ValidationResult>;
  runSimulation(request: RunRequest): Promise<SimulationRun>;
  cancelSimulation(): Promise<void>;
  onRunUpdate(listener: (run: SimulationRun) => void): () => void;
}
