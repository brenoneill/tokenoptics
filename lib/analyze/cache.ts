// Cache-utilization analysis. Pure compute over Message.usage — no LLM, no
// worker, no persistence. Surfaces session-hygiene problems: low cache hit
// ratios, cost-per-turn climbing as context grows, cache_write churn from
// 5-minute TTL expiry.
//
// The headline insight isn't "you wasted X" — it's "X% of this session's
// cost went to re-reading the conversation's own history (cache_read)". For
// long sessions that proportion grows monotonically.

import { costForUsage, formatUSD, pricingForModel } from "../pricing";
import type { Message } from "../types";

export interface CacheTurnPoint {
  // 1-based, only counts assistant turns (user messages and tool-result-only
  // turns don't have usage attributed to them).
  turnIndex: number;
  model: string | null;
  cost: number;
  cumulativeCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  // The token bucket that contributed the most $ to this turn. Drives the
  // bar color in the trajectory chart.
  dominantBucket: TokenBucket;
}

export type TokenBucket =
  | "input"
  | "output"
  | "cache_read"
  | "cache_write_5m"
  | "cache_write_1h";

export type RecommendationSeverity = "info" | "warn" | "critical";

export interface CacheRecommendation {
  severity: RecommendationSeverity;
  title: string;
  message: string;
}

export interface CacheSessionReport {
  assistantTurnCount: number;
  totalCost: number;
  // Sum across all assistant turns of each token bucket.
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  // cache_read / (input + cache_read). 1.0 = perfect cache hit; 0 = nothing
  // cached. Above 0.85 is healthy for long sessions.
  cacheHitRatio: number;
  // Dollar cost of cache_read tokens alone. The "tax on history" — money
  // spent re-processing context, not producing new work.
  cacheReadCost: number;
  // cacheReadCost / totalCost. High share with a long session signals bloat.
  cacheReadCostShare: number;
  // Median cache_read $ across the first 3 turns. The cache_read each turn
  // would naturally pay even in a short, focused session — system prompt
  // and small amount of history. Exposed so the UI can explain the bloat
  // calc and the trajectory chart can mark it.
  baselineCacheReadCost: number;
  // Sum over turns of clamped excess cache_read above baselineCacheReadCost.
  // This is the raw "above-baseline context cost" — the cost of paying to
  // re-process growing conversation history. NOT inherently waste: in a
  // long, focused session this is just the natural cost of context. Only
  // when drift signals fire (see recoverableBloatCost) is it recoverable
  // by /clear or /compact.
  aboveBaselineContextCost: number;
  aboveBaselineContextShare: number; // aboveBaselineContextCost / totalCost
  // The portion of aboveBaselineContextCost that drift signals indicate
  // is genuinely recoverable. Equals aboveBaselineContextCost when any
  // critical or warn recommendation fires; otherwise 0. This is the
  // "unnecessary spend" number — gated on actual evidence of drift.
  recoverableBloatCost: number;
  // Cost-per-turn trajectory in order, for the bar chart.
  trajectory: CacheTurnPoint[];
  // Median cost of the first 3 assistant turns. The "early-session baseline".
  baselineTurnCost: number;
  // Average cost of the LAST 3 turns / baselineTurnCost. >3 means late turns
  // cost noticeably more than early ones.
  finalRampRatio: number;
  recommendations: CacheRecommendation[];
}

function dominantBucket(
  inputCost: number,
  outputCost: number,
  cacheReadCost: number,
  cacheWrite5mCost: number,
  cacheWrite1hCost: number,
): TokenBucket {
  let best: TokenBucket = "output";
  let bestVal = outputCost;
  const candidates: [TokenBucket, number][] = [
    ["input", inputCost],
    ["cache_read", cacheReadCost],
    ["cache_write_5m", cacheWrite5mCost],
    ["cache_write_1h", cacheWrite1hCost],
  ];
  for (const [bucket, val] of candidates) {
    if (val > bestVal) {
      best = bucket;
      bestVal = val;
    }
  }
  return best;
}

