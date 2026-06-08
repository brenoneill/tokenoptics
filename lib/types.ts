export type ContentBlock =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tool_use"; toolUseId: string; name: string; input: unknown }
  | {
      kind: "tool_result";
      toolUseId: string;
      isError: boolean;
      charCount: number;
      toolName?: string;
    };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
}

export interface Message {
  uuid: string;
  parentUuid: string | null;
  role: "user" | "assistant";
  timestamp: string;
  model?: string;
  // Claude Code API message id — shared across streaming JSONL lines for one
  // assistant response. Usage is attributed only on the first line per id.
  apiMessageId?: string;
  blocks: ContentBlock[];
  usage?: Usage;
  cost?: number;
}

import type { CacheHealth } from "./analyze/cache";

export interface ConversationSummary {
  projectId: string;
  sessionId: string;
  title: string;
  cwd: string;
  gitBranch?: string;
  startedAt: string;
  endedAt: string;
  messageCount: number;
  primaryModel: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  // Three-state traffic-light derived from the session's cache/context
  // analysis. null = not yet computed (pre-migration row) or session too
  // short to classify.
  cacheHealth: CacheHealth | null;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}
