import type { TurnClassification, TurnShape, TurnTier } from "./types";

// Stage 1 framing: Opus is the default-correct choice. Stage 1 uses pure
// per-turn shape (text length, tool count, thinking presence, downstream
// errors) — it has no view into the *content* of tool inputs or the prior
// turn's reasoning. Picking which file to Read or what pattern to Grep is
// itself an act of judgment; shape alone can't tell that apart from a
// mechanical follow-up read in a planned sequence. So Stage 1 only flags
// cases where shape itself is dispositive: pure-text acknowledgement turns
// with no tool call. Single-tool turns are deferred to Stage 2 (LLM labeller
// with surrounding context).
export const THRESHOLDS = {
  haikuMaxTextChars: 100,
} as const;

const TIER_RANK: Record<TurnTier, number> = { haiku: 0, sonnet: 1, opus: 2 };

export function isOverspend(actual: TurnTier | undefined, suggested: TurnTier): boolean {
  if (!actual) return false;
  return TIER_RANK[actual] > TIER_RANK[suggested];
}

export interface ClassificationContext {
  mechanicalSuccess: boolean | null;
}

const DEFAULT_CONTEXT: ClassificationContext = {
  mechanicalSuccess: null,
};

export function classifyByShape(
  shape: TurnShape,
  context: ClassificationContext = DEFAULT_CONTEXT,
): TurnClassification {
  const reasons: string[] = [
    `thinkingTokens≈${shape.thinkingTokensEstimate}`,
    `textChars=${shape.textChars}`,
    `toolUseCount=${shape.toolUseCount}`,
    `hadErrorRecovery=${shape.hadErrorRecovery}`,
    `mechanicalSuccess=${context.mechanicalSuccess}`,
  ];

  // Haiku-tier: only pure-text acknowledgements with no tool call. The
  // turn is essentially "ack" — no decision-making, no tool invocation,
  // nothing for Opus's reasoning to contribute.
  const isPureAck =
    !shape.hadThinking &&
    !shape.hadErrorRecovery &&
    shape.toolUseCount === 0 &&
    shape.textChars > 0 &&
    shape.textChars < THRESHOLDS.haikuMaxTextChars;

  if (isPureAck) {
    return {
      verdict: "haiku_sufficient",
      suggestedTier: "haiku",
      reasons: [
        ...reasons,
        "pure-text acknowledgement, no tool call → no judgment required",
      ],
    };
  }

  // Stage 1 cannot reliably distinguish mechanical from intelligent
  // single-tool turns from shape alone (the choice of *what* to read or
  // grep is itself an act of judgment). Defer those to Stage 2.
  return {
    verdict: "needed_opus",
    suggestedTier: "opus",
    reasons: [...reasons, "default: shape alone cannot prove triviality"],
  };
}
