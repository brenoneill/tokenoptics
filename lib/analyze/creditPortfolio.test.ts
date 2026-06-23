import { describe, expect, it } from "vitest";

import { computeCreditPortfolio } from "@/lib/analyze/creditPortfolio";
import type { ConversationSummary } from "@/lib/types";

function conv(
  endedAt: string,
  totalCredits: number,
): ConversationSummary {
  return {
    projectId: "p",
    sessionId: `s-${endedAt}-${totalCredits}`,
    title: "t",
    cwd: "/x",
    startedAt: endedAt,
    endedAt,
    messageCount: 1,
    primaryModel: "claude-opus-4.6",
    totalCost: totalCredits * 0.04,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalCredits,
    cacheHealth: null,
  };
}

describe("computeCreditPortfolio", () => {
  it("buckets credits by billing month and sorts chronologically", () => {
    const r = computeCreditPortfolio(
      [
        conv("2026-03-10T00:00:00Z", 500),
        conv("2026-03-25T00:00:00Z", 700),
        conv("2026-04-02T00:00:00Z", 200),
      ],
      "pro",
    );
    expect(r.months.map((m) => m.month)).toEqual(["2026-03", "2026-04"]);
    expect(r.months[0].credits).toBe(1200);
    expect(r.months[0].label).toBe("Mar 2026");
    expect(r.monthsActive).toBe(2);
    expect(r.totalCredits).toBe(1400);
  });

  it("applies plan allotment + overage per month (Pro = 1000 included)", () => {
    const r = computeCreditPortfolio([conv("2026-03-10T00:00:00Z", 1200)], "pro");
    const march = r.months[0];
    expect(march.cost.overageCredits).toBe(200);
    expect(march.cost.total).toBeCloseTo(20 + 200 * 0.04, 10); // $28
    // totalCost = sum of each active month's flat fee + overage
    expect(r.totalCost).toBeCloseTo(28, 10);
  });

  it("ignores sessions without credits", () => {
    const r = computeCreditPortfolio(
      [conv("2026-03-10T00:00:00Z", 0), conv("2026-03-11T00:00:00Z", 50)],
      "pro",
    );
    expect(r.totalCredits).toBe(50);
    expect(r.months[0].sessionCount).toBe(1);
  });

  it("identifies the busiest month", () => {
    const r = computeCreditPortfolio(
      [conv("2026-03-10T00:00:00Z", 100), conv("2026-05-10T00:00:00Z", 900)],
      "pro",
    );
    expect(r.busiestMonth?.month).toBe("2026-05");
  });
});
