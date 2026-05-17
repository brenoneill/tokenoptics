// Walks a session's messages to build per-prompt "spans": one genuine user
// prompt + every assistant turn that followed it before the next genuine user
// prompt. Slash commands and tool-result-only user messages are skipped.
//
// Each span carries the tail of the prior assistant message as
// `priorAssistantContext`, which the classifier uses to recognize replies /
// continuations — short ("yes", "A") AND longer ("yes, but also add the
// helper test"). When the classifier returns label="continuation", the
// merging pass in mergeContinuations() folds the span into the prior bucket
// so the work attributes to whatever model was already running. (Claude
// Code doesn't let the user switch model mid-task, so continuations aren't
// independently routable.)

import { CONTINUATION_LABEL, type ClassifiedLabel } from "./anthropic";
import { costForUsage, pricingForModel } from "../pricing";
import { userPromptText } from "../transcript";
import type { Message, Usage } from "../types";
import {
  LABEL_TO_MODEL,
  LABEL_TO_TIER,
  compareTiers,
  scaleUsageForTier,
  tierForModel,
  type RoutingLabel,
} from "./routing";
import type { ResponseFeatures, RoutingTurnRecord } from "./types";

const ZERO_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
};

export interface PromptSpan {
  userMessage: Message;
  promptText: string;
  assistantMessages: Message[];
  // User replies to an assistant question/proposal that got folded into
  // this span by the merging pass. Surfaced for transparency in the UI.
  followUpReplies: Message[];
  // Tail of the assistant's last visible text before this user prompt.
  // The classifier reads this to decide whether the user is replying to
  // the assistant ("continuation") or starting a fresh task. Null on the
  // first prompt of a session.
  priorAssistantContext: string | null;
}

function isSlashCommand(message: Message): boolean {
  for (const block of message.blocks) {
    if (block.kind === "text" && /<command-name>/.test(block.text)) return true;
  }
  return false;
}

const PRIOR_CONTEXT_MAX_CHARS = 1200;

function assistantTextTail(m: Message): string | null {
  const parts: string[] = [];
  for (const block of m.blocks) {
    if (block.kind === "text" && block.text.trim()) parts.push(block.text);
  }
  if (parts.length === 0) return null;
  const full = parts.join("\n").trim();
  if (!full) return null;
  if (full.length <= PRIOR_CONTEXT_MAX_CHARS) return full;
  return `…${full.slice(-PRIOR_CONTEXT_MAX_CHARS)}`;
}

// Distills the assistant work that followed a user prompt into a few numeric
// signals the classifier can use. We pass these to Haiku so it judges intent
// in light of what the assistant actually had to do — not just the prompt text.
export function extractResponseFeatures(span: PromptSpan): ResponseFeatures {
  let toolUseCount = 0;
  let toolErrorCount = 0;
  let thinkingUsed = false;
  let textChars = 0;
  const toolNames = new Set<string>();

  for (const m of span.assistantMessages) {
    for (const block of m.blocks) {
      if (block.kind === "text") {
        textChars += block.text.length;
      } else if (block.kind === "thinking") {
        thinkingUsed = true;
      } else if (block.kind === "tool_use") {
        toolUseCount++;
        toolNames.add(block.name);
      } else if (block.kind === "tool_result" && block.isError) {
        toolErrorCount++;
      }
    }
  }

  return {
    assistantTurnCount: span.assistantMessages.length,
    toolUseCount,
    toolErrorCount,
    thinkingUsed,
    textChars,
    distinctToolNames: Array.from(toolNames).sort(),
  };
}

export function extractPromptSpans(messages: Message[]): PromptSpan[] {
  const out: PromptSpan[] = [];
  let current: PromptSpan | null = null;
  let lastAssistantTail: string | null = null;

  for (const m of messages) {
    if (m.role === "user") {
      const text = userPromptText(m);
      if (text && !isSlashCommand(m)) {
        if (current) out.push(current);
        current = {
          userMessage: m,
          promptText: text,
          assistantMessages: [],
          followUpReplies: [],
          priorAssistantContext: lastAssistantTail,
        };
      }
      // tool_result-only user messages and slash commands are skipped:
      // they belong to the previous span's continuation.
      continue;
    }
    if (m.role === "assistant" && current) {
      current.assistantMessages.push(m);
      const tail = assistantTextTail(m);
      if (tail) lastAssistantTail = tail;
    }
  }
  if (current) out.push(current);
  return out;
}

