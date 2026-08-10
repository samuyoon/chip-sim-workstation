export type RunStatus =
  | "queued"
  | "compiling"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ResultAxis {
  id: string;
  label: string;
  unit: string;
  values: number[];
}

export interface ResultSignal {
  id: string;
  expression: string;
  unit: string;
  values: number[];
  minimum: number;
  maximum: number;
}

export interface SimulationDataset {
  axis: ResultAxis;
  signals: ResultSignal[];
  sampleCount: number;
}

export interface SimulationFailure {
  classification:
    | "PROJECT_ERROR"
    | "COMPILATION_ERROR"
    | "SOLVER_ERROR"
    | "PROCESS_ERROR"
    | "RESULT_PARSE_ERROR";
  message: string;
  details?: string;
}

export interface SimulationRun {
  id: string;
  analysisId: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  dataset?: SimulationDataset;
  netlist?: string;
  stdout?: string;
  stderr?: string;
  solverVersion?: string;
  failure?: SimulationFailure;
}
