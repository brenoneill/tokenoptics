import type { Usage } from "./types";

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h: number;
}

export const PRICING: Record<string, ModelPricing> = {
  "claude-fable-5": { input: 10.0, output: 50.0, cacheRead: 1.0, cacheWrite: 12.5, cacheWrite1h: 20.0 },
  "claude-opus-4-8": { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25, cacheWrite1h: 10.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25, cacheWrite1h: 10.0 },
  "claude-opus-4-6": { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25, cacheWrite1h: 10.0 },
  "claude-opus-4-5": { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25, cacheWrite1h: 10.0 },
  "claude-opus-4-1": { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75, cacheWrite1h: 30.0 },
  "claude-opus-4": { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75, cacheWrite1h: 30.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75, cacheWrite1h: 6.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75, cacheWrite1h: 6.0 },
  "claude-sonnet-4": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75, cacheWrite1h: 6.0 },
  "claude-3-7-sonnet": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75, cacheWrite1h: 6.0 },
  "claude-3-5-sonnet": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75, cacheWrite1h: 6.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25, cacheWrite1h: 2.0 },
  "claude-3-5-haiku": { input: 0.8, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0, cacheWrite1h: 1.6 },
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
    (usage.inputTokens * p.input + usage.outputTokens * p.output + usage.cacheReadTokens * p.cacheRead + usage.cacheWrite5mTokens * p.cacheWrite + usage.cacheWrite1hTokens * p.cacheWrite1h) /
    1_000_000
  );
}

// --- Kiro credit pricing -------------------------------------------------
//
// Kiro CLI meters usage in *credits*, not tokens (see docs/kiro-credit-pricing-
// research.md). The per-model multiplier is already baked into the credit value
// Kiro records, so converting credits → dollars needs no model lookup — just a
// $/credit rate. Two documented rates, both confirmed via the AWS Price List API
// (service code "Kiro", $0.04/credit overage; $0.02/credit blended across the
// included allotment of every paid tier):
//   - "overage": $0.04/credit — what the next (over-cap) credit actually costs.
//                The honest marginal "what would this have cost" number.
//   - "blended": $0.02/credit — included credits priced at plan rate ($20/1000 etc).
// Harnesses that meter in credits rather than tokens. Drives the token-vs-credit
// UI branch everywhere — use this instead of "did this session record credits",
// since a short Kiro session can legitimately have zero credits but is still a
// credit-metered (never token-metered) session.
export const CREDIT_HARNESS_IDS = new Set(["kiro-cli"]);

export function isCreditHarness(harnessId: string | undefined): boolean {
  return harnessId !== undefined && CREDIT_HARNESS_IDS.has(harnessId);
}

export type KiroCreditRateBasis = "overage" | "blended";

export const KIRO_CREDIT_RATE_USD: Record<KiroCreditRateBasis, number> = {
  overage: 0.04,
  blended: 0.02,
};

export const DEFAULT_KIRO_CREDIT_RATE_BASIS: KiroCreditRateBasis = "overage";

export function costForCredits(
  credits: number,
  basis: KiroCreditRateBasis = DEFAULT_KIRO_CREDIT_RATE_BASIS,
): number {
  return credits * KIRO_CREDIT_RATE_USD[basis];
}

// Kiro subscription plans. Figures confirmed via the AWS Price List API (service
// code "Kiro"): flat monthly fee + included credit allotment + $0.04/credit
// overage. "overage-only" is a synthetic option for users who don't want to
// model a flat plan — every credit is just billed at the marginal overage rate.
export type KiroPlanId = "free" | "pro" | "pro-plus" | "power" | "overage-only";

export interface KiroPlan {
  id: KiroPlanId;
  name: string;
  monthlyUSD: number;
  includedCredits: number;
  overageUSDPerCredit: number; // 0 when overage is unavailable (Free)
}

