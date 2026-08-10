import { parseBoardYaml } from "@chip-sim/board-schema";
import { describe, expect, it } from "vitest";
import { buildCircuit } from "./build-circuit";

const boardSource = `
version: 1
name: Voltage divider
components:
  supply:
    type: foundation.dc_voltage_source
    parameters: { voltage: 9 V }
  load:
    type: foundation.resistor
    parameters: { resistance: 1 kohm }
  reference:
    type: foundation.ground
connections:
  - [supply.positive, rail]
  - [supply.negative, ground]
  - [load.positive, rail]
  - [load.negative, ground]
  - [reference.reference, ground]
`;

function parsed(source = boardSource) {
  const result = parseBoardYaml(source);
  if (!result.ok) throw new Error("Test fixture did not parse");
  return result.board;
}

describe("buildCircuit", () => {
  it("resolves components, values, and nets", () => {
    const result = buildCircuit(parsed());
    expect(result.ok).toBe(true);
    expect(result.circuit?.components.find((item) => item.id === "supply")?.parameters.voltage?.siValue).toBe(9);
    expect(result.circuit?.nets.find((item) => item.name === "rail")?.connections).toHaveLength(2);
  });

  it("rejects an unknown component type", () => {
    const result = buildCircuit(parsed(boardSource.replace("foundation.resistor", "vendor.unknown")));
    expect(result.diagnostics.some((item) => item.code === "UNKNOWN_COMPONENT_TYPE")).toBe(true);
  });

  it("rejects an unknown port", () => {
    const result = buildCircuit(parsed(boardSource.replace("load.positive", "load.wrong")));
    expect(result.diagnostics.some((item) => item.code === "UNKNOWN_PORT")).toBe(true);
  });

  it("requires a ground reference component", () => {
    const withoutGround = boardSource
      .replace("  reference:\n    type: foundation.ground\n", "")
      .replace("  - [reference.reference, ground]\n", "");
    const result = buildCircuit(parsed(withoutGround));
    expect(result.diagnostics.some((item) => item.code === "MISSING_GROUND")).toBe(true);
  });
});