function buildTrajectory(messages: Message[]): CacheTurnPoint[] {
  const out: CacheTurnPoint[] = [];
  let cumulative = 0;
  let turnIndex = 0;
  for (const m of messages) {
    if (m.role !== "assistant" || !m.usage) continue;
    turnIndex += 1;
    const p = pricingForModel(m.model);
    const inputCost = (m.usage.inputTokens * p.input) / 1_000_000;
    const outputCost = (m.usage.outputTokens * p.output) / 1_000_000;
    const cacheReadCost = (m.usage.cacheReadTokens * p.cacheRead) / 1_000_000;
    const cacheWrite5mCost =
      (m.usage.cacheWrite5mTokens * p.cacheWrite) / 1_000_000;
    const cacheWrite1hCost =
      (m.usage.cacheWrite1hTokens * p.cacheWrite1h) / 1_000_000;
    const cost =
      inputCost + outputCost + cacheReadCost + cacheWrite5mCost + cacheWrite1hCost;
    cumulative += cost;
    out.push({
      turnIndex,
      model: m.model ?? null,
      cost,
      cumulativeCost: cumulative,
      inputTokens: m.usage.inputTokens,
      outputTokens: m.usage.outputTokens,
      cacheReadTokens: m.usage.cacheReadTokens,
      cacheWrite5mTokens: m.usage.cacheWrite5mTokens,
      cacheWrite1hTokens: m.usage.cacheWrite1hTokens,
      dominantBucket: dominantBucket(
        inputCost,
        outputCost,
        cacheReadCost,
        cacheWrite5mCost,
        cacheWrite1hCost,
      ),
    });
  }
  return out;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Thresholds — tunable. Picked to be conservative; they err toward
// "no recommendation" rather than crying wolf on every session.
const LONG_SESSION_TURNS = 20;
const HEALTHY_CACHE_HIT_RATIO = 0.7;
const RAMP_WARN_RATIO = 3;
const RAMP_CRITICAL_RATIO = 6;

function buildRecommendations(
  report: Omit<CacheSessionReport, "recommendations">,
): CacheRecommendation[] {
  const recs: CacheRecommendation[] = [];

  const bloatSuffix =
    report.aboveBaselineContextCost > 0
      ? ` Above-baseline context cost in this session: ${formatUSD(report.aboveBaselineContextCost)} (${(report.aboveBaselineContextShare * 100).toFixed(0)}% of session cost) — likely recoverable given the drift signal above.`
      : "";

  if (
    report.assistantTurnCount > LONG_SESSION_TURNS &&
    report.cacheHitRatio < HEALTHY_CACHE_HIT_RATIO
  ) {
    recs.push({
      severity: "critical",
      title: "Long session with low cache hit ratio",
      message: `Cache hit ratio is ${(report.cacheHitRatio * 100).toFixed(0)}% across ${report.assistantTurnCount} assistant turns. That means turns are paying full input price for context that should've been cached. Use /clear or /compact between unrelated tasks instead of letting one session drift across topics.${bloatSuffix}`,
    });
  }

  if (report.finalRampRatio >= RAMP_CRITICAL_RATIO) {
    recs.push({
      severity: "critical",
      title: "Cost per turn climbed sharply",
      message: `Late turns in this session cost about ${report.finalRampRatio.toFixed(1)}× as much as early turns. Most of the extra is cumulative cache_read on a growing context window. Split the session at the topic boundary or run /clear to drop history that isn't needed anymore.${bloatSuffix}`,
    });
  } else if (report.finalRampRatio >= RAMP_WARN_RATIO) {
    recs.push({
      severity: "warn",
      title: "Cost per turn climbing",
      message: `Late turns cost about ${report.finalRampRatio.toFixed(1)}× the early-session baseline. Cache_read on a growing context is doing the work. Consider splitting at task boundaries when one session drifts into a new topic.${bloatSuffix}`,
    });
  }

  if (
    report.cacheReadTokens > 0 &&
    report.cacheWrite5mTokens > report.cacheReadTokens
  ) {
    recs.push({
      severity: "info",
      title: "Cache is churning (5-minute TTL expiring)",
      message: `5-minute cache writes (${report.cacheWrite5mTokens.toLocaleString()} tokens) exceed cache reads (${report.cacheReadTokens.toLocaleString()}). The session is rebuilding cache more often than reusing it — usually caused by long pauses between turns or by prompt prefixes that change shape between calls.`,
    });
  }

  return recs;
}

export function computeCacheReport(messages: Message[]): CacheSessionReport {
  const trajectory = buildTrajectory(messages);

  let totalCost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWrite5mTokens = 0;
  let cacheWrite1hTokens = 0;
  let cacheReadCost = 0;

  for (const point of trajectory) {
    totalCost += point.cost;
    inputTokens += point.inputTokens;
    outputTokens += point.outputTokens;
    cacheReadTokens += point.cacheReadTokens;
    cacheWrite5mTokens += point.cacheWrite5mTokens;
    cacheWrite1hTokens += point.cacheWrite1hTokens;
  }

  // Recompute cacheReadCost from the aggregate (rather than summing per-turn
  // again) — small but keeps the precision consistent with totalCost.
  for (const m of messages) {
    if (m.role !== "assistant" || !m.usage) continue;
    const p = pricingForModel(m.model);
    cacheReadCost += (m.usage.cacheReadTokens * p.cacheRead) / 1_000_000;
  }

  const cacheHitDenom = inputTokens + cacheReadTokens;
  const cacheHitRatio = cacheHitDenom > 0 ? cacheReadTokens / cacheHitDenom : 0;
  const cacheReadCostShare = totalCost > 0 ? cacheReadCost / totalCost : 0;

  const baselineSample = trajectory.slice(0, 3).map((p) => p.cost);
  const baselineTurnCost = median(baselineSample);
  const tailSample = trajectory.slice(-3).map((p) => p.cost);
  const tailMeanCost = mean(tailSample);
  const finalRampRatio =
    baselineTurnCost > 0 ? tailMeanCost / baselineTurnCost : 0;

  // Per-turn cache_read cost (priced at each turn's actual model rate).
  const perTurnCacheReadCost = trajectory.map((p) => {
    const pricing = pricingForModel(p.model ?? undefined);
    return (p.cacheReadTokens * pricing.cacheRead) / 1_000_000;
  });
  const baselineCacheReadCost = median(perTurnCacheReadCost.slice(0, 3));
  let aboveBaselineContextCost = 0;
  for (const cost of perTurnCacheReadCost) {
    aboveBaselineContextCost += Math.max(0, cost - baselineCacheReadCost);
  }
  const aboveBaselineContextShare =
    totalCost > 0 ? aboveBaselineContextCost / totalCost : 0;

  // Cost-checksum sanity: sum of per-turn costs should equal
  // sum of costForUsage(model, usage). Recompute totalCost the second way as
  // the source of truth and overwrite trajectory's sum (any rounding drift
  // ends up in totalCost, which is what the UI displays).
  let totalCostCheck = 0;
  for (const m of messages) {
    if (m.role !== "assistant" || !m.usage) continue;
    totalCostCheck += costForUsage(m.model, m.usage);
  }

  const baseReport = {
    assistantTurnCount: trajectory.length,
    totalCost: totalCostCheck,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWrite5mTokens,
    cacheWrite1hTokens,
    cacheHitRatio,
    cacheReadCost,
    cacheReadCostShare,
    baselineCacheReadCost,
    aboveBaselineContextCost,
    aboveBaselineContextShare,
    // Filled in after we know if drift signals fired.
    recoverableBloatCost: 0,
    trajectory,
    baselineTurnCost,
    finalRampRatio,
  };

  const recommendations = buildRecommendations(baseReport);
  const driftDetected = recommendations.some(
    (r) => r.severity === "critical" || r.severity === "warn",
  );

  return {
    ...baseReport,
    recoverableBloatCost: driftDetected ? aboveBaselineContextCost : 0,
    recommendations,
  };
}
