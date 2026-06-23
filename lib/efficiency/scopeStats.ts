import { groupMessages, userPromptText } from "../transcript";
import type { Message } from "../types";

export interface ScopeStats {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  // Kiro sessions meter in credits, not tokens. credits > 0 (and isCredits)
  // marks a credit-based session so the UI can show credit-native stats
  // instead of the always-zero token counts.
  credits: number;
  isCredits: boolean;
  messageCount: number;
  promptCount: number;
  linesAdded: number;
  linesRemoved: number;
  linesRewritten: number;
  diffCount: number;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number;
}

export function computeScopeStats(messages: Message[]): ScopeStats {
  let cost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let credits = 0;
  let promptCount = 0;
  let firstMs = Number.POSITIVE_INFINITY;
  let lastMs = Number.NEGATIVE_INFINITY;
  let firstIso: string | null = null;
  let lastIso: string | null = null;

  for (const m of messages) {
    if (typeof m.cost === "number") cost += m.cost;
    if (m.usage) {
      inputTokens += m.usage.inputTokens;
      outputTokens += m.usage.outputTokens;
      cacheReadTokens += m.usage.cacheReadTokens;
      cacheWriteTokens += m.usage.cacheWrite5mTokens + m.usage.cacheWrite1hTokens;
      credits += m.usage.credits ?? 0;
    }
    if (m.role === "user" && userPromptText(m)) promptCount += 1;

    const ms = Date.parse(m.timestamp);
    if (!Number.isNaN(ms)) {
      if (ms < firstMs) {
        firstMs = ms;
        firstIso = m.timestamp;
      }
      if (ms > lastMs) {
        lastMs = ms;
        lastIso = m.timestamp;
      }
    }
  }

  let linesAdded = 0;
  let linesRemoved = 0;
  let linesRewritten = 0;
  let diffCount = 0;
  for (const item of groupMessages(messages)) {
    if (item.kind !== "fold") continue;
    linesAdded += item.addedLines;
    linesRemoved += item.removedLines;
    linesRewritten += item.rewrittenLines;
    diffCount += item.diffCount;
  }

  const durationMs =
    firstIso && lastIso ? Math.max(0, lastMs - firstMs) : 0;

  return {
    cost,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    credits,
    isCredits: credits > 0,
    messageCount: messages.length,
    promptCount,
    linesAdded,
    linesRemoved,
    linesRewritten,
    diffCount,
    startedAt: firstIso,
    endedAt: lastIso,
    durationMs,
  };
}
