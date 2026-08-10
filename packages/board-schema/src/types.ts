export interface SourceLocation {
  line: number;
  column: number;
}

export interface Diagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  location?: SourceLocation;
  entityId?: string;
}

export interface BoardComponentSource {
  type: string;
  parameters: Record<string, string | number | boolean>;
}

export interface BoardSource {
  version: 1;
  name: string;
  components: Record<string, BoardComponentSource>;
  connections: Array<[string, string]>;
}

export type BoardParseResult =
  | { ok: true; board: BoardSource; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[]; board?: undefined };
