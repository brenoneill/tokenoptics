import { describe, expect, it } from "vitest";

import {
  KIRO_CREDIT_RATE_USD,
  costForCredits,
  kiroModelMultiplier,
  kiroPlanCostForCredits,
} from "@/lib/pricing";

describe("costForCredits", () => {
  it("prices credits at the overage rate by default ($0.04/credit)", () => {
    expect(costForCredits(100)).toBeCloseTo(4.0, 10);
    expect(costForCredits(29.19)).toBeCloseTo(29.19 * 0.04, 10);
  });

  it("supports the blended within-plan rate ($0.02/credit)", () => {
    expect(costForCredits(100, "blended")).toBeCloseTo(2.0, 10);
  });

  it("returns 0 for 0 credits", () => {
    expect(costForCredits(0)).toBe(0);
  });

  it("exposes both documented rates", () => {
    expect(KIRO_CREDIT_RATE_USD.overage).toBe(0.04);
    expect(KIRO_CREDIT_RATE_USD.blended).toBe(0.02);
  });
});

describe("kiroModelMultiplier", () => {
  it("returns the authoritative multipliers from kiro-cli --list-models", () => {
    expect(kiroModelMultiplier("auto")).toBe(1.0);
    expect(kiroModelMultiplier("claude-opus-4.8")).toBe(2.2);
    expect(kiroModelMultiplier("claude-sonnet-4.6")).toBe(1.3);
    expect(kiroModelMultiplier("claude-haiku-4.5")).toBe(0.4);
    expect(kiroModelMultiplier("glm-5")).toBe(0.5);
    expect(kiroModelMultiplier("qwen3-coder-next")).toBe(0.05);
  });

  it("resolves deprecated -1m suffixed ids via substring match", () => {
    expect(kiroModelMultiplier("claude-opus-4.6-1m")).toBe(2.2);
    expect(kiroModelMultiplier("claude-sonnet-4.6-1m")).toBe(1.3);
  });

  it("returns null for genuinely unknown models rather than guessing", () => {
    expect(kiroModelMultiplier("some-future-model")).toBeNull();
    expect(kiroModelMultiplier(undefined)).toBeNull();
  });
});

describe("kiroPlanCostForCredits", () => {
  it("charges only the flat fee when usage is within the allotment", () => {
    const c = kiroPlanCostForCredits(800, "pro"); // Pro = 1000 included
    expect(c.monthlyFee).toBe(20);
    expect(c.overageCredits).toBe(0);
    expect(c.overageCost).toBe(0);
    expect(c.total).toBe(20);
  });

  it("adds $0.04/credit overage beyond the allotment", () => {
    const c = kiroPlanCostForCredits(1100, "pro"); // 100 over
    expect(c.overageCredits).toBe(100);
    expect(c.overageCost).toBeCloseTo(4.0, 10);
    expect(c.total).toBeCloseTo(24.0, 10);
  });

  it("overage-only has no flat fee — every credit billed at $0.04", () => {
    const c = kiroPlanCostForCredits(500, "overage-only");
    expect(c.monthlyFee).toBe(0);
    expect(c.overageCredits).toBe(500);
    expect(c.total).toBeCloseTo(20.0, 10);
  });

  it("Power tier absorbs large usage under its 10k allotment", () => {
    const c = kiroPlanCostForCredits(9000, "power");
    expect(c.total).toBe(200);
    expect(c.overageCredits).toBe(0);
  });
});
