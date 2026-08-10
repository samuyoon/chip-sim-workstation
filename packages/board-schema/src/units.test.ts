import { describe, expect, it } from "vitest";
import { parseQuantity } from "./units";

describe("parseQuantity", () => {
  it("normalizes voltage", () => {
    expect(parseQuantity("9 V", "voltage")).toEqual({ siValue: 9, unit: "V" });
  });

  it("normalizes prefixed capacitance", () => {
    expect(parseQuantity("100 uF", "capacitance")).toEqual({
      siValue: 0.0001,
      unit: "F",
    });
  });

  it("rejects a mismatched physical quantity", () => {
    expect(() => parseQuantity("9 A", "voltage")).toThrow("expected voltage");
  });
});
