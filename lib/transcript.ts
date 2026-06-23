import { isDiffTool, statsForTool } from "./diff";
import type { ContentBlock, Message } from "./types";

type ToolUseBlock = Extract<ContentBlock, { kind: "tool_use" }>;

export interface PromptItem {
  kind: "prompt";
  message: Message;
  text: string;
  trigger?: { message: Message; text: string };
}

export type FoldRenderItem =
  | { type: "message"; message: Message; hideText?: boolean }
  | { type: "diff"; message: Message; block: ToolUseBlock };

export interface FoldItem {
  kind: "fold";
  items: FoldRenderItem[];
  toolResultCount: number;
  assistantOutputCount: number;
  assistantMessageCount: number;
  diffCount: number;
  addedLines: number;
  removedLines: number;
  rewrittenLines: number;
  totalCost: number;
  // Kiro credit sessions: credits spent within this fold (0 for token-based).
  totalCredits: number;
}

export type TranscriptItem = PromptItem | FoldItem;

export function userPromptText(message: Message): string | null {
  if (message.role !== "user") return null;
  const parts: string[] = [];
  for (const block of message.blocks) {
    if (block.kind === "text") parts.push(block.text);
  }
  if (parts.length === 0) return null;

  let text = parts.join("\n");
  text = text.replace(/<command-name>([^<]*)<\/command-name>/g, "$1");
  text = text.replace(/<command-args>([\s\S]*?)<\/command-args>/g, (_, args: string) =>
    args.trim() ? ` ${args.trim()}` : "",
  );
  text = text
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .replace(/<local-command-stderr>[\s\S]*?<\/local-command-stderr>/g, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .trim();

  return text || null;
}

function assistantTriggerText(message: Message): string | null {
  if (message.role !== "assistant") return null;
  const parts: string[] = [];
  for (const block of message.blocks) {
    if (block.kind === "text" && block.text.trim()) parts.push(block.text);
  }
  if (parts.length === 0) return null;
  return parts.join("\n").trim() || null;
}

function diffBlocksFor(message: Message): ToolUseBlock[] {
  if (message.role !== "assistant") return [];
  return message.blocks.filter(
    (b): b is ToolUseBlock => b.kind === "tool_use" && isDiffTool(b.name),
  );
}

function emptyFoldAccumulator() {
  return {
    items: [] as FoldRenderItem[],
    toolResultCount: 0,
    assistantOutputCount: 0,
    assistantMessageCount: 0,
    diffCount: 0,
    addedLines: 0,
    removedLines: 0,
    rewrittenLines: 0,
    totalCost: 0,
    totalCredits: 0,
  };
}

type FoldAccumulator = ReturnType<typeof emptyFoldAccumulator>;

function addMessageToFold(
  acc: FoldAccumulator,
  message: Message,
  isTrigger: boolean,
): void {
  if (typeof message.cost === "number") acc.totalCost += message.cost;
  if (typeof message.usage?.credits === "number") acc.totalCredits += message.usage.credits;

  const diffs = diffBlocksFor(message);
  if (diffs.length > 0) {
    for (const block of diffs) {
      acc.items.push({ type: "diff", message, block });
      acc.diffCount += 1;
      const stats = statsForTool(block.name, block.input);
      acc.addedLines += stats.added;
      acc.removedLines += stats.removed;
      acc.rewrittenLines += stats.context;
    }
    return;
  }

  if (isTrigger) {
    const hasNonTextContent = message.blocks.some((b) => b.kind !== "text");
    if (!hasNonTextContent) return;
    acc.items.push({ type: "message", message, hideText: true });
    if (message.role === "assistant") acc.assistantOutputCount += 1;
    return;
  }

  acc.items.push({ type: "message", message });
  if (message.role === "assistant") acc.assistantOutputCount += 1;
  for (const block of message.blocks) {
    if (block.kind === "tool_result") acc.toolResultCount += 1;
    if (
      message.role === "assistant" &&
      block.kind === "text" &&
      block.text.trim().length > 0
    ) {
      acc.assistantMessageCount += 1;
    }
  }
}

export function groupMessages(messages: Message[]): TranscriptItem[] {
  const triggerByPromptUuid = new Map<string, { message: Message; text: string }>();
  const triggerMessageUuids = new Set<string>();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (!userPromptText(m)) continue;
    for (let j = i - 1; j >= 0; j--) {
      const text = assistantTriggerText(messages[j]);
      if (text) {
        triggerByPromptUuid.set(m.uuid, { message: messages[j], text });
        triggerMessageUuids.add(messages[j].uuid);
        break;
      }
    }
  }

  const items: TranscriptItem[] = [];
  let pending: FoldAccumulator | null = null;

  const flush = () => {
    if (!pending || pending.items.length === 0) {
      pending = null;
      return;
    }
    items.push({ kind: "fold", ...pending });
    pending = null;
  };

  for (const message of messages) {
    const promptText = userPromptText(message);
    if (promptText) {
      flush();
      items.push({
        kind: "prompt",
        message,
        text: promptText,
        trigger: triggerByPromptUuid.get(message.uuid),
      });
      continue;
    }
    if (!pending) pending = emptyFoldAccumulator();
    addMessageToFold(pending, message, triggerMessageUuids.has(message.uuid));
  }
  flush();

  return items;
}
