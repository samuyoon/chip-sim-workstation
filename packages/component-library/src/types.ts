import type { ParsedQuantity, QuantityKind } from "@chip-sim/board-schema";

export interface ParameterDefinition {
  quantity: QuantityKind;
  default: string;
  minimum?: number;
  exclusiveMinimum?: boolean;
}

export type SpicePrimitive = "ground" | "voltage" | "pulse_voltage" | "current" | "resistor" | "capacitor" | "inductor" | "diode" | "switch";

export interface ComponentDefinition {
  id: string;
  name: string;
  category: "source" | "passive" | "semiconductor" | "reference" | "load";
  ports: Record<string, { domain: "electrical"; required: boolean }>;
  parameters: Record<string, ParameterDefinition>;
  implementation: { kind: "spice_primitive"; device: SpicePrimitive };
  provenance: { tier: "foundation" | "catalog" | "custom"; confidence: "high" | "medium" | "low"; source: string };
}

export type ResolvedParameters = Record<string, ParsedQuantity>;
