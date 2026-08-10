export type QuantityKind =
  | "voltage"
  | "current"
  | "resistance"
  | "capacitance"
  | "inductance"
  | "time"
  | "frequency";

export interface ParsedQuantity {
  siValue: number;
  unit: string;
}

const units: Record<string, { kind: QuantityKind; canonical: string }> = {
  V: { kind: "voltage", canonical: "V" },
  A: { kind: "current", canonical: "A" },
  ohm: { kind: "resistance", canonical: "ohm" },
  Ω: { kind: "resistance", canonical: "ohm" },
  F: { kind: "capacitance", canonical: "F" },
  H: { kind: "inductance", canonical: "H" },
  s: { kind: "time", canonical: "s" },
  Hz: { kind: "frequency", canonical: "Hz" },
};

const prefixes: Record<string, number> = {
  "": 1,
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  m: 1e-3,
  k: 1e3,
  M: 1e6,
};

export function parseQuantity(
  source: string,
  expected: QuantityKind,
): ParsedQuantity {
  const match = source
    .trim()
    .match(
      /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([pnumkMµ]?)(Hz|ohm|Ω|V|A|F|H|s)$/,
    );
  if (!match)
    throw new Error(
      `Invalid physical quantity '${source}'; expected ${expected}`,
    );

  const numeric = Number(match[1]);
  const prefix = match[2] ?? "";
  const rawUnit = match[3] ?? "";
  const definition = units[rawUnit];
  if (!definition || definition.kind !== expected) {
    throw new Error(
      `Physical quantity '${source}' has unit ${rawUnit}; expected ${expected}`,
    );
  }

  const rawSiValue = numeric * (prefixes[prefix] ?? Number.NaN);
  if (!Number.isFinite(rawSiValue))
    throw new Error(`Physical quantity '${source}' is not finite`);
  const siValue = Number(rawSiValue.toPrecision(15));
  return { siValue, unit: definition.canonical };
}
