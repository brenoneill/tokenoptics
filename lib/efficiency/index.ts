import type { Message } from "../types";
import { extractAssistantTurnShapes } from "./shape";
import { classifyByShape, isOverspend } from "./rules";
import {
  ZERO_WASTE,
  actualCostFromShape,
  addWaste,
  counterfactualCost,
  counterfactualCostForSpan,
  spanWasteBreakdown,
  wasteBreakdown,
} from "./pricing";
import {
  buildSpanShape,
  classifySpan,
  extractRequestSpans,
} from "./spans";
import { computeMechanicalSuccess } from "./validation";
import type {
  SessionEfficiencySummary,
  SpanEfficiencyResult,
  SpanSummary,
  TurnEfficiencyResult,
  ValidationSummary,
} from "./types";

export function analyzeSession(
  messages: Message[],
): SessionEfficiencySummary {
  const shapes = extractAssistantTurnShapes(messages);
  const mechanicalSuccess = computeMechanicalSuccess(messages);

  const turns: TurnEfficiencyResult[] = [];

  let needed = 0;
  let sonnetSufficient = 0;
  let haikuSufficient = 0;
  let ambiguous = 0;
  let actualCost = 0;
  let counterfactualCostTotal = 0;
  let totalWaste = ZERO_WASTE;

  let haikuFirstTrySuccessCount = 0;
  let haikuFirstTryEvaluable = 0;
  let downgradedTotal = 0;

  for (const shape of shapes) {
    const turnMechanical = mechanicalSuccess.get(shape.msgUuid) ?? null;
    const classification = classifyByShape(shape, {
      mechanicalSuccess: turnMechanical,
    });
    const turnActual = actualCostFromShape(shape);
    const overspend = isOverspend(shape.actualTier, classification.suggestedTier);

    const turnCounterfactual = overspend
      ? counterfactualCost(shape, classification.suggestedTier)
      : turnActual;
    const waste = overspend
      ? wasteBreakdown(shape, classification.suggestedTier)
      : ZERO_WASTE;

    if (classification.verdict === "needed_opus") needed++;
    else if (classification.verdict === "sonnet_sufficient") sonnetSufficient++;
    else if (classification.verdict === "haiku_sufficient") haikuSufficient++;
    else ambiguous++;

    if (classification.verdict === "haiku_sufficient" && turnMechanical !== null) {
      haikuFirstTryEvaluable++;
      if (turnMechanical) haikuFirstTrySuccessCount++;
    }

    if (
      classification.verdict === "haiku_sufficient" ||
      classification.verdict === "sonnet_sufficient"
    ) {
      downgradedTotal++;
    }

    actualCost += turnActual;
    counterfactualCostTotal += turnCounterfactual;
    totalWaste = addWaste(totalWaste, waste);

    turns.push({
      shape,
      classification,
      counterfactualCost: turnCounterfactual,
      waste,
      mechanicalSuccess: turnMechanical,
    });
  }

  const validation: ValidationSummary = {
    haikuFirstTrySuccessCount,
    haikuFirstTryEvaluable,
    downgradedTotal,
  };

  // Span-level analysis: aggregate per-turn results into user-request spans.
  const turnsByUuid = new Map<string, TurnEfficiencyResult>();
  for (const turn of turns) turnsByUuid.set(turn.shape.msgUuid, turn);

  const rawSpans = extractRequestSpans(messages);
  const spanResults: SpanEfficiencyResult[] = [];
  let spansActualCost = 0;
  let spansCounterfactualCost = 0;
  let spansTotalWaste = ZERO_WASTE;
  let spanNeeded = 0;
  let spanSonnet = 0;
  let spanHaiku = 0;
  let spanAmbiguous = 0;

  for (const raw of rawSpans) {
    const shape = buildSpanShape({ span: raw, turnsByUuid });
    if (shape.assistantTurnCount === 0) continue;
    const classification = classifySpan(shape);
    const overspend = isOverspend(shape.actualTier, classification.suggestedTier);
    const counterfactual = overspend
      ? counterfactualCostForSpan(shape, classification.suggestedTier)
      : shape.actualCost;
    const waste = overspend
      ? spanWasteBreakdown(shape, classification.suggestedTier)
      : ZERO_WASTE;

    if (classification.verdict === "needed_opus") spanNeeded++;
    else if (classification.verdict === "sonnet_sufficient") spanSonnet++;
    else if (classification.verdict === "haiku_sufficient") spanHaiku++;
    else spanAmbiguous++;

    spansActualCost += shape.actualCost;
    spansCounterfactualCost += counterfactual;
    spansTotalWaste = addWaste(spansTotalWaste, waste);

    spanResults.push({
      shape,
      classification,
      counterfactualCost: counterfactual,
      waste,
      turnUuids: raw.assistantMessages.map((m) => m.uuid),
    });
  }

  const spanSummary: SpanSummary = {
    totalSpans: spanResults.length,
    needed: spanNeeded,
    sonnetSufficient: spanSonnet,
    haikuSufficient: spanHaiku,
    ambiguous: spanAmbiguous,
    actualCost: spansActualCost,
    counterfactualCost: spansCounterfactualCost,
    totalWaste: spansTotalWaste,
    spans: spanResults,
  };

  return {
    totalTurns: shapes.length,
    evaluatedTurns: shapes.filter((s) => s.actualTier !== undefined).length,
    needed,
    sonnetSufficient,
    haikuSufficient,
    ambiguous,
    actualCost,
    counterfactualCost: counterfactualCostTotal,
    totalWaste,
    validation,
    turns,
    spans: spanSummary,
  };
}

export * from "./types";
export { extractTurnShape, extractAssistantTurnShapes, tierForModel } from "./shape";
export { classifyByShape, isOverspend, THRESHOLDS } from "./rules";
export {
  TIER_REPRESENTATIVE_MODEL,
  actualCostFromShape,
  counterfactualCost,
  wasteBreakdown,
} from "./pricing";
