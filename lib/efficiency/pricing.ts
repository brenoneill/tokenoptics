import { pricingForModel, type ModelPricing } from "../pricing";
import type {
  RequestSpanShape,
  TurnShape,
  TurnTier,
  WasteBreakdown,
} from "./types";

export const TIER_REPRESENTATIVE_MODEL: Record<TurnTier, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
};

function rateFor(tier: TurnTier): ModelPricing {
  return pricingForModel(TIER_REPRESENTATIVE_MODEL[tier]);
}

export function actualCostFromShape(shape: TurnShape): number {
  const p = pricingForModel(shape.actualModel);
  return (
    shape.inputTokens         * p.input        +
    shape.outputTokens        * p.output       +
    shape.cacheReadTokens     * p.cacheRead    +
    shape.cacheWrite5mTokens  * p.cacheWrite   +
    shape.cacheWrite1hTokens  * p.cacheWrite1h
  ) / 1_000_000;
}

export function counterfactualCost(shape: TurnShape, suggestedTier: TurnTier): number {
  const p = rateFor(suggestedTier);
  const textOutputTokens = Math.max(0, shape.outputTokens - shape.thinkingTokensEstimate);

  return (
    shape.inputTokens         * p.input        +
    textOutputTokens          * p.output       +
    shape.cacheReadTokens     * p.cacheRead    +
    shape.cacheWrite5mTokens  * p.cacheWrite   +
    shape.cacheWrite1hTokens  * p.cacheWrite1h
  ) / 1_000_000;
}

export function wasteBreakdown(shape: TurnShape, suggestedTier: TurnTier): WasteBreakdown {
  const actual = pricingForModel(shape.actualModel);
  const target = rateFor(suggestedTier);
  const thinkingTokens = shape.thinkingTokensEstimate;
  const textOutputTokens = Math.max(0, shape.outputTokens - thinkingTokens);

  const inputRatePremium = (
    (actual.input        - target.input)        * shape.inputTokens        +
    (actual.cacheRead    - target.cacheRead)    * shape.cacheReadTokens    +
    (actual.cacheWrite   - target.cacheWrite)   * shape.cacheWrite5mTokens +
    (actual.cacheWrite1h - target.cacheWrite1h) * shape.cacheWrite1hTokens
  ) / 1_000_000;

  const outputRatePremium = (
    (actual.output - target.output) * textOutputTokens
  ) / 1_000_000;

  const thinkingSurplus = (thinkingTokens * actual.output) / 1_000_000;

  return {
    inputRatePremium,
    outputRatePremium,
    thinkingSurplus,
    total: inputRatePremium + outputRatePremium + thinkingSurplus,
  };
}

export const ZERO_WASTE: WasteBreakdown = {
  inputRatePremium: 0,
  outputRatePremium: 0,
  thinkingSurplus: 0,
  total: 0,
};

export function counterfactualCostForSpan(
  shape: RequestSpanShape,
  suggestedTier: TurnTier,
): number {
  const p = rateFor(suggestedTier);
  const textOutputTokens = Math.max(
    0,
    shape.outputTokens - shape.totalThinkingTokensEstimate,
  );
  return (
    shape.inputTokens         * p.input        +
    textOutputTokens          * p.output       +
    shape.cacheReadTokens     * p.cacheRead    +
    shape.cacheWrite5mTokens  * p.cacheWrite   +
    shape.cacheWrite1hTokens  * p.cacheWrite1h
  ) / 1_000_000;
}

export function spanWasteBreakdown(
  shape: RequestSpanShape,
  suggestedTier: TurnTier,
): WasteBreakdown {
  const actual = pricingForModel(shape.actualModel);
  const target = rateFor(suggestedTier);
  const thinkingTokens = shape.totalThinkingTokensEstimate;
  const textOutputTokens = Math.max(0, shape.outputTokens - thinkingTokens);

  const inputRatePremium = (
    (actual.input        - target.input)        * shape.inputTokens        +
    (actual.cacheRead    - target.cacheRead)    * shape.cacheReadTokens    +
    (actual.cacheWrite   - target.cacheWrite)   * shape.cacheWrite5mTokens +
    (actual.cacheWrite1h - target.cacheWrite1h) * shape.cacheWrite1hTokens
  ) / 1_000_000;

  const outputRatePremium = (
    (actual.output - target.output) * textOutputTokens
  ) / 1_000_000;

  const thinkingSurplus = (thinkingTokens * actual.output) / 1_000_000;

  return {
    inputRatePremium,
    outputRatePremium,
    thinkingSurplus,
    total: inputRatePremium + outputRatePremium + thinkingSurplus,
  };
}

export function addWaste(a: WasteBreakdown, b: WasteBreakdown): WasteBreakdown {
  return {
    inputRatePremium: a.inputRatePremium + b.inputRatePremium,
    outputRatePremium: a.outputRatePremium + b.outputRatePremium,
    thinkingSurplus: a.thinkingSurplus + b.thinkingSurplus,
    total: a.total + b.total,
  };
}
