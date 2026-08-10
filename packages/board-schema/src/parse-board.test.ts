import { describe, expect, it } from "vitest";
import { parseBoardYaml } from "./parse-board";

const validBoard = `
version: 1
name: Demo
components:
  supply:
    type: foundation.dc_voltage_source
    parameters:
      voltage: 9 V
connections:
  - [supply.positive, rail]
  - [supply.negative, ground]
`;

describe("parseBoardYaml", () => {
  it("parses a declarative board", () => {
    const result = parseBoardYaml(validBoard);
    expect(result.ok).toBe(true);
    expect(result.board?.components.supply?.type).toBe(
      "foundation.dc_voltage_source",
    );
  });

  it("reports duplicate YAML keys", () => {
    const result = parseBoardYaml(
      validBoard.replace("name: Demo", "name: Demo\nname: Duplicate"),
    );
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((item) => item.code === "YAML_PARSE_ERROR"),
    ).toBe(true);
  });

  it("reports malformed connection endpoints", () => {
    const result = parseBoardYaml(
      validBoard.replace("supply.positive", "supply"),
    );
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((item) => item.code === "INVALID_BOARD_SCHEMA"),
    ).toBe(true);
  });
});
