import type { Message } from "../types";
import { userPromptText } from "../transcript";

export interface ChunkMemberMetrics {
  messageCount: number;
  promptCount: number;
  errorCount: number;
  totalCost: number;
  startMsgUuid: string;
  endMsgUuid: string;
  startIdx: number;
  endIdx: number;
}

export function computeChunkMemberMetrics(
  memberMsgUuids: string[],
  messages: Message[],
): ChunkMemberMetrics {
  const indexByUuid = new Map<string, number>();
  messages.forEach((m, i) => indexByUuid.set(m.uuid, i));

  let messageCount = 0;
  let promptCount = 0;
  let errorCount = 0;
  let totalCost = 0;
  let startIdx = Number.POSITIVE_INFINITY;
  let endIdx = -1;

  for (const uuid of memberMsgUuids) {
    const idx = indexByUuid.get(uuid);
    if (idx === undefined) continue;
    const m = messages[idx];
    messageCount += 1;
    if (m.role === "user" && userPromptText(m)) promptCount += 1;
    for (const b of m.blocks) {
      if (b.kind === "tool_result" && b.isError) errorCount += 1;
    }
    if (typeof m.cost === "number") totalCost += m.cost;
    if (idx < startIdx) startIdx = idx;
    if (idx > endIdx) endIdx = idx;
  }

  if (endIdx < 0) {
    return {
      messageCount: 0,
      promptCount: 0,
      errorCount: 0,
      totalCost: 0,
      startMsgUuid: "",
      endMsgUuid: "",
      startIdx: -1,
      endIdx: -1,
    };
  }

  return {
    messageCount,
    promptCount,
    errorCount,
    totalCost,
    startMsgUuid: messages[startIdx].uuid,
    endMsgUuid: messages[endIdx].uuid,
    startIdx,
    endIdx,
  };
}

// Given a list of selected user-prompt UUIDs, expand each into its full member set:
// the prompt itself plus every message that follows until (but not including) the next
// user prompt. Returns a deduped, document-ordered array of UUIDs.
export function expandPromptsToMembers(
  promptUuids: string[],
  messages: Message[],
): string[] {
  const promptSet = new Set(promptUuids);
  const isPrompt = (m: Message): boolean =>
    m.role === "user" && userPromptText(m) !== null;

  const members = new Set<string>();
  for (let i = 0; i < messages.length; i++) {
    if (!promptSet.has(messages[i].uuid)) continue;
    members.add(messages[i].uuid);
    for (let j = i + 1; j < messages.length; j++) {
      if (isPrompt(messages[j])) break;
      members.add(messages[j].uuid);
    }
  }

  const ordered: string[] = [];
  for (const m of messages) {
    if (members.has(m.uuid)) ordered.push(m.uuid);
  }
  return ordered;
}

// Walk prompts in document order. Maximal runs of consecutive selected prompts
// (no non-selected prompt between them) collapse into a single segment whose
// startMsgUuid is the first selected prompt and endMsgUuid is the last message
// before the next prompt boundary (or end of conversation). Gaps in selection
// produce separate segments.
export function groupPromptsIntoSegments(
  promptUuids: string[],
  messages: Message[],
): { startMsgUuid: string; endMsgUuid: string }[] {
  const promptSet = new Set(promptUuids);
  const isPrompt = (m: Message): boolean =>
    m.role === "user" && userPromptText(m) !== null;

  const promptIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (isPrompt(messages[i])) promptIndices.push(i);
  }

  const segments: { startMsgUuid: string; endMsgUuid: string }[] = [];
  let runStart: number | null = null;
  let runLastIdx: number | null = null;

  for (let p = 0; p < promptIndices.length; p++) {
    const idx = promptIndices[p];
    const selected = promptSet.has(messages[idx].uuid);

    if (selected) {
      if (runStart === null) runStart = idx;
      const isLastPrompt = p === promptIndices.length - 1;
      const nextIdx = isLastPrompt ? messages.length : promptIndices[p + 1];
      runLastIdx = nextIdx - 1;
    } else if (runStart !== null && runLastIdx !== null) {
      segments.push({
        startMsgUuid: messages[runStart].uuid,
        endMsgUuid: messages[runLastIdx].uuid,
      });
      runStart = null;
      runLastIdx = null;
    }
  }

  if (runStart !== null && runLastIdx !== null) {
    segments.push({
      startMsgUuid: messages[runStart].uuid,
      endMsgUuid: messages[runLastIdx].uuid,
    });
  }

  return segments;
}
