import type { Message } from "../types";
import type { TurnShape, TurnTier } from "./types";

export function tierForModel(model: string | undefined): TurnTier | undefined {
  if (!model) return undefined;
  const m = model.toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  return undefined;
}

const CHARS_PER_TOKEN = 4;

export function extractTurnShape(
  message: Message,
  prevMessage: Message | undefined,
): TurnShape {
  let hadThinking = false;
  let textChars = 0;
  let toolUseInputChars = 0;
  let toolUseCount = 0;

  for (const block of message.blocks) {
    if (block.kind === "thinking") {
      hadThinking = true;
    } else if (block.kind === "text") {
      textChars += block.text.length;
    } else if (block.kind === "tool_use") {
      toolUseCount += 1;
      try {
        toolUseInputChars += JSON.stringify(block.input).length;
      } catch {
        // ignore unserialisable inputs
      }
    }
  }

  let hadErrorRecovery = false;
  if (prevMessage) {
    for (const block of prevMessage.blocks) {
      if (block.kind === "tool_result" && block.isError) {
        hadErrorRecovery = true;
        break;
      }
    }
  }

  const usage = message.usage;
  const outputTokens = usage?.outputTokens ?? 0;
  const visibleOutputTokens = Math.ceil((textChars + toolUseInputChars) / CHARS_PER_TOKEN);
  const thinkingTokensEstimate = hadThinking
    ? Math.max(0, outputTokens - visibleOutputTokens)
    : 0;

  return {
    msgUuid: message.uuid,
    actualModel: message.model,
    actualTier: tierForModel(message.model),
    hadThinking,
    thinkingTokensEstimate,
    textChars,
    toolUseCount,
    hadErrorRecovery,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens,
    cacheReadTokens: usage?.cacheReadTokens ?? 0,
    cacheWrite5mTokens: usage?.cacheWrite5mTokens ?? 0,
    cacheWrite1hTokens: usage?.cacheWrite1hTokens ?? 0,
    actualCost: message.cost ?? 0,
  };
}

export function extractAssistantTurnShapes(messages: Message[]): TurnShape[] {
  const shapes: TurnShape[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    shapes.push(extractTurnShape(msg, i > 0 ? messages[i - 1] : undefined));
  }
  return shapes;
}