function addUsage(a: Usage, b: Usage | undefined): Usage {
  if (!b) return a;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWrite5mTokens: a.cacheWrite5mTokens + b.cacheWrite5mTokens,
    cacheWrite1hTokens: a.cacheWrite1hTokens + b.cacheWrite1hTokens,
  };
}

// Aggregate per-model spend across the assistant turns, return the model that
// accounts for the most actual cost. Used as the span's "actual model" when
// classifying overspend/savings.
function dominantModel(messages: Message[]): {
  model: string | null;
  usage: Usage;
  cost: number;
} {
  const perModel = new Map<string, { usage: Usage; cost: number }>();
  let totalUsage: Usage = { ...ZERO_USAGE };
  let totalCost = 0;

  for (const m of messages) {
    const u = m.usage ?? ZERO_USAGE;
    totalUsage = addUsage(totalUsage, u);
    const c = costForUsage(m.model, u);
    totalCost += c;
    if (m.model) {
      const prior = perModel.get(m.model);
      if (prior) {
        prior.usage = addUsage(prior.usage, u);
        prior.cost += c;
      } else {
        perModel.set(m.model, { usage: { ...u }, cost: c });
      }
    }
  }

  let dominant: string | null = null;
  let dominantCost = -1;
  for (const [model, agg] of perModel) {
    if (agg.cost > dominantCost) {
      dominant = model;
      dominantCost = agg.cost;
    }
  }
  return { model: dominant, usage: totalUsage, cost: totalCost };
}

export function buildTurnRecord(
  span: PromptSpan,
  classification: { label: RoutingLabel; reasoning: string; usage: { inputTokens: number; outputTokens: number } },
  features: ResponseFeatures,
): RoutingTurnRecord {
  const recommendedModel = LABEL_TO_MODEL[classification.label];
  const recommendedTier = LABEL_TO_TIER[classification.label];
  const { model: actualModel, usage, cost: actualCost } = dominantModel(
    span.assistantMessages,
  );
  const actualTier = tierForModel(actualModel ?? undefined);
  const comparison = compareTiers(actualTier, recommendedTier);

  // The recommended model would not produce the same number of output tokens.
  // Scale output by an empirical tier-to-tier ratio before pricing the
  // counterfactual; input/cache stay constant since the prompt is unchanged.
  const { usage: scaledUsage, outputRatio } = scaleUsageForTier(
    usage,
    actualTier,
    recommendedTier,
  );
  const counterfactualCost = costForUsage(recommendedModel, scaledUsage);
  const savings = comparison === "savings" ? Math.max(0, actualCost - counterfactualCost) : 0;
  const underspendDelta =
    comparison === "under_specced" ? Math.max(0, counterfactualCost - actualCost) : 0;

  const promptPreview = span.promptText.slice(0, 320);

  return {
    userMsgUuid: span.userMessage.uuid,
    promptPreview,
    promptCharCount: span.promptText.length,
    label: classification.label,
    reasoning: classification.reasoning,
    actualModel,
    actualTier,
    recommendedModel,
    recommendedTier,
    comparison,
    usage,
    counterfactualUsage: scaledUsage,
    outputRatio,
    actualCost,
    counterfactualCost,
    savings,
    underspendDelta,
    classifierInputTokens: classification.usage.inputTokens,
    classifierOutputTokens: classification.usage.outputTokens,
    assistantTurnCount: span.assistantMessages.length,
    followUpReplyCount: span.followUpReplies.length,
    features,
  };
}

