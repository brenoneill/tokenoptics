import { costForCredits } from "../pricing";
import type { Message } from "../types";

// Credit-native analysis for Kiro CLI sessions — the analog of analyze/cache.ts
// for token-based harnesses. Kiro meters in credits (not tokens), so instead of
// "where did the tokens go / how much was cache re-processing" we report how
// credits were spent over the session: per-turn burn and the cumulative curve.

export interface CreditTurnPoint {
  // 1-based index among credit-bearing turns (assistant messages with credits).
  turnIndex: number;
  credits: number;
  cumulativeCredits: number;
  cost: number; // credits × overage rate, for display
  model?: string;
  timestamp: string;
}

export interface CreditSessionReport {
  trajectory: CreditTurnPoint[];
  totalCredits: number;
  totalCost: number;
  turnCount: number;
  meanCreditsPerTurn: number;
  // The single most expensive turn — surfaced as the headline outlier.
  peakTurnIndex: number | null;
  peakCredits: number;
  // Credits grouped by the model that spent them (sessions can switch models).
  byModel: { model: string; credits: number; turns: number }[];
}

export function computeCreditReport(messages: Message[]): CreditSessionReport {
  const trajectory: CreditTurnPoint[] = [];
  const modelCredits = new Map<string, { credits: number; turns: number }>();
  let cumulative = 0;
  let turnIndex = 0;

  for (const m of messages) {
    const credits = m.usage?.credits ?? 0;
    if (credits <= 0) continue;
    turnIndex += 1;
    cumulative += credits;

    trajectory.push({
      turnIndex,
      credits,
      cumulativeCredits: cumulative,
      cost: typeof m.cost === "number" ? m.cost : costForCredits(credits),
      model: m.model,
      timestamp: m.timestamp,
    });

    const key = m.model ?? "unknown";
    const entry = modelCredits.get(key) ?? { credits: 0, turns: 0 };
    entry.credits += credits;
    entry.turns += 1;
    modelCredits.set(key, entry);
  }

  const totalCredits = cumulative;
  const turnCount = trajectory.length;
  const totalCost = trajectory.reduce((sum, p) => sum + p.cost, 0);

  let peakTurnIndex: number | null = null;
  let peakCredits = 0;
  for (const p of trajectory) {
    if (p.credits > peakCredits) {
      peakCredits = p.credits;
      peakTurnIndex = p.turnIndex;
    }
  }

  const byModel = [...modelCredits.entries()]
    .map(([model, v]) => ({ model, credits: v.credits, turns: v.turns }))
    .sort((a, b) => b.credits - a.credits);

  return {
    trajectory,
    totalCredits,
    totalCost,
    turnCount,
    meanCreditsPerTurn: turnCount > 0 ? totalCredits / turnCount : 0,
    peakTurnIndex,
    peakCredits,
    byModel,
  };
}
