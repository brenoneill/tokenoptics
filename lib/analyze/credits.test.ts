import { describe, expect, it } from "vitest";

import { computeCreditReport } from "@/lib/analyze/credits";
import type { Message } from "@/lib/types";

let seq = 0;
function turn(credits: number, model = "claude-opus-4.6"): Message {
  seq += 1;
  return {
    uuid: `m${seq}`,
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
      credits,
    },
    cost: credits * 0.04,
  };
}

describe("computeCreditReport", () => {
  it("builds a cumulative trajectory over credit-bearing turns", () => {
    const r = computeCreditReport([turn(2), turn(3), turn(5)]);
    expect(r.turnCount).toBe(3);
    expect(r.totalCredits).toBe(10);
    expect(r.trajectory.map((p) => p.cumulativeCredits)).toEqual([2, 5, 10]);
    expect(r.totalCost).toBeCloseTo(0.4, 10);
  });

  it("ignores turns without credits", () => {
    const noCredit: Message = { ...turn(0), usage: undefined, cost: undefined };
    const r = computeCreditReport([turn(4), noCredit]);
    expect(r.turnCount).toBe(1);
    expect(r.totalCredits).toBe(4);
  });

  it("identifies the peak turn and mean", () => {
    const r = computeCreditReport([turn(1), turn(9), turn(2)]);
    expect(r.peakTurnIndex).toBe(2);
    expect(r.peakCredits).toBe(9);
    expect(r.meanCreditsPerTurn).toBeCloseTo(4, 10);
  });

  it("groups credits by model, sorted by spend", () => {
    const r = computeCreditReport([
      turn(2, "claude-opus-4.6"),
      turn(1, "claude-sonnet-4.6"),
      turn(5, "claude-opus-4.6"),
    ]);
    expect(r.byModel[0]).toMatchObject({ model: "claude-opus-4.6", credits: 7, turns: 2 });
    expect(r.byModel[1]).toMatchObject({ model: "claude-sonnet-4.6", credits: 1, turns: 1 });
  });
});
