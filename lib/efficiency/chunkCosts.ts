import { pricingForModel, type ModelPricing } from "../pricing";
import type { Message } from "../types";
import { TIER_REPRESENTATIVE_MODEL } from "./pricing";
import type { TurnTier } from "./types";

const CHARS_PER_TOKEN = 4;

interface AggregatedTokens {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  textOutputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
}

function aggregateTokens(messages: Message[]): AggregatedTokens {
  let inputTokens = 0;
  let outputTokens = 0;
  let thinkingTokens = 0;
  let textOutputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWrite5mTokens = 0;
  let cacheWrite1hTokens = 0;

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const u = msg.usage;
    if (!u) continue;

    let textChars = 0;
    let toolUseInputChars = 0;
    let hadThinking = false;
    for (const b of msg.blocks) {
      if (b.kind === "thinking") hadThinking = true;
      else if (b.kind === "text") textChars += b.text.length;
      else if (b.kind === "tool_use") {
        try {
          toolUseInputChars += JSON.stringify(b.input).length;
        } catch {
          // ignore
        }
      }
    }
    const visibleOutputTokens = Math.ceil(
      (textChars + toolUseInputChars) / CHARS_PER_TOKEN,
    );
    const turnThinking = hadThinking
      ? Math.max(0, u.outputTokens - visibleOutputTokens)
      : 0;

    inputTokens += u.inputTokens;
    outputTokens += u.outputTokens;
    thinkingTokens += turnThinking;
    textOutputTokens += Math.max(0, u.outputTokens - turnThinking);
    cacheReadTokens += u.cacheReadTokens;
    cacheWrite5mTokens += u.cacheWrite5mTokens;
    cacheWrite1hTokens += u.cacheWrite1hTokens;
  }

  return {
    inputTokens,
    outputTokens,
    thinkingTokens,
    textOutputTokens,
    cacheReadTokens,
    cacheWrite5mTokens,
    cacheWrite1hTokens,
  };
}

function costAtRate(
  tokens: AggregatedTokens,
  rate: ModelPricing,
  includeThinking: boolean,
): number {
  const outputTokensForCost = includeThinking
    ? tokens.outputTokens
    : tokens.textOutputTokens;
  return (
    tokens.inputTokens         * rate.input        +
    outputTokensForCost        * rate.output       +
    tokens.cacheReadTokens     * rate.cacheRead    +
    tokens.cacheWrite5mTokens  * rate.cacheWrite   +
    tokens.cacheWrite1hTokens  * rate.cacheWrite1h
  ) / 1_000_000;
}

export interface ChunkCostByTier {
  haiku: number;
  sonnet: number;
  opus: number;
  actualModel: string | undefined;
}

// Compute cost-at-each-tier for a list of messages. We assume the user would
// have disabled extended thinking on the cheaper tiers (so thinking tokens
// vanish in the Haiku/Sonnet counterfactuals). The Opus counterfactual
// reflects the messages as they actually ran (thinking tokens billed at Opus
// output rate).
export function computeCostByTierForMessages(
  messages: Message[],
): ChunkCostByTier {
  if (messages.length === 0) {
    return { haiku: 0, sonnet: 0, opus: 0, actualModel: undefined };
  }
  const tokens = aggregateTokens(messages);

  const haikuRate = pricingForModel(TIER_REPRESENTATIVE_MODEL.haiku);
  const sonnetRate = pricingForModel(TIER_REPRESENTATIVE_MODEL.sonnet);
  const opusRate = pricingForModel(TIER_REPRESENTATIVE_MODEL.opus);

  const actualModel = messages.find(
    (m) => m.role === "assistant" && m.model,
  )?.model;

  return {
    haiku: costAtRate(tokens, haikuRate, false),
    sonnet: costAtRate(tokens, sonnetRate, false),
    opus: costAtRate(tokens, opusRate, true),
    actualModel,
  };
}

export function tierForModelName(model: string | undefined): TurnTier | undefined {
  if (!model) return undefined;
  const m = model.toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  return undefined;
}
