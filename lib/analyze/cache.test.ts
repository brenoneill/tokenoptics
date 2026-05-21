import { describe, expect, it } from "vitest";

import {
  cacheHealthFromReport,
  computeCacheHealth,
  computeCacheReport,
} from "@/lib/analyze/cache";
import type { Message, Usage } from "@/lib/types";

// --- fixture helpers --------------------------------------------------------
// computeCacheReport only reads role / model / usage, but the Message type
// requires the full shape — these helpers fill in the inert fields. Token
// counts are chosen to land each scenario on a specific drift threshold; see
// the thresholds in cache.ts (LONG_SESSION_TURNS, RAMP_WARN_RATIO, etc.).

let seq = 0;

function assistantTurn(
  usage: Partial<Usage>,
  model = "claude-opus-4-7",
): Message {
  seq += 1;
  return {
    uuid: `a${seq}`,
    parentUuid: null,
    role: "assistant",
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    model,
    blocks: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWrite5mTokens: 0,
      cacheWrite1hTokens: 0,
      ...usage,
    },
  };
}

function userTurn(): Message {
  seq += 1;
  return {
    uuid: `u${seq}`,
    parentUuid: null,
    role: "user",
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    blocks: [],
  };
}

// cache_read tokens per turn for the two ramp scenarios. The first three turns
// are deliberately small so they set a low baseline (docs trigger A/B).
const SHARP_RAMP_CACHE_READ = [
  20_000, 20_000, 20_000, 80_000, 140_000, 220_000, 320_000, 440_000, 560_000,
  700_000, 820_000, 940_000,
];
const CLIMBING_CACHE_READ = [
  20_000, 20_000, 20_000, 40_000, 60_000, 80_000, 100_000, 120_000, 140_000,
  160_000, 170_000, 180_000,
];

function sessionFromCacheReads(reads: number[]): Message[] {
  return reads.map((cacheReadTokens) =>
    assistantTurn({ cacheReadTokens, outputTokens: 600 }),
  );
}

