import { parseBoardYaml } from "@chip-sim/board-schema";
import { buildCircuit } from "@chip-sim/circuit-core";
import { compileSpice, type SimulationAnalysis } from "@chip-sim/spice-compiler";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const root = resolve("examples/power-transducer");

describe("power-transducer example", () => {
  it("builds its board and compiles all documented analyses", async () => {
    const parsed = parseBoardYaml(await readFile(resolve(root, "board.yaml"), "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const built = buildCircuit(parsed.board);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.circuit.components.length).toBeGreaterThan(8);
    expect(built.circuit.nets.map((net) => net.name)).toContain("driver_output");

    for (const file of ["operating-point.yaml", "supply-sweep.yaml", "startup.yaml"]) {
      const analysis = parse(await readFile(resolve(root, "simulations", file), "utf8")) as SimulationAnalysis;
      expect(compileSpice(built.circuit, analysis).netlist).toContain("wrdata results.dat");
    }
  });

  it("labels the illustrative piezo equivalent as low confidence", async () => {
    const model = parse(await readFile(resolve(root, "models/piezo-40khz.model.yaml"), "utf8")) as {
      provenance: { confidence: string; source: string };
    };
    expect(model.provenance.confidence).toBe("low");
    expect(model.provenance.source).toMatch(/illustrative/i);
  });
});
