import type { Message } from "../types";

export function computeMechanicalSuccess(
  messages: Message[],
): Map<string, boolean | null> {
  const result = new Map<string, boolean | null>();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    const toolUseIds: string[] = [];
    for (const b of msg.blocks) {
      if (b.kind === "tool_use") toolUseIds.push(b.toolUseId);
    }
    if (toolUseIds.length === 0) {
      result.set(msg.uuid, null);
      continue;
    }

    const next = messages[i + 1];
    if (!next || next.role !== "user") {
      result.set(msg.uuid, null);
      continue;
    }

    const resultsById = new Map<string, boolean>();
    for (const b of next.blocks) {
      if (b.kind === "tool_result") {
        resultsById.set(b.toolUseId, b.isError);
      }
    }

    let anyError = false;
    let allFound = true;
    for (const id of toolUseIds) {
      const isError = resultsById.get(id);
      if (isError === undefined) {
        allFound = false;
        break;
      }
      if (isError) {
        anyError = true;
        break;
      }
    }

    result.set(msg.uuid, allFound ? !anyError : null);
  }
  return result;
}
