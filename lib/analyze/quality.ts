// Prompt-quality analysis: detects assistant work that got invalidated by
// user-side information gaps — i.e. info the user could have provided in the
// initial prompt but only mentioned after the assistant had already done
// related work.
//
// The classifier labels each span's relationship to the prior task and
// (when relevant) which recent assistant turns got invalidated. We sum the
// output tokens of those invalidated turns to estimate wasted spend.
//
// Scope is user-side only: assistant tool errors and natural design
// iteration are not waste — only late-arriving info or direction changes are.

import { costForUsage } from "../pricing";
import type { Message } from "../types";
import type { PromptSpan } from "./session";

export type SpanRelationship =
  | "fresh_task"
  | "clean_continuation"
  | "info_gap"
  | "direction_change";

export interface WasteSpanClassification {
  relationship: SpanRelationship;
  reason: string;
  // Specific info the user added late that could have been in the lead
  // prompt (e.g. "file path: lib/auth.ts", "framework: Tailwind v4").
  // Only populated for info_gap / direction_change.
  latentInfo: string[];
  // UUIDs of assistant messages the classifier flagged as invalidated by
  // this span's prompt. We sum their output tokens to estimate waste.
  invalidatedTurnUuids: string[];
  // Classifier API cost — summed into the run-level classifier cost.
  classifierInputTokens: number;
  classifierOutputTokens: number;
}

export interface ClassifiedQualitySpan {
  span: PromptSpan;
  // Index of the span in the run, stable across the parallel classify pass
  // and the sequential aggregate pass.
  spanIndex: number;
  classification: WasteSpanClassification;
}

export type WasteCategory =
  | "info_gap"
  | "direction_change"
  | "mixed"
  | "none";

export interface QualityTaskRecord {
  // Lead prompt of this task — the fresh_task span that opened the bucket.
  leadPromptUuid: string;
  leadPromptPreview: string;
  leadPromptCharCount: number;
  // Number of follow-up replies (info_gap + direction_change + clean_continuation)
  // that landed in this task. Includes clean ones since they're still part
  // of the task even if they don't cause waste.
  followUpCount: number;
  // Of those follow-ups, how many triggered a waste signal.
  wastefulFollowUpCount: number;
  // Most severe waste signal in the task.
  category: WasteCategory;
  // LLM-written one-line reason from the most-severe span. Empty for "none".
  reason: string;
  // Concatenation of latentInfo from all info_gap / direction_change spans
  // in this task — what the user should've said upfront.
  latentInfo: string[];
  // Sum of usage.outputTokens across all invalidated assistant messages.
  wastedOutputTokens: number;
  // Dollar cost of those wasted output tokens, priced at each invalidated
  // message's actual model.
  wastedCost: number;
}

export interface QualityRunSummary {
  totalTasks: number;
  // Tasks with any waste signal (category != none).
  wastefulTaskCount: number;
  infoGapTaskCount: number;
  directionChangeTaskCount: number;
  mixedTaskCount: number;
  // Sum of wastedOutputTokens across all tasks.
  totalWastedOutputTokens: number;
  totalWastedCost: number;
  // Total session output cost for context — wastedCost / sessionOutputCost
  // is the headline "% of cost wasted" figure.
  sessionActualCost: number;
  // Spans that failed to classify entirely.
  skippedCount: number;
  classifierCost: number;
  classifierModel: string;
}

export interface QualityRunRecord {
  runId: string;
  projectId: string;
  sessionId: string;
  completedAt: string;
  classifierModel: string;
  summary: QualityRunSummary;
  tasks: QualityTaskRecord[];
}