describe("computeCacheReport — bloat metrics", () => {
  it("sharp ramp → critical 'climbed sharply' and recoverable bloat", () => {
    // Trigger A: trivial opening turns, then context grows unchecked for a
    // dozen turns — late turns cost many times the early baseline.
    const report = computeCacheReport(
      sessionFromCacheReads(SHARP_RAMP_CACHE_READ),
    );

    expect(report.assistantTurnCount).toBe(12);
    expect(report.finalRampRatio).toBeGreaterThanOrEqual(6);
    expect(report.recommendations).toHaveLength(1);

    const [rec] = report.recommendations;
    expect(rec.severity).toBe("critical");
    expect(rec.title).toBe("Cost per turn climbed sharply");

    // Drift fired, so the recoverable figure equals the raw above-baseline one.
    expect(report.aboveBaselineContextCost).toBeGreaterThan(0);
    expect(report.recoverableBloatCost).toBe(report.aboveBaselineContextCost);

    expect(cacheHealthFromReport(report)).toBe("poor");
  });

  it("bloat suffix uses the 'unnecessary spend / likely recoverable' wording", () => {
    // Regression guard: the suffix must not revert to "Above-baseline context
    // cost", and must stay aligned with the CacheSummary hero card wording.
    const report = computeCacheReport(
      sessionFromCacheReads(SHARP_RAMP_CACHE_READ),
    );
    const [rec] = report.recommendations;

    expect(rec.message).toContain("Estimated unnecessary spend");
    expect(rec.message).toContain("likely recoverable");
    expect(rec.message).not.toContain("Above-baseline");
  });

  it("moderate ramp → warn 'climbing' and recoverable bloat", () => {
    // Trigger B: a normal long session — context grows, but no giant pastes.
    const report = computeCacheReport(
      sessionFromCacheReads(CLIMBING_CACHE_READ),
    );

    expect(report.finalRampRatio).toBeGreaterThanOrEqual(3);
    expect(report.finalRampRatio).toBeLessThan(6);
    expect(report.recommendations).toHaveLength(1);
    expect(report.recommendations[0].severity).toBe("warn");
    expect(report.recommendations[0].title).toBe("Cost per turn climbing");

    expect(report.recoverableBloatCost).toBeGreaterThan(0);
    expect(report.recoverableBloatCost).toBe(report.aboveBaselineContextCost);

    expect(cacheHealthFromReport(report)).toBe("climbing");
  });

  it("long session + low cache hit ratio → critical, $0 recoverable when flat", () => {
    // Trigger C: 25 turns, half the context paid as fresh input every turn so
    // the hit ratio sits at 0.5. Cost is flat — drift is detected, but with no
    // above-baseline growth there is nothing to recover.
    const turns = Array.from({ length: 25 }, () =>
      assistantTurn({
        inputTokens: 50_000,
        cacheReadTokens: 50_000,
        outputTokens: 500,
      }),
    );
    const report = computeCacheReport(turns);

    expect(report.assistantTurnCount).toBe(25);
    expect(report.cacheHitRatio).toBeCloseTo(0.5);
    expect(report.recommendations).toHaveLength(1);

    const [rec] = report.recommendations;
    expect(rec.severity).toBe("critical");
    expect(rec.title).toBe("Long session with low cache hit ratio");

    // Flat session: no growth above baseline, so nothing is recoverable even
    // though a drift signal fired — and the suffix is omitted.
    expect(report.aboveBaselineContextCost).toBe(0);
    expect(report.recoverableBloatCost).toBe(0);
    expect(rec.message).not.toContain("Estimated unnecessary spend");

    expect(cacheHealthFromReport(report)).toBe("poor");
  });

  it("cache churning → info only, no drift, $0 recoverable", () => {
    // 5-minute cache writes exceed cache reads — the session rebuilds cache
    // faster than it reuses it. Informational only, never a drift signal.
    const turns = Array.from({ length: 8 }, () =>
      assistantTurn({
        inputTokens: 2_000,
        cacheReadTokens: 10_000,
        cacheWrite5mTokens: 30_000,
        outputTokens: 500,
      }),
    );
    const report = computeCacheReport(turns);

    expect(report.recommendations).toHaveLength(1);
    expect(report.recommendations[0].severity).toBe("info");
    expect(report.recommendations[0].title).toContain("churning");
    expect(report.recommendations[0].message).not.toContain(
      "Estimated unnecessary spend",
    );
    expect(report.recoverableBloatCost).toBe(0);
    expect(cacheHealthFromReport(report)).toBe("good");
  });

  it("healthy session → no recommendations, $0 recoverable", () => {
    const turns = Array.from({ length: 10 }, () =>
      assistantTurn({
        inputTokens: 3_000,
        cacheReadTokens: 60_000,
        cacheWrite5mTokens: 5_000,
        outputTokens: 800,
      }),
    );
    const report = computeCacheReport(turns);

    expect(report.recommendations).toHaveLength(0);
    expect(report.recoverableBloatCost).toBe(0);
    expect(computeCacheHealth(turns)).toBe("good");
  });

  it("above-baseline growth without a drift signal → $0 recoverable (gating)", () => {
    // The core "above-baseline is not inherently waste" guarantee: cache_read
    // climbs above the early baseline, so aboveBaselineContextCost is positive,
    // but the ramp stays under 3× — no drift fires, so recoverableBloatCost
    // stays $0.
    const reads = [
      20_000, 20_000, 20_000, 30_000, 35_000, 40_000, 45_000, 50_000, 55_000,
      60_000,
    ];
    const report = computeCacheReport(
      reads.map((cacheReadTokens) =>
        assistantTurn({ cacheReadTokens, outputTokens: 2_000 }),
      ),
    );

    expect(report.recommendations).toHaveLength(0);
    expect(report.aboveBaselineContextCost).toBeGreaterThan(0);
    expect(report.recoverableBloatCost).toBe(0);
  });

  it("session too short to classify → null health", () => {
    const turns = Array.from({ length: 3 }, () =>
      assistantTurn({
        inputTokens: 1_000,
        cacheReadTokens: 10_000,
        outputTokens: 200,
      }),
    );
    expect(cacheHealthFromReport(computeCacheReport(turns))).toBeNull();
  });

  it("ignores user messages and assistant turns without usage", () => {
    const noUsage = assistantTurn({});
    noUsage.usage = undefined;
    const messages: Message[] = [
      userTurn(),
      assistantTurn({ cacheReadTokens: 10_000, outputTokens: 300 }),
      userTurn(),
      noUsage,
      assistantTurn({ cacheReadTokens: 12_000, outputTokens: 300 }),
    ];
    const report = computeCacheReport(messages);
    expect(report.assistantTurnCount).toBe(2);
  });
});