// Walks classified spans in order, folding any span labeled "continuation"
// into the preceding bucket. Each bucket produces exactly one turn record.
//
// A continuation span contributes:
//   - its userMessage to the bucket's followUpReplies
//   - its assistantMessages to the bucket's assistantMessages
//   - its classifier input/output tokens to the bucket's classifier cost
//
// Edge case: if the first span comes back as "continuation" (no prior bucket
// to fold into), we degrade it to "default_implementation" so the prompt
// still surfaces in the output. This is rare in practice but worth handling.
export interface ClassifiedSpan {
  span: PromptSpan;
  classification: {
    label: ClassifiedLabel;
    reasoning: string;
    usage: { inputTokens: number; outputTokens: number };
  };
}

interface MergeBucket {
  lead: PromptSpan;
  leadLabel: RoutingLabel;
  leadReasoning: string;
  assistantMessages: Message[];
  followUpReplies: Message[];
  classifierInput: number;
  classifierOutput: number;
}

export function mergeContinuations(items: ClassifiedSpan[]): RoutingTurnRecord[] {
  const turns: RoutingTurnRecord[] = [];
  let bucket: MergeBucket | null = null;

  const finalize = () => {
    if (!bucket) return;
    const enriched: PromptSpan = {
      userMessage: bucket.lead.userMessage,
      promptText: bucket.lead.promptText,
      assistantMessages: bucket.assistantMessages,
      followUpReplies: bucket.followUpReplies,
      priorAssistantContext: bucket.lead.priorAssistantContext,
    };
    const features = extractResponseFeatures(enriched);
    turns.push(
      buildTurnRecord(
        enriched,
        {
          label: bucket.leadLabel,
          reasoning: bucket.leadReasoning,
          usage: {
            inputTokens: bucket.classifierInput,
            outputTokens: bucket.classifierOutput,
          },
        },
        features,
      ),
    );
    bucket = null;
  };

  for (const { span, classification } of items) {
    if (classification.label === CONTINUATION_LABEL) {
      if (bucket) {
        bucket.followUpReplies.push(span.userMessage);
        bucket.assistantMessages.push(...span.assistantMessages);
        bucket.classifierInput += classification.usage.inputTokens;
        bucket.classifierOutput += classification.usage.outputTokens;
        continue;
      }
      // No prior bucket — degrade to a routable label so the span still
      // appears in the output instead of being silently dropped.
      finalize();
      bucket = {
        lead: span,
        leadLabel: "default_implementation",
        leadReasoning:
          classification.reasoning ||
          "Classified as continuation with no prior task to fold into; routed as default_implementation.",
        assistantMessages: [...span.assistantMessages],
        followUpReplies: [],
        classifierInput: classification.usage.inputTokens,
        classifierOutput: classification.usage.outputTokens,
      };
      continue;
    }
    finalize();
    bucket = {
      lead: span,
      leadLabel: classification.label,
      leadReasoning: classification.reasoning,
      assistantMessages: [...span.assistantMessages],
      followUpReplies: [],
      classifierInput: classification.usage.inputTokens,
      classifierOutput: classification.usage.outputTokens,
    };
  }
  finalize();
  return turns;
}

// Rough upfront cost estimate so the UI can preview "this run will cost ~$X".
// Uses Haiku 4.5 input rate × prompt-char/4 token estimate + a fixed overhead
// for the system prompt and response-signal block (~700 tokens per call).
export function estimateClassifierCost(spans: PromptSpan[]): number {
  if (spans.length === 0) return 0;
  const haiku = pricingForModel("claude-haiku-4-5");
  const PER_CALL_OVERHEAD_TOKENS = 700;
  const estInputTokensPerPrompt =
    spans.reduce((sum, s) => sum + Math.ceil(s.promptText.length / 4), 0) /
      spans.length +
    PER_CALL_OVERHEAD_TOKENS;
  const estOutputTokensPerPrompt = 60;
  const inputCost = (estInputTokensPerPrompt * haiku.input) / 1_000_000;
  const outputCost = (estOutputTokensPerPrompt * haiku.output) / 1_000_000;
  return spans.length * (inputCost + outputCost);
}
