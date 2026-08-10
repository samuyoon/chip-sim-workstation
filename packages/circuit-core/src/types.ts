import type { Diagnostic, ParsedQuantity } from "@chip-sim/board-schema";
import type { ComponentDefinition } from "@chip-sim/component-library";

export interface CanonicalComponent {
  id: string;
  definition: ComponentDefinition;
  parameters: Record<string, ParsedQuantity>;
}

export interface CanonicalConnection {
  componentId: string;
  portId: string;
}

export interface CanonicalNet {
  name: string;
  connections: CanonicalConnection[];
}

export interface CanonicalCircuit {
  name: string;
  components: CanonicalComponent[];
  nets: CanonicalNet[];
}

export type CircuitBuildResult =
  | { ok: true; circuit: CanonicalCircuit; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[]; circuit?: undefined };
