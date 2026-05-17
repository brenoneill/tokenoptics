import type { Usage } from "../types";
import type { RoutingComparison, RoutingLabel, RoutingTier } from "./routing";

// Distilled signals about what the assistant actually did while responding to
// a user prompt. Passed to the classifier alongside the prompt text so it can
// judge intent in light of the work that ensued.
export interface ResponseFeatures {
  assistantTurnCount: number;
  toolUseCount: number;
  toolErrorCount: number;
  thinkingUsed: boolean;
  textChars: number;
  distinctToolNames: string[];
}

export interface RoutingTurnRecord {
  userMsgUuid: string;
  promptPreview: string;
  promptCharCount: number;
  label: RoutingLabel;
  reasoning: string;
  // Aggregated across every assistant turn that responded to this user prompt
  // (before the next genuine user prompt). Mixed-model turns roll up to the
  // dominant model by cost.
  actualModel: string | null;
  actualTier: RoutingTier | null;
  recommendedModel: string;
  recommendedTier: RoutingTier;
  comparison: RoutingComparison;
  usage: Usage;
  // Usage rebased onto the recommended tier — output tokens scaled by the
  // tier-to-tier output ratio. Input/cache are unchanged.
  counterfactualUsage: Usage;
  outputRatio: number;
  actualCost: number;
  counterfactualCost: number;
  // savings = positive when actualCost > counterfactualCost AND comparison === "savings".
  // otherwise 0. under_specced extra cost is tracked separately.
  savings: number;
  // Set when comparison === "under_specced". counterfactualCost - actualCost.
  underspendDelta: number;
  classifierInputTokens: number;
  classifierOutputTokens: number;
  assistantTurnCount: number;
  // Short user replies ("yes", "A", "go ahead") that followed an assistant
  // question and got folded into this span instead of opening a new one.
  followUpReplyCount: number;
  features: ResponseFeatures;
}

export interface RoutingRunSummary {
  totalUserPrompts: number;
  classifiedCount: number;
  // Spans the classifier called out as continuations of the prior task and
  // that were folded into the preceding turn record. Reported here so the
  // UI can explain why classifiedCount < totalUserPrompts.
  continuationCount: number;
  // Spans that failed to classify (network error, malformed response, etc.).
  skippedCount: number;
  actualCost: number;
  recommendedCost: number;
  totalSavings: number;
  underSpeccedCount: number;
  underSpeccedDelta: number;
  alignedCount: number;
  savingsCount: number;
  classifierCost: number;
  classifierModel: string;
}

export interface RoutingRunRecord {
  runId: string;
  projectId: string;
  sessionId: string;
  completedAt: string;
  classifierModel: string;
  summary: RoutingRunSummary;
  turns: RoutingTurnRecord[];
}
