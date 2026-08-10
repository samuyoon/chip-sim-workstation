import type { SimulationDataset } from "@chip-sim/simulation-results";
import type { CompiledSpice } from "@chip-sim/spice-compiler";

export function parseWrdata(
  _source: string,
  _vectors: CompiledSpice["vectors"],
): SimulationDataset {
  const rows = _source
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/));
  if (rows.length < 2)
    throw new Error("RESULT_PARSE_ERROR: output has no samples");
  const header = rows[0]!;
  const expectedColumns = _vectors.length + 1;
  if (header.length !== expectedColumns)
    throw new Error(
      "RESULT_PARSE_ERROR: header does not match requested vectors",
    );

  const columns = Array.from({ length: expectedColumns }, () => [] as number[]);
  for (const row of rows.slice(1)) {
    if (row.length !== expectedColumns)
      throw new Error("RESULT_PARSE_ERROR: malformed result row");
    row.forEach((value, index) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric))
        throw new Error("RESULT_PARSE_ERROR: nonfinite result value");
      columns[index]!.push(numeric);
    });
  }

  const axisLabel = header[0] ?? "scale";
  const axisUnit = axisLabel.toLowerCase().includes("time") ? "s" : "";
  const signals = _vectors.map((vector, index) => {
    const values = columns[index + 1]!;
    return {
      ...vector,
      values,
      minimum: Math.min(...values),
      maximum: Math.max(...values),
    };
  });
  return {
    axis: {
      id: axisLabel,
      label: axisLabel,
      unit: axisUnit,
      values: columns[0]!,
    },
    signals,
    sampleCount: columns[0]!.length,
  };
}
