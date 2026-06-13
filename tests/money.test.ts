import { describe, it, expect } from "vitest";
import { toStroops, fromStroops, stroopsToStellarAmount } from "../src/services/money";

describe("money math", () => {
  it("parses and formats decimals at 7dp", () => {
    expect(toStroops("1")).toBe(10_000_000n);
    expect(toStroops("0.0000001")).toBe(1n);
    expect(toStroops("12.5")).toBe(125_000_000n);
    expect(fromStroops(125_000_000n)).toBe("12.5");
    expect(fromStroops(10_000_000n)).toBe("1");
  });

  it("round-trips arbitrary values", () => {
    for (const v of ["0", "0.5", "100.0000001", "999999.9999999"]) {
      expect(fromStroops(toStroops(v))).toBe(v.replace(/\.?0+$/, "") || "0");
    }
  });

  it("handles negatives", () => {
    expect(toStroops("-3.25")).toBe(-32_500_000n);
    expect(fromStroops(-32_500_000n)).toBe("-3.25");
  });

  it("always renders Stellar amounts with 7dp", () => {
    expect(stroopsToStellarAmount(10_000_000n)).toBe("1.0000000");
    expect(stroopsToStellarAmount(125_000_000n)).toBe("12.5000000");
  });

  it("rejects garbage", () => {
    expect(() => toStroops("abc")).toThrow();
    expect(() => toStroops("1.2.3")).toThrow();
  });
});
