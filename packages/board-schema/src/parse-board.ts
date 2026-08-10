import { LineCounter, parseDocument } from "yaml";
import { z } from "zod";
import type { BoardParseResult, Diagnostic, SourceLocation } from "./types";

const endpoint = /^[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z_][A-Za-z0-9_-]*$/;
const netName = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const parameterValue = z.union([z.string(), z.number(), z.boolean()]);
const componentSchema = z.object({
  type: z.string().min(1),
  parameters: z.record(z.string(), parameterValue).default({}),
});
const connectionSchema = z
  .tuple([z.string(), z.string()])
  .refine(
    ([port]) => endpoint.test(port),
    "First connection value must be component.port",
  )
  .refine(
    ([, net]) => netName.test(net),
    "Second connection value must be a net name",
  );
const boardSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  components: z.record(z.string(), componentSchema),
  connections: z.array(connectionSchema),
});

function locate(
  source: string,
  path: PropertyKey[],
): SourceLocation | undefined {
  const key = [...path]
    .reverse()
    .find((part): part is string => typeof part === "string");
  if (!key) return undefined;
  const lines = source.split("\n");
  const index = lines.findIndex((line) => line.includes(key));
  if (index < 0) return undefined;
  return {
    line: index + 1,
    column: Math.max(1, (lines[index]?.indexOf(key) ?? 0) + 1),
  };
}

export function parseBoardYaml(source: string): BoardParseResult {
  const lineCounter = new LineCounter();
  const document = parseDocument(source, { lineCounter, uniqueKeys: true });
  if (document.errors.length > 0) {
    const diagnostics: Diagnostic[] = document.errors.map((error) => {
      const first = error.linePos?.[0];
      return {
        code: "YAML_PARSE_ERROR",
        severity: "error",
        message: error.message,
        ...(first ? { location: { line: first.line, column: first.col } } : {}),
      };
    });
    return { ok: false, diagnostics };
  }

  const parsed = boardSchema.safeParse(document.toJS());
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: parsed.error.issues.map((issue) => {
        const location = locate(source, issue.path);
        return {
          code: "INVALID_BOARD_SCHEMA",
          severity: "error" as const,
          message: issue.message,
          ...(location ? { location } : {}),
        };
      }),
    };
  }

  return { ok: true, board: parsed.data, diagnostics: [] };
}
