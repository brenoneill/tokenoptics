import { userPromptText } from "../transcript";
import type { Message } from "../types";
import { computeDiffStatsForSpan } from "./diffs";
import { tierForModel } from "./shape";
import type {
  RequestSpanShape,
  SpanClassification,
  TurnEfficiencyResult,
  TurnTier,
} from "./types";

export interface RawSpan {
  userMessage: Message;
  userPromptPreview: string;
  startIdx: number;
  endIdx: number;
  assistantMessages: Message[];
}

const PREVIEW_MAX_LENGTH = 240;

function buildPreview(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, PREVIEW_MAX_LENGTH - 1)}…`;
}

export function extractRequestSpans(messages: Message[]): RawSpan[] {
  const spans: RawSpan[] = [];
  let current: RawSpan | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "user") {
      const promptText = userPromptText(msg);
      if (promptText !== null) {
        if (current) {
          current.endIdx = i - 1;
          spans.push(current);
        }
        current = {
          userMessage: msg,
          userPromptPreview: buildPreview(promptText),
          startIdx: i,
          endIdx: i,
          assistantMessages: [],
        };
        continue;
      }
    }
    if (current && msg.role === "assistant") {
      current.assistantMessages.push(msg);
    }
  }

  if (current) {
    current.endIdx = messages.length - 1;
    spans.push(current);
  }

  return spans;
}

export interface SpanShapeInput {
  span: RawSpan;
  turnsByUuid: Map<string, TurnEfficiencyResult>;
}

export function buildSpanShape({
  span,
  turnsByUuid,
}: SpanShapeInput): RequestSpanShape {
  let totalToolUseCount = 0;
  let totalTextChars = 0;
  let totalThinkingTokensEstimate = 0;
  let anyHadThinking = false;
  let anyHadErrorRecovery = false;
  let mechFalse = false;
  let mechTrueCount = 0;
  let mechEvaluable = 0;
  let actualCost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWrite5mTokens = 0;
  let cacheWrite1hTokens = 0;
  let actualModel: string | undefined;
  let actualTier: TurnTier | undefined;
  let endMsgUuid = span.userMessage.uuid;

  for (const msg of span.assistantMessages) {
    const turn = turnsByUuid.get(msg.uuid);
    if (!turn) continue;
    const s = turn.shape;
    totalToolUseCount += s.toolUseCount;
    totalTextChars += s.textChars;
    totalThinkingTokensEstimate += s.thinkingTokensEstimate;
    anyHadThinking = anyHadThinking || s.hadThinking;
    anyHadErrorRecovery = anyHadErrorRecovery || s.hadErrorRecovery;
    if (turn.mechanicalSuccess === false) mechFalse = true;
    if (turn.mechanicalSuccess !== null) {
      mechEvaluable++;
      if (turn.mechanicalSuccess) mechTrueCount++;
    }
    actualCost += s.actualCost;
    inputTokens += s.inputTokens;
    outputTokens += s.outputTokens;
    cacheReadTokens += s.cacheReadTokens;
    cacheWrite5mTokens += s.cacheWrite5mTokens;
    cacheWrite1hTokens += s.cacheWrite1hTokens;
    if (!actualModel && s.actualModel) {
      actualModel = s.actualModel;
      actualTier = s.actualTier ?? tierForModel(s.actualModel);
    }
    endMsgUuid = msg.uuid;
  }

  const allMechanicalSuccess: boolean | null = mechFalse
    ? false
    : mechEvaluable === 0
      ? null
      : mechTrueCount === mechEvaluable
        ? true
        : null;

  const diffStats = computeDiffStatsForSpan(span.assistantMessages);

  return {
    userMsgUuid: span.userMessage.uuid,
    userPromptPreview: span.userPromptPreview,
    startMsgUuid: span.userMessage.uuid,
    endMsgUuid,
    assistantTurnCount: span.assistantMessages.length,
    totalToolUseCount,
    totalTextChars,
    totalThinkingTokensEstimate,
    anyHadThinking,
    anyHadErrorRecovery,
    allMechanicalSuccess,
    diffStats,
    actualCost,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWrite5mTokens,
    cacheWrite1hTokens,
    actualModel,
    actualTier,
  };
}

export const SPAN_THRESHOLDS = {
  // Pure-text fallback (no edits at all in the span)
  haikuMaxTextCharsNoEdit: 300,
  // Diff-based thresholds — primary signal once edits exist.
  // linesChanged = lines added + lines removed. A 1-line replace counts as 2.
  haikuMaxEdits: 1,
  haikuMaxFiles: 1,
  haikuMaxLinesChanged: 4,
  sonnetMaxEdits: 3,
  sonnetMaxFiles: 1,
  sonnetMaxLinesChanged: 12,
} as const;

// Stage 1 span classification, default-Opus framing.
//
// Diff size is the primary signal: if the user's request only resulted in a
// few lines of code change, the underlying task was trivial regardless of how
// the model approached it (thinking-on-by-default means almost every Opus
// response includes thinking, so thinking presence alone is too noisy a gate
// for small edits).
//
// Hard gate that DOES override the diff signal: error recovery (the model
// had to recover from a tool failure) — direct evidence of real difficulty
// independent of diff size.
//
// Order:
//   1. Hard gate — error recovery → Opus.
//   2. No-edit, single-turn, brief text → haiku (Q&A-style answer).
//   3. Diff size → haiku / sonnet / opus.
export function classifySpan(shape: RequestSpanShape): SpanClassification {
  const d = shape.diffStats;
  const reasons: string[] = [
    `assistantTurns=${shape.assistantTurnCount}`,
    `totalToolUses=${shape.totalToolUseCount}`,
    `totalTextChars=${shape.totalTextChars}`,
    `thinkingTokens≈${shape.totalThinkingTokensEstimate}`,
    `edits=${d.editsCount}`,
    `linesChanged=${d.linesChanged}`,
    `filesAffected=${d.filesAffected}`,
    `anyHadErrorRecovery=${shape.anyHadErrorRecovery}`,
  ];

  if (shape.anyHadErrorRecovery) {
    return {
      verdict: "needed_opus",
      suggestedTier: "opus",
      reasons: [
        ...reasons,
        "error recovery → real difficulty, keep Opus",
      ],
    };
  }

  if (d.editsCount === 0) {
    const isSingleShotTextAnswer =
      shape.assistantTurnCount === 1 &&
      shape.totalToolUseCount === 0 &&
      !shape.anyHadThinking &&
      shape.totalTextChars > 0 &&
      shape.totalTextChars < SPAN_THRESHOLDS.haikuMaxTextCharsNoEdit;
    if (isSingleShotTextAnswer) {
      return {
        verdict: "haiku_sufficient",
        suggestedTier: "haiku",
        reasons: [...reasons, "no edits + single-turn pure-text answer → Q&A"],
      };
    }
    return {
      verdict: "needed_opus",
      suggestedTier: "opus",
      reasons: [
        ...reasons,
        "no edits but multi-turn or tool-using → choice of what to read/grep is judgment",
      ],
    };
  }

  if (
    d.editsCount <= SPAN_THRESHOLDS.haikuMaxEdits &&
    d.filesAffected <= SPAN_THRESHOLDS.haikuMaxFiles &&
    d.linesChanged <= SPAN_THRESHOLDS.haikuMaxLinesChanged
  ) {
    return {
      verdict: "haiku_sufficient",
      suggestedTier: "haiku",
      reasons: [
        ...reasons,
        `single small edit (${d.linesChanged} lines, ${d.filesAffected} file) → trivially mechanical`,
      ],
    };
  }

  if (
    d.editsCount <= SPAN_THRESHOLDS.sonnetMaxEdits &&
    d.filesAffected <= SPAN_THRESHOLDS.sonnetMaxFiles &&
    d.linesChanged <= SPAN_THRESHOLDS.sonnetMaxLinesChanged
  ) {
    return {
      verdict: "sonnet_sufficient",
      suggestedTier: "sonnet",
      reasons: [
        ...reasons,
        `small refactor (${d.editsCount} edits, ${d.linesChanged} lines, ${d.filesAffected} file) → mid-tier`,
      ],
    };
  }

  return {
    verdict: "needed_opus",
    suggestedTier: "opus",
    reasons: [
      ...reasons,
      `substantive diff (${d.editsCount} edits, ${d.linesChanged} lines, ${d.filesAffected} files) → Opus appropriate`,
    ],
  };
}
