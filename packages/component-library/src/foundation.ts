import type { ComponentDefinition } from "./types";

const electricalPair = {
  positive: { domain: "electrical", required: true },
  negative: { domain: "electrical", required: true }
} as const;

const provenance = { tier: "foundation", confidence: "high", source: "Chip Sim foundation library" } as const;

function primitive(
  id: string,
  name: string,
  category: ComponentDefinition["category"],
  device: ComponentDefinition["implementation"]["device"],
  ports: ComponentDefinition["ports"],
  parameters: ComponentDefinition["parameters"] = {}
): ComponentDefinition {
  return { id, name, category, ports, parameters, implementation: { kind: "spice_primitive", device }, provenance };
}

const definitions: ComponentDefinition[] = [
  primitive("foundation.ground", "Ground", "reference", "ground", {
    reference: { domain: "electrical", required: true }
  }),
  primitive("foundation.dc_voltage_source", "DC Voltage Source", "source", "voltage", electricalPair, {
    voltage: { quantity: "voltage", default: "9 V", minimum: 0 }
  }),
  primitive("foundation.pulse_voltage_source", "Pulse Voltage Source", "source", "pulse_voltage", electricalPair, {
    low: { quantity: "voltage", default: "0 V" },
    high: { quantity: "voltage", default: "5 V" },
    delay: { quantity: "time", default: "0 s", minimum: 0 },
    rise: { quantity: "time", default: "1 us", minimum: 0 },
    fall: { quantity: "time", default: "1 us", minimum: 0 },
    onTime: { quantity: "time", default: "10 us", minimum: 0, exclusiveMinimum: true },
    period: { quantity: "time", default: "25 us", minimum: 0, exclusiveMinimum: true }
  }),
  primitive("foundation.dc_current_source", "DC Current Source", "source", "current", electricalPair, {
    current: { quantity: "current", default: "1 mA" }
  }),
  primitive("foundation.resistor", "Resistor", "passive", "resistor", electricalPair, {
    resistance: { quantity: "resistance", default: "1 kohm", minimum: 0, exclusiveMinimum: true }
  }),
  primitive("foundation.resistive_load", "Resistive Load", "load", "resistor", electricalPair, {
    resistance: { quantity: "resistance", default: "100 ohm", minimum: 0, exclusiveMinimum: true }
  }),
  primitive("foundation.capacitor", "Capacitor", "passive", "capacitor", electricalPair, {
    capacitance: { quantity: "capacitance", default: "1 uF", minimum: 0, exclusiveMinimum: true }
  }),
  primitive("foundation.inductor", "Inductor", "passive", "inductor", electricalPair, {
    inductance: { quantity: "inductance", default: "1 mH", minimum: 0, exclusiveMinimum: true }
  }),
  primitive("foundation.diode", "Generic Diode", "semiconductor", "diode", {
    anode: { domain: "electrical", required: true },
    cathode: { domain: "electrical", required: true }
  }),
  primitive("foundation.voltage_controlled_switch", "Voltage-Controlled Switch", "semiconductor", "switch", {
    positive: { domain: "electrical", required: true },
    negative: { domain: "electrical", required: true },
    controlPositive: { domain: "electrical", required: true },
    controlNegative: { domain: "electrical", required: true }
  }, {
    threshold: { quantity: "voltage", default: "2.5 V" },
    onResistance: { quantity: "resistance", default: "10 mohm", minimum: 0, exclusiveMinimum: true },
    offResistance: { quantity: "resistance", default: "1 Mohm", minimum: 0, exclusiveMinimum: true }
  })
];

export const foundationLibrary: ReadonlyMap<string, ComponentDefinition> = new Map(
  definitions.map((definition) => [definition.id, definition])
);
