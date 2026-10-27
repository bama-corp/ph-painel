import { describe, expect, it } from "vitest";
import { parseKzInput } from "./money";

describe("parseKzInput", () => {
  it("lê milhares com ponto e decimais com vírgula", () => {
    expect(parseKzInput("300000")).toBe(300_000);
    expect(parseKzInput("300.000")).toBe(300_000);
    expect(parseKzInput("1.500.000")).toBe(1_500_000);
    expect(parseKzInput("1.500,50")).toBe(1500.5);
    expect(parseKzInput("10,5")).toBe(10.5);
    expect(parseKzInput("10.5")).toBe(10.5);
    expect(parseKzInput("0")).toBe(0);
  });

  it("não fecha um número a meio", () => {
    expect(parseKzInput("")).toBeNull();
    expect(parseKzInput("1.")).toBeNull();
    expect(parseKzInput("1.500.")).toBeNull();
    expect(parseKzInput("abc")).toBeNull();
  });
});