export const KIRO_PLANS: Record<KiroPlanId, KiroPlan> = {
  free:           { id: "free",         name: "Free",          monthlyUSD: 0,   includedCredits: 50,    overageUSDPerCredit: 0 },
  pro:            { id: "pro",          name: "Pro",           monthlyUSD: 20,  includedCredits: 1000,  overageUSDPerCredit: 0.04 },
  "pro-plus":     { id: "pro-plus",     name: "Pro+",          monthlyUSD: 40,  includedCredits: 2000,  overageUSDPerCredit: 0.04 },
  power:          { id: "power",        name: "Power",         monthlyUSD: 200, includedCredits: 10000, overageUSDPerCredit: 0.04 },
  "overage-only": { id: "overage-only", name: "Overage rate only", monthlyUSD: 0, includedCredits: 0, overageUSDPerCredit: 0.04 },
};

export const DEFAULT_KIRO_PLAN_ID: KiroPlanId = "pro";

export interface KiroPlanCost {
  monthlyFee: number;   // flat plan fee
  overageCredits: number; // credits beyond the allotment
  overageCost: number;  // overageCredits × rate
  total: number;        // monthlyFee + overageCost
}

// Plan-aware account cost for a billing month: the flat fee plus any overage.
// Credits within the allotment are already paid for by the flat fee, so they
// add nothing marginal — this is how Kiro actually bills.
export function kiroPlanCostForCredits(
  credits: number,
  planId: KiroPlanId = DEFAULT_KIRO_PLAN_ID,
): KiroPlanCost {
  const plan = KIRO_PLANS[planId] ?? KIRO_PLANS[DEFAULT_KIRO_PLAN_ID];
  const overageCredits = Math.max(0, credits - plan.includedCredits);
  const overageCost = overageCredits * plan.overageUSDPerCredit;
  return {
    monthlyFee: plan.monthlyUSD,
    overageCredits,
    overageCost,
    total: plan.monthlyUSD + overageCost,
  };
}

// Per-model credit multipliers, relative to the Auto baseline (1.0x). Display/
// education only — never used to compute cost, since logged credits already
// include the multiplier.
//
// GOLDEN PATH: this table is the authoritative output of Kiro CLI's own
// introspection — `kiro-cli chat --list-models --format json` returns each
// model's model_id + rate_multiplier + rate_unit + context_window_tokens.
// Captured 2026-06-03 (Kiro CLI 2.3.1). Keyed by exact model_id; the lookup
// also substring-matches so deprecated "-1m" variants resolve. Unknown models
// return null rather than a guess. Re-run the command to refresh.
export const KIRO_MODEL_MULTIPLIERS: Record<string, number> = {
  auto: 1.0,
  "claude-opus-4.8": 2.2,
  "claude-opus-4.7": 2.2,
  "claude-opus-4.6": 2.2,
  "claude-opus-4.5": 2.2,
  "claude-sonnet-4.6": 1.3,
  "claude-sonnet-4.5": 1.3,
  "claude-sonnet-4": 1.3,
  "claude-haiku-4.5": 0.4,
  "glm-5": 0.5,
  "deepseek-3.2": 0.25,
  "minimax-m2.5": 0.25,
  "minimax-m2.1": 0.15,
  "qwen3-coder-next": 0.05,
};

export function kiroModelMultiplier(model: string | undefined): number | null {
  if (!model) return null;
  const normalized = model.toLowerCase();
  if (KIRO_MODEL_MULTIPLIERS[normalized] !== undefined) {
    return KIRO_MODEL_MULTIPLIERS[normalized];
  }
  // Longest key first so "claude-opus-4.6" wins over a hypothetical "claude-opus"
  // prefix and "-1m" suffixed ids (claude-opus-4.6-1m) still resolve.
  const keys = Object.keys(KIRO_MODEL_MULTIPLIERS).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of keys) {
    if (normalized.includes(key)) return KIRO_MODEL_MULTIPLIERS[key];
  }
  return null;
}

export function formatCredits(n: number): string {
  if (n < 1) return n.toFixed(2);
  if (n < 1_000) return n.toFixed(1);
  return `${(n / 1_000).toFixed(2)}k`;
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
