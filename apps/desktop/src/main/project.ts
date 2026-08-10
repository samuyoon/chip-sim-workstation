import { parseBoardYaml } from "@chip-sim/board-schema";
import { buildCircuit } from "@chip-sim/circuit-core";
import type { SimulationRun } from "@chip-sim/simulation-results";
import { runNgspice, type RunNgspiceOptions } from "@chip-sim/solver-ngspice";
import { compileSpice, type SimulationAnalysis } from "@chip-sim/spice-compiler";
import { randomUUID } from "node:crypto";
import { readFile, realpath, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import type { ProjectSnapshot, ValidationResult } from "../shared/ipc";

type Runner = (options: RunNgspiceOptions) => Promise<SimulationRun>;

export interface ProjectServiceOptions {
  executablePath: string;
  runner?: Runner;
  onRunUpdate?: (run: SimulationRun) => void;
}

export class ProjectService {
  readonly #executablePath: string;
  readonly #runner: Runner;
  readonly #onRunUpdate: ((run: SimulationRun) => void) | undefined;
  #projectRoot: string | undefined;
  #activeController: AbortController | undefined;
  lastSuccessfulRun?: SimulationRun;

  constructor(options: ProjectServiceOptions) {
    this.#executablePath = options.executablePath;
    this.#runner = options.runner ?? runNgspice;
    this.#onRunUpdate = options.onRunUpdate;
  }

  async openProject(path: string): Promise<ProjectSnapshot> {
    const root = await realpath(path);
    const boardPath = await realpath(join(root, "board.yaml"));
    this.#assertInside(root, boardPath);
    this.#projectRoot = root;
    const source = await readFile(boardPath, "utf8");
    const validation = await this.validateBoard(source);
    return { rootPath: root, name: validation.circuit?.name ?? basename(root), source };
  }

  async readBoard(): Promise<string> {
    return this.readProjectFile("board.yaml");
  }

  async readProjectFile(relativePath: string): Promise<string> {
    const root = this.#requireRoot();
    const candidate = resolve(root, relativePath);
    this.#assertInside(root, candidate);
    const resolved = await realpath(candidate);
    this.#assertInside(root, resolved);
    return readFile(resolved, "utf8");
  }

  async saveBoard(source: string): Promise<void> {
    const root = this.#requireRoot();
    const destination = join(root, "board.yaml");
    const temporary = join(dirname(destination), `.board.${randomUUID()}.tmp`);
    await writeFile(temporary, source, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, destination);
  }

  async validateBoard(source: string): Promise<ValidationResult> {
    const parsed = parseBoardYaml(source);
    if (!parsed.ok) return { ok: false, diagnostics: parsed.diagnostics };
    const built = buildCircuit(parsed.board);
    if (!built.ok) return { ok: false, diagnostics: [...parsed.diagnostics, ...built.diagnostics] };
    return { ok: true, diagnostics: [...parsed.diagnostics, ...built.diagnostics], circuit: built.circuit };
  }

  async runSimulation(analysis: SimulationAnalysis): Promise<SimulationRun> {
    if (this.#activeController) throw new Error("A simulation is already running");
    const controller = new AbortController();
    this.#activeController = controller;
    const validation = await this.validateBoard(await this.readBoard());
    if (!validation.ok || !validation.circuit) {
      const failed: SimulationRun = {
        id: randomUUID(),
        analysisId: analysis.id,
        status: "failed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        failure: {
          classification: "PROJECT_ERROR",
          message: "The board contains errors",
          details: validation.diagnostics.map((diagnostic) => diagnostic.message).join("\n")
        }
      };
      this.#onRunUpdate?.(failed);
      this.#activeController = undefined;
      return failed;
    }

    let compiled;
    try {
      compiled = compileSpice(validation.circuit, analysis);
    } catch (error) {
      const failed: SimulationRun = {
        id: randomUUID(),
        analysisId: analysis.id,
        status: "failed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        failure: {
          classification: "COMPILATION_ERROR",
          message: error instanceof Error ? error.message : "SPICE compilation failed"
        }
      };
      this.#onRunUpdate?.(failed);
      this.#activeController = undefined;
      return failed;
    }

    if (controller.signal.aborted) {
      const cancelled: SimulationRun = {
        id: randomUUID(),
        analysisId: analysis.id,
        status: "cancelled",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        netlist: compiled.netlist
      };
      this.#activeController = undefined;
      this.#onRunUpdate?.(cancelled);
      return cancelled;
    }
    const running: SimulationRun = {
      id: randomUUID(),
      analysisId: analysis.id,
      status: "running",
      startedAt: new Date().toISOString(),
      netlist: compiled.netlist
    };
    this.#onRunUpdate?.(running);
    try {
      const result = await this.#runner({
        compiled,
        analysisId: analysis.id,
        executablePath: this.#executablePath,
        timeoutMs: 30_000,
        signal: controller.signal
      });
      if (result.status === "completed") this.lastSuccessfulRun = result;
      this.#onRunUpdate?.(result);
      return result;
    } finally {
      this.#activeController = undefined;
    }
  }

  cancelSimulation(): void {
    this.#activeController?.abort();
  }

  #requireRoot(): string {
    if (!this.#projectRoot) throw new Error("No project is open");
    return this.#projectRoot;
  }

  #assertInside(root: string, candidate: string): void {
    const pathFromRoot = relative(root, candidate);
    if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot.startsWith(sep)) {
      throw new Error("Path is outside the project");
    }
  }
}
