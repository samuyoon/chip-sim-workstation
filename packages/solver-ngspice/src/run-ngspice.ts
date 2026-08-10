import type { SimulationRun } from "@chip-sim/simulation-results";
import type { CompiledSpice } from "@chip-sim/spice-compiler";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseWrdata } from "./parse-wrdata";

export interface RunNgspiceOptions {
  compiled: CompiledSpice;
  analysisId: string;
  executablePath: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export async function runNgspice(options: RunNgspiceOptions): Promise<SimulationRun> {
  const startedAt = new Date().toISOString();
  const base: SimulationRun = {
    id: randomUUID(),
    analysisId: options.analysisId,
    status: "running",
    startedAt,
    netlist: options.compiled.netlist
  };
  const workingDirectory = await mkdtemp(join(tmpdir(), "chip-sim-"));
  const netlistPath = join(workingDirectory, "circuit.cir");

  try {
    await writeFile(netlistPath, options.compiled.netlist);
    const processResult = await execute(
      options.executablePath,
      ["-b", "circuit.cir"],
      workingDirectory,
      options.timeoutMs,
      options.signal
    );
    const completedAt = new Date().toISOString();
    const diagnostics = { stdout: processResult.stdout, stderr: processResult.stderr };

    if (processResult.cancelled) {
      return { ...base, ...diagnostics, status: "cancelled", completedAt };
    }
    if (processResult.timedOut) {
      return {
        ...base,
        ...diagnostics,
        status: "failed",
        completedAt,
        failure: { classification: "PROCESS_ERROR", message: `ngspice exceeded ${options.timeoutMs} ms` }
      };
    }
    if (processResult.error) {
      return {
        ...base,
        ...diagnostics,
        status: "failed",
        completedAt,
        failure: { classification: "PROCESS_ERROR", message: processResult.error.message }
      };
    }
    if (processResult.exitCode !== 0) {
      return {
        ...base,
        ...diagnostics,
        status: "failed",
        completedAt,
        failure: {
          classification: "SOLVER_ERROR",
          message: `ngspice exited with code ${processResult.exitCode}`,
          details: processResult.stderr || processResult.stdout
        }
      };
    }

    try {
      const source = await readFile(join(workingDirectory, options.compiled.outputFile), "utf8");
      const dataset = parseWrdata(source, options.compiled.vectors);
      return {
        ...base,
        ...diagnostics,
        status: "completed",
        completedAt,
        ...(processResult.stdout.match(/ngspice-\d+/i)?.[0]
          ? { solverVersion: processResult.stdout.match(/ngspice-\d+/i)![0] }
          : {}),
        dataset
      };
    } catch (error) {
      return {
        ...base,
        ...diagnostics,
        status: "failed",
        completedAt,
        failure: {
          classification: "RESULT_PARSE_ERROR",
          message: error instanceof Error ? error.message : "Could not parse ngspice results"
        }
      };
    }
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  error?: Error;
}

function execute(
  executable: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let cancelled = signal?.aborted ?? false;
    let processError: Error | undefined;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => (processError = error));

    const terminate = () => child.kill("SIGTERM");
    const onAbort = () => {
      cancelled = true;
      terminate();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    if (cancelled) terminate();

    const timeout = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMs);

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
        cancelled,
        ...(processError ? { error: processError } : {})
      });
    });
  });
}