// Walks classified spans in their original order, opening a new task bucket
// on each fresh_task and folding info_gap / direction_change / clean
// continuations into the current bucket. Wasted-token totals are computed
// from the classifier-supplied invalidated UUIDs, scoped to assistant
// messages from spans inside this task (we ignore stray UUIDs the model
// might have hallucinated from outside the task).
export function aggregateTasks(
  items: ClassifiedQualitySpan[],
): QualityTaskRecord[] {
  const out: QualityTaskRecord[] = [];

  interface Bucket {
    lead: PromptSpan;
    assistantMessagesByUuid: Map<string, Message>;
    followUpCount: number;
    wastefulFollowUpCount: number;
    hasInfoGap: boolean;
    hasDirectionChange: boolean;
    invalidatedUuids: Set<string>;
    latentInfo: string[];
    // Reason from the worst (info_gap > direction_change > clean) span we've seen.
    severityReason: string;
    severityRank: number; // 0 clean, 1 direction_change, 2 info_gap
  }

  let bucket: Bucket | null = null;

  const addAssistantMessages = (b: Bucket, span: PromptSpan) => {
    for (const m of span.assistantMessages) {
      b.assistantMessagesByUuid.set(m.uuid, m);
    }
  };

  const openBucket = (span: PromptSpan): Bucket => ({
    lead: span,
    assistantMessagesByUuid: new Map(),
    followUpCount: 0,
    wastefulFollowUpCount: 0,
    hasInfoGap: false,
    hasDirectionChange: false,
    invalidatedUuids: new Set(),
    latentInfo: [],
    severityReason: "",
    severityRank: 0,
  });

  const finalize = (b: Bucket) => {
    let wastedOutputTokens = 0;
    let wastedCost = 0;
    for (const uuid of b.invalidatedUuids) {
      const m = b.assistantMessagesByUuid.get(uuid);
      if (!m || !m.usage) continue;
      wastedOutputTokens += m.usage.outputTokens;
      wastedCost += costForUsage(m.model, {
        inputTokens: 0,
        outputTokens: m.usage.outputTokens,
        cacheReadTokens: 0,
        cacheWrite5mTokens: 0,
        cacheWrite1hTokens: 0,
      });
    }

    let category: WasteCategory = "none";
    if (b.hasInfoGap && b.hasDirectionChange) category = "mixed";
    else if (b.hasInfoGap) category = "info_gap";
    else if (b.hasDirectionChange) category = "direction_change";

    out.push({
      leadPromptUuid: b.lead.userMessage.uuid,
      leadPromptPreview: b.lead.promptText.slice(0, 320),
      leadPromptCharCount: b.lead.promptText.length,
      followUpCount: b.followUpCount,
      wastefulFollowUpCount: b.wastefulFollowUpCount,
      category,
      reason: category === "none" ? "" : b.severityReason,
      latentInfo: b.latentInfo,
      wastedOutputTokens,
      wastedCost,
    });
  };

  for (const item of items) {
    const { span, classification } = item;
    const rel = classification.relationship;

    if (rel === "fresh_task" || !bucket) {
      if (bucket) finalize(bucket);
      bucket = openBucket(span);
      addAssistantMessages(bucket, span);
      // A fresh_task may itself be flagged with invalidated UUIDs if the
      // classifier got confused. Ignore those — fresh tasks by definition
      // don't invalidate anything in this bucket.
      continue;
    }

    // Continuation of the current task.
    bucket.followUpCount += 1;
    addAssistantMessages(bucket, span);

    if (rel === "info_gap" || rel === "direction_change") {
      bucket.wastefulFollowUpCount += 1;
      if (rel === "info_gap") bucket.hasInfoGap = true;
      else bucket.hasDirectionChange = true;
      for (const uuid of classification.invalidatedTurnUuids) {
        bucket.invalidatedUuids.add(uuid);
      }
      for (const info of classification.latentInfo) {
        if (info && !bucket.latentInfo.includes(info)) {
          bucket.latentInfo.push(info);
        }
      }
      const rank = rel === "info_gap" ? 2 : 1;
      if (rank >= bucket.severityRank) {
        bucket.severityRank = rank;
        bucket.severityReason = classification.reason;
      }
    }
  }

  if (bucket) finalize(bucket);
  return out;
}
