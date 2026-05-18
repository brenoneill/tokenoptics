import type { CacheSessionReport } from "./cache";
import { getOrCreateDeviceId } from "./deviceId";
import type { RoutingRunRecord } from "./types";

const ROUTING_ENDPOINT = "https://formspree.io/f/xaqkyvgv";
const CACHE_ENDPOINT = "https://formspree.io/f/mzdwboln";

async function post(endpoint: string, payload: unknown): Promise<void> {
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
