import { describe, expect, it } from "vitest";
import { parseWrdata } from "./parse-wrdata";

const vectors = [
  { id: "rail", expression: "v(n_rail)", unit: "V" },
  { id: "supply-current", expression: "i(V_supply)", unit: "A" },
];

describe("parseWrdata", () => {
  it("parses an axis and typed signals", () => {
    const result = parseWrdata(
      "time v(n_rail) i(V_supply)\n0 0 0\n0.001 4.5 -0.0045\n",
      vectors,
    );
    expect(result.axis.values).toEqual([0, 0.001]);
    expect(result.signals[0]).toMatchObject({
      id: "rail",
      unit: "V",
      minimum: 0,
      maximum: 4.5,
    });
    expect(result.signals[1]?.values).toEqual([0, -0.0045]);
  });

  it("rejects malformed rows", () => {
    expect(() =>
      parseWrdata("time v(n_rail) i(V_supply)\n0 0\n", vectors),
    ).toThrow("RESULT_PARSE_ERROR");
  });

  it("rejects nonfinite values", () => {
    expect(() =>
      parseWrdata("time v(n_rail) i(V_supply)\n0 NaN 0\n", vectors),
    ).toThrow("RESULT_PARSE_ERROR");
  });
});
