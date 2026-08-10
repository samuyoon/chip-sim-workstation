import { parseBoardYaml } from "@chip-sim/board-schema";
import { buildCircuit } from "@chip-sim/circuit-core";
import { runNgspice } from "@chip-sim/solver-ngspice";
import {
  compileSpice,
  type SimulationAnalysis,
} from "@chip-sim/spice-compiler";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

const root = resolve("examples/power-transducer");
const parsed = parseBoardYaml(
  await readFile(resolve(root, "board.yaml"), "utf8"),
);
if (!parsed.ok)
  throw new Error(parsed.diagnostics.map((item) => item.message).join("\n"));
const built = buildCircuit(parsed.board);
if (!built.ok)
  throw new Error(built.diagnostics.map((item) => item.message).join("\n"));

for (const file of [
  "operating-point.yaml",
  "supply-sweep.yaml",
  "startup.yaml",
]) {
  const analysis = parse(
    await readFile(resolve(root, "simulations", file), "utf8"),
  ) as SimulationAnalysis;
  const compiled = compileSpice(built.circuit, analysis);
  const run = await runNgspice({
    compiled,
    analysisId: analysis.id,
    executablePath: resolve("resources/ngspice/darwin-arm64/ngspice"),
    timeoutMs: 30_000,
  });
  if (run.status !== "completed" || !run.dataset) {
    throw new Error(
      `${analysis.id}: ${run.failure?.message ?? run.status}\n${run.stderr ?? ""}`,
    );
  }
  const signals = run.dataset.signals
    .map(
      (signal) =>
        `${signal.id}=[${signal.minimum.toPrecision(4)}, ${signal.maximum.toPrecision(4)}] ${signal.unit}`,
    )
    .join(", ");
  console.log(`${analysis.id}: ${run.dataset.sampleCount} samples; ${signals}`);
}
