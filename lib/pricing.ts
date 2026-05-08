import type { Usage } from "./types";

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h: number;
}

export const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-7":   { input:  5.0, output: 25.0, cacheRead: 0.5,  cacheWrite:  6.25, cacheWrite1h: 10.0 },
  "claude-opus-4-6":   { input:  5.0, output: 25.0, cacheRead: 0.5,  cacheWrite:  6.25, cacheWrite1h: 10.0 },
  "claude-opus-4-5":   { input:  5.0, output: 25.0, cacheRead: 0.5,  cacheWrite:  6.25, cacheWrite1h: 10.0 },
  "claude-opus-4-1":   { input: 15.0, output: 75.0, cacheRead: 1.5,  cacheWrite: 18.75, cacheWrite1h: 30.0 },
  "claude-opus-4":     { input: 15.0, output: 75.0, cacheRead: 1.5,  cacheWrite: 18.75, cacheWrite1h: 30.0 },
  "claude-sonnet-4-6": { input:  3.0, output: 15.0, cacheRead: 0.3,  cacheWrite:  3.75, cacheWrite1h:  6.0 },
  "claude-sonnet-4-5": { input:  3.0, output: 15.0, cacheRead: 0.3,  cacheWrite:  3.75, cacheWrite1h:  6.0 },
  "claude-sonnet-4":   { input:  3.0, output: 15.0, cacheRead: 0.3,  cacheWrite:  3.75, cacheWrite1h:  6.0 },
  "claude-3-7-sonnet": { input:  3.0, output: 15.0, cacheRead: 0.3,  cacheWrite:  3.75, cacheWrite1h:  6.0 },
  "claude-3-5-sonnet": { input:  3.0, output: 15.0, cacheRead: 0.3,  cacheWrite:  3.75, cacheWrite1h:  6.0 },
  "claude-haiku-4-5":  { input:  1.0, output:  5.0, cacheRead: 0.1,  cacheWrite:  1.25, cacheWrite1h:  2.0 },
  "claude-3-5-haiku":  { input:  0.8, output:  4.0, cacheRead: 0.08, cacheWrite:  1.0,  cacheWrite1h:  1.6 },
};

const FALLBACK_PRICING: ModelPricing = PRICING["claude-sonnet-4-6"];

const warned = new Set<string>();

export function pricingForModel(model: string | undefined): ModelPricing {
  if (!model) return FALLBACK_PRICING;
  if (PRICING[model]) return PRICING[model];

  // Strip trailing date/version suffixes ("claude-opus-4-7-20260101", "claude-opus-4-7[1m]")
  const stripped = model.replace(/\[.*\]$/, "");
  const parts = stripped.split("-");
  while (parts.length > 1) {
    const candidate = parts.join("-");
    if (PRICING[candidate]) return PRICING[candidate];
    parts.pop();
  }

  if (!warned.has(model)) {
    warned.add(model);
    console.warn(`[pricing] Unknown model "${model}" — using fallback rate.`);
  }
  return FALLBACK_PRICING;
}

export function costForUsage(model: string | undefined, usage: Usage): number {
  const p = pricingForModel(model);
  return (
    usage.inputTokens         * p.input        +
    usage.outputTokens        * p.output       +
    usage.cacheReadTokens     * p.cacheRead    +
    usage.cacheWrite5mTokens  * p.cacheWrite   +
    usage.cacheWrite1hTokens  * p.cacheWrite1h
  ) / 1_000_000;
}

export function formatUSD(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n < 1_000) return n.toString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
