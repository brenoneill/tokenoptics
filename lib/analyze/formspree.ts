import type { CacheSessionReport } from "./cache";
import { getOrCreateDeviceId } from "./deviceId";
import type { RoutingRunRecord } from "./types";

// These endpoints are Formspree form URLs used to collect anonymous aggregate
// statistics for personal routing and cache experiments. They are NEVER active
// in production — submission only happens when the user explicitly clicks
// "Analyze routing" in the conversation view (a dev-only button that is never
// shipped to production builds). No transcript content, prompt text, or
// identifying session data is submitted — only aggregate counts and costs.
// See AGENTS.md §2 (privacy invariant).
//
// Configure via NEXT_PUBLIC_ROUTING_ANALYTICS_ENDPOINT and
// NEXT_PUBLIC_CACHE_ANALYTICS_ENDPOINT in .env.local. If either var is absent
// the submission is silently skipped so the UI never breaks in prod.
const ROUTING_ENDPOINT = process.env.NEXT_PUBLIC_ROUTING_ANALYTICS_ENDPOINT ?? "";
const CACHE_ENDPOINT = process.env.NEXT_PUBLIC_CACHE_ANALYTICS_ENDPOINT ?? "";

async function post(endpoint: string, payload: unknown): Promise<void> {
  if (!endpoint) return; // endpoint absent in prod — skip silently
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[formspree] non-OK response", res.status, endpoint);
    }
  } catch (err) {
    console.warn("[formspree] submission failed", endpoint, err);
  }
}

export async function submitRoutingResults(
  run: RoutingRunRecord,
  primaryModel: string,
): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const s = run.summary;
  await post(ROUTING_ENDPOINT, {
    deviceId,
    submittedAt: Date.now(),
    primaryModel,
    promptCount: s.totalUserPrompts,
    classifiedCount: s.classifiedCount,
    actualCost: s.actualCost,
    recommendedCost: s.recommendedCost,
    totalSavings: s.totalSavings,
    underSpeccedDelta: s.underSpeccedDelta,
    alignedCount: s.alignedCount,
    savingsCount: s.savingsCount,
    underSpeccedCount: s.underSpeccedCount,
  });
}

export async function submitCacheResults(
  report: CacheSessionReport,
  primaryModel: string,
): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const counts = { critical: 0, warn: 0, info: 0 };
  for (const r of report.recommendations) counts[r.severity] += 1;
  await post(CACHE_ENDPOINT, {
    deviceId,
    submittedAt: Date.now(),
    primaryModel,
    assistantTurnCount: report.assistantTurnCount,
    totalCost: report.totalCost,
    cacheHitRatio: report.cacheHitRatio,
    cacheReadCost: report.cacheReadCost,
    cacheReadCostShare: report.cacheReadCostShare,
    aboveBaselineContextCost: report.aboveBaselineContextCost,
    aboveBaselineContextShare: report.aboveBaselineContextShare,
    recoverableBloatCost: report.recoverableBloatCost,
    recommendationCounts: counts,
  });
}
