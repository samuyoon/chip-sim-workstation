import type { CanonicalCircuit } from "@chip-sim/circuit-core";
import { spiceIdentifier } from "./identifiers";
import type { CompiledSpice } from "./types";

export interface SimulationProbe {
  id: string;
  kind: "voltage" | "current";
  target: string;
}

export type SimulationAnalysis =
  | { id: string; type: "operating_point"; probes: SimulationProbe[] }
  | { id: string; type: "dc_sweep"; sourceComponentId: string; start: number; stop: number; step: number; probes: SimulationProbe[] }
  | { id: string; type: "transient"; stepSeconds: number; stopSeconds: number; probes: SimulationProbe[] };

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("SPICE values must be finite");
  return Number(value.toPrecision(15)).toString();
}

export function compileSpice(circuit: CanonicalCircuit, analysis: SimulationAnalysis): CompiledSpice {
  const lines = [`* Chip Sim Workstation: ${circuit.name}`];
  const sourceMap: CompiledSpice["sourceMap"] = [];
  const portNets = new Map<string, string>();
  for (const net of circuit.nets) {
    for (const connection of net.connections) portNets.set(`${connection.componentId}.${connection.portId}`, net.name);
  }

  const groundComponent = circuit.components.find((component) => component.definition.implementation.device === "ground");
  const groundNet = groundComponent ? portNets.get(`${groundComponent.id}.reference`) : undefined;
  if (!groundNet) throw new Error("Cannot compile a circuit without ground");
  const node = (netName: string) => (netName === groundNet ? "0" : `n_${spiceIdentifier(netName)}`);
  const portNode = (componentId: string, portId: string) => {
    const netName = portNets.get(`${componentId}.${portId}`);
    if (!netName) throw new Error(`Missing net for ${componentId}.${portId}`);
    return node(netName);
  };
  const generatedNames = new Map<string, string>();
  let needsDiodeModel = false;

  for (const component of circuit.components) {
    const id = spiceIdentifier(component.id);
    const device = component.definition.implementation.device;
    let generatedName = "";
    let line = "";
    const p = component.parameters;
    if (device === "ground") continue;
    if (device === "voltage") {
      generatedName = `V_${id}`;
      line = `${generatedName} ${portNode(component.id, "positive")} ${portNode(component.id, "negative")} DC ${formatNumber(p.voltage!.siValue)}`;
    } else if (device === "pulse_voltage") {
      generatedName = `V_${id}`;
      line = `${generatedName} ${portNode(component.id, "positive")} ${portNode(component.id, "negative")} PULSE(${formatNumber(p.low!.siValue)} ${formatNumber(p.high!.siValue)} ${formatNumber(p.delay!.siValue)} ${formatNumber(p.rise!.siValue)} ${formatNumber(p.fall!.siValue)} ${formatNumber(p.onTime!.siValue)} ${formatNumber(p.period!.siValue)})`;
    } else if (device === "current") {
      generatedName = `I_${id}`;
      line = `${generatedName} ${portNode(component.id, "positive")} ${portNode(component.id, "negative")} DC ${formatNumber(p.current!.siValue)}`;
    } else if (device === "resistor") {
      generatedName = `R_${id}`;
      line = `${generatedName} ${portNode(component.id, "positive")} ${portNode(component.id, "negative")} ${formatNumber(p.resistance!.siValue)}`;
    } else if (device === "capacitor") {
      generatedName = `C_${id}`;
      line = `${generatedName} ${portNode(component.id, "positive")} ${portNode(component.id, "negative")} ${formatNumber(p.capacitance!.siValue)}`;
    } else if (device === "inductor") {
      generatedName = `L_${id}`;
      line = `${generatedName} ${portNode(component.id, "positive")} ${portNode(component.id, "negative")} ${formatNumber(p.inductance!.siValue)}`;
    } else if (device === "diode") {
      generatedName = `D_${id}`;
      line = `${generatedName} ${portNode(component.id, "anode")} ${portNode(component.id, "cathode")} CHIP_DIODE`;
      needsDiodeModel = true;
    } else if (device === "switch") {
      generatedName = `S_${id}`;
      line = `${generatedName} ${portNode(component.id, "positive")} ${portNode(component.id, "negative")} ${portNode(component.id, "controlPositive")} ${portNode(component.id, "controlNegative")} CHIP_SWITCH_${id}`;
    }
    if (!line) throw new Error(`Unsupported SPICE primitive ${device}`);
    lines.push(line);
    generatedNames.set(component.id, generatedName);
    sourceMap.push({ line: lines.length, componentId: component.id, generatedName });
    if (device === "switch") {
      lines.push(`.model CHIP_SWITCH_${id} SW(Ron=${formatNumber(p.onResistance!.siValue)} Roff=${formatNumber(p.offResistance!.siValue)} Vt=${formatNumber(p.threshold!.siValue)} Vh=0)`);
    }
  }
  if (needsDiodeModel) lines.push(".model CHIP_DIODE D");

  const vectors = analysis.probes.map((probe) => {
    if (probe.kind === "voltage") {
      const targetNet = circuit.nets.find((net) => net.name === probe.target);
      if (!targetNet) throw new Error(`Unknown voltage probe net '${probe.target}'`);
      return { id: probe.id, expression: `v(${node(probe.target)})`, unit: "V" };
    }
    const targetName = generatedNames.get(probe.target);
    if (!targetName) throw new Error(`Unknown current probe component '${probe.target}'`);
    return { id: probe.id, expression: `i(${targetName})`, unit: "A" };
  });

  lines.push(".control", "set wr_vecnames", "set wr_singlescale");
  if (analysis.type === "operating_point") lines.push("op");
  if (analysis.type === "dc_sweep") {
    const sourceName = generatedNames.get(analysis.sourceComponentId);
    if (!sourceName?.startsWith("V_")) throw new Error("DC sweep source must be a voltage source");
    lines.push(`dc ${sourceName} ${formatNumber(analysis.start)} ${formatNumber(analysis.stop)} ${formatNumber(analysis.step)}`);
  }
  if (analysis.type === "transient") lines.push(`tran ${formatNumber(analysis.stepSeconds)} ${formatNumber(analysis.stopSeconds)}`);
  lines.push(`wrdata results.dat ${vectors.map((vector) => vector.expression).join(" ")}`, "quit", ".endc", ".end");

  return { netlist: `${lines.join("\n")}\n`, sourceMap, outputFile: "results.dat", vectors };
}
