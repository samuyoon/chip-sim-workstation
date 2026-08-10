import { parseBoardYaml } from "@chip-sim/board-schema";
import { buildCircuit } from "@chip-sim/circuit-core";
import { describe, expect, it } from "vitest";
import { compileSpice, type SimulationAnalysis } from "./compile";

const source = `
version: 1
name: Divider
components:
  supply: { type: foundation.dc_voltage_source, parameters: { voltage: 9 V } }
  resistor: { type: foundation.resistor, parameters: { resistance: 1 kohm } }
  ground_ref: { type: foundation.ground }
connections:
  - [supply.positive, rail]
  - [supply.negative, ground]
  - [resistor.positive, rail]
  - [resistor.negative, ground]
  - [ground_ref.reference, ground]
`;

function circuit() {
  const parsed = parseBoardYaml(source);
  if (!parsed.ok) throw new Error("parse failed");
  const built = buildCircuit(parsed.board);
  if (!built.ok) throw new Error("build failed");
  return built.circuit;
}

const operatingPoint: SimulationAnalysis = {
  id: "operating-point",
  type: "operating_point",
  probes: [
    { id: "rail-voltage", kind: "voltage", target: "rail" },
    { id: "supply-current", kind: "current", target: "supply" },
  ],
};

describe("compileSpice", () => {
  it("generates deterministic operating-point SPICE", () => {
    const first = compileSpice(circuit(), operatingPoint);
    const second = compileSpice(circuit(), operatingPoint);
    expect(first.netlist).toBe(second.netlist);
    expect(first.netlist).toContain("V_supply n_rail 0 DC 9");
    expect(first.netlist).toContain("R_resistor n_rail 0 1000");
    expect(first.netlist).toContain("op");
    expect(first.netlist).toContain("wrdata results.dat v(n_rail) i(V_supply)");
  });

  it("maps generated device lines back to components", () => {
    const result = compileSpice(circuit(), operatingPoint);
    expect(
      result.sourceMap.some(
        (entry) =>
          entry.componentId === "supply" && entry.generatedName === "V_supply",
      ),
    ).toBe(true);
  });

  it("generates transient analysis directives", () => {
    const analysis: SimulationAnalysis = {
      id: "startup",
      type: "transient",
      stepSeconds: 1e-6,
      stopSeconds: 1e-3,
      probes: [{ id: "rail", kind: "voltage", target: "rail" }],
    };
    expect(compileSpice(circuit(), analysis).netlist).toContain(
      "tran 0.000001 0.001",
    );
  });
});
