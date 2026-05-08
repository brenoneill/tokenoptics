export const TURN_TIERS = ["haiku", "sonnet", "opus"] as const;
export type TurnTier = (typeof TURN_TIERS)[number];

export const TURN_VERDICTS = [
  "needed_opus",
  "sonnet_sufficient",
  "haiku_sufficient",
  "ambiguous",
] as const;
export type TurnVerdict = (typeof TURN_VERDICTS)[number];

export interface TurnShape {
  msgUuid: string;
  actualModel: string | undefined;
  actualTier: TurnTier | undefined;
  hadThinking: boolean;
  thinkingTokensEstimate: number;
  textChars: number;
  toolUseCount: number;
  hadErrorRecovery: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  actualCost: number;
}

export interface TurnClassification {
  verdict: TurnVerdict;
  suggestedTier: TurnTier;
  reasons: string[];
}

export interface WasteBreakdown {
  inputRatePremium: number;
  outputRatePremium: number;
  thinkingSurplus: number;
  total: number;
}

export interface TurnEfficiencyResult {
  shape: TurnShape;
  classification: TurnClassification;
  counterfactualCost: number;
  waste: WasteBreakdown;
  mechanicalSuccess: boolean | null;
}

export interface ValidationSummary {
  haikuFirstTrySuccessCount: number;
  haikuFirstTryEvaluable: number;
  downgradedTotal: number;
}

export interface SessionEfficiencySummary {
  totalTurns: number;
  evaluatedTurns: number;
  needed: number;
  sonnetSufficient: number;
  haikuSufficient: number;
  ambiguous: number;
  actualCost: number;
  counterfactualCost: number;
  totalWaste: WasteBreakdown;
  validation: ValidationSummary;
  turns: TurnEfficiencyResult[];
  spans: SpanSummary;
}

export interface SpanRollup {
  totalSpans: number;
  needed: number;
  sonnetSufficient: number;
  haikuSufficient: number;
  ambiguous: number;
  actualCost: number;
  counterfactualCost: number;
  waste: WasteBreakdown;
}

export interface EfficiencyDetectionRecord {
  projectId: string;
  sessionId: string;
  contentHash: string;
  analyzedAt: string;
  totalTurns: number;
  needed: number;
  sonnetSufficient: number;
  haikuSufficient: number;
  ambiguous: number;
  actualCost: number;
  counterfactualCost: number;
  waste: WasteBreakdown;
  validation: ValidationSummary;
  spans: SpanRollup;
}

export interface EfficiencyTurnRecord {
  id: string;
  projectId: string;
  sessionId: string;
  ord: number;
  msgUuid: string;
  actualModel: string | null;
  actualTier: TurnTier | null;
  verdict: TurnVerdict;
  suggestedTier: TurnTier;
  reasons: string[];
  hadThinking: boolean;
  thinkingTokensEstimate: number;
  textChars: number;
  toolUseCount: number;
  hadErrorRecovery: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  actualCost: number;
  counterfactualCost: number;
  waste: WasteBreakdown;
  mechanicalSuccess: boolean | null;
  createdAt: string;
}

export interface SessionEfficiencyAggregate {
  totalTurns: number;
  needed: number;
  sonnetSufficient: number;
  haikuSufficient: number;
  ambiguous: number;
  actualCost: number;
  counterfactualCost: number;
  wasteTotal: number;
}

export interface SpanClassification {
  verdict: TurnVerdict;
  suggestedTier: TurnTier;
  reasons: string[];
}

export interface SpanDiffStats {
  editsCount: number;
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
  filesAffected: number;
}

export interface RequestSpanShape {
  userMsgUuid: string;
  userPromptPreview: string;
  startMsgUuid: string;
  endMsgUuid: string;
  assistantTurnCount: number;
  totalToolUseCount: number;
  totalTextChars: number;
  totalThinkingTokensEstimate: number;
  anyHadThinking: boolean;
  anyHadErrorRecovery: boolean;
  allMechanicalSuccess: boolean | null;
  diffStats: SpanDiffStats;
  actualCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  actualModel: string | undefined;
  actualTier: TurnTier | undefined;
}

export interface SpanEfficiencyResult {
  shape: RequestSpanShape;
  classification: SpanClassification;
  counterfactualCost: number;
  waste: WasteBreakdown;
  turnUuids: string[];
}

export interface SpanEfficiencyRecord {
  id: string;
  projectId: string;
  sessionId: string;
  ord: number;
  userMsgUuid: string;
  userPromptPreview: string;
  startMsgUuid: string;
  endMsgUuid: string;
  assistantTurnCount: number;
  verdict: TurnVerdict;
  suggestedTier: TurnTier;
  reasons: string[];
  actualModel: string | null;
  actualTier: TurnTier | null;
  totalToolUseCount: number;
  totalTextChars: number;
  totalThinkingTokensEstimate: number;
  anyHadThinking: boolean;
  anyHadErrorRecovery: boolean;
  allMechanicalSuccess: boolean | null;
  diffStats: SpanDiffStats;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  actualCost: number;
  counterfactualCost: number;
  waste: WasteBreakdown;
  createdAt: string;
}

export interface SpanSummary {
  totalSpans: number;
  needed: number;
  sonnetSufficient: number;
  haikuSufficient: number;
  ambiguous: number;
  actualCost: number;
  counterfactualCost: number;
  totalWaste: WasteBreakdown;
  spans: SpanEfficiencyResult[];
}

export function isTurnTier(value: unknown): value is TurnTier {
  return typeof value === "string" && (TURN_TIERS as readonly string[]).includes(value);
}

export function isTurnVerdict(value: unknown): value is TurnVerdict {
  return typeof value === "string" && (TURN_VERDICTS as readonly string[]).includes(value);
}
