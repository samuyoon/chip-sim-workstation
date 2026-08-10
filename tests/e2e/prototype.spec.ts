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
import { describe, expect, it } from "vitest";

const root = resolve("examples/power-transducer");

async function simulate(source: string) {
  const parsedBoard = parseBoardYaml(source);
  if (!parsedBoard.ok) throw new Error("board parse failed");
  const built = buildCircuit(parsedBoard.board);
  if (!built.ok) throw new Error("circuit build failed");
  const analysis = parse(
    await readFile(resolve(root, "simulations/startup.yaml"), "utf8"),
  ) as SimulationAnalysis;
  return runNgspice({
    compiled: compileSpice(built.circuit, analysis),
    analysisId: analysis.id,
    executablePath: resolve("resources/ngspice/darwin-arm64/ngspice"),
    timeoutMs: 30_000,
  });
}

describe("prototype vertical slice", () => {
  it("propagates a virtual 9 V to 6 V supply change through the simulated board", async () => {
    const source9v = await readFile(resolve(root, "board.yaml"), "utf8");
    const source6v = source9v.replace("voltage: 9 V", "voltage: 6 V");
    const [run9v, run6v] = await Promise.all([
      simulate(source9v),
      simulate(source6v),
    ]);
    expect(run9v.status).toBe("completed");
    expect(run6v.status).toBe("completed");
    const rail9v = run9v.dataset?.signals.find(
      (signal) => signal.id === "power_rail",
    );
    const rail6v = run6v.dataset?.signals.find(
      (signal) => signal.id === "power_rail",
    );
    expect(rail9v?.maximum).toBeGreaterThan((rail6v?.maximum ?? 0) + 2.5);
    expect(rail6v?.maximum).toBeCloseTo(5.99, 1);
  });
});
