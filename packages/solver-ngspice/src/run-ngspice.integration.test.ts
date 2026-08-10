import { parseBoardYaml } from "@chip-sim/board-schema";
import { buildCircuit } from "@chip-sim/circuit-core";
import { compileSpice } from "@chip-sim/spice-compiler";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runNgspice } from "./run-ngspice";

const divider = `
version: 1
name: Divider integration
components:
  supply: { type: foundation.dc_voltage_source, parameters: { voltage: 9 V } }
  top: { type: foundation.resistor, parameters: { resistance: 1 kohm } }
  bottom: { type: foundation.resistor, parameters: { resistance: 1 kohm } }
  reference: { type: foundation.ground }
connections:
  - [supply.positive, rail]
  - [supply.negative, ground]
  - [top.positive, rail]
  - [top.negative, midpoint]
  - [bottom.positive, midpoint]
  - [bottom.negative, ground]
  - [reference.reference, ground]
`;

describe("runNgspice", () => {
  it("runs a real voltage-divider transient", async () => {
    const parsed = parseBoardYaml(divider);
    if (!parsed.ok) throw new Error("parse failed");
    const built = buildCircuit(parsed.board);
    if (!built.ok) throw new Error("build failed");
    const compiled = compileSpice(built.circuit, {
      id: "startup",
      type: "transient",
      stepSeconds: 1e-5,
      stopSeconds: 1e-4,
      probes: [{ id: "midpoint", kind: "voltage", target: "midpoint" }],
    });
    const run = await runNgspice({
      compiled,
      analysisId: "startup",
      executablePath: resolve("resources/ngspice/darwin-arm64/ngspice"),
      timeoutMs: 10_000,
    });
    expect(run.status).toBe("completed");
    const values = run.dataset?.signals[0]?.values ?? [];
    expect(values.at(-1)).toBeCloseTo(4.5, 3);
  }, 15_000);
});
