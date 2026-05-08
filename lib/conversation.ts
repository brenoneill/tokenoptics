import type { ConversationSummary } from "./types";

export function projectLabel(conversation: ConversationSummary): string {
  const cwd = conversation.cwd?.replace(/\/+$/, "");
  if (cwd) {
    const base = cwd.split("/").filter(Boolean).pop();
    if (base) return base;
  }
  const decoded = conversation.projectId.startsWith("-")
    ? conversation.projectId.slice(1).replace(/-/g, "/")
    : conversation.projectId;
  const base = decoded.split("/").filter(Boolean).pop();
  return base || conversation.projectId;
}
