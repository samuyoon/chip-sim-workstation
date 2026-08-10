export interface SpiceSourceMapEntry {
  line: number;
  componentId: string;
  generatedName: string;
}

export interface CompiledSpice {
  netlist: string;
  sourceMap: SpiceSourceMapEntry[];
  outputFile: string;
  vectors: Array<{ id: string; expression: string; unit: string }>;
}
