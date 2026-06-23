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
  // Kiro CLI meters in credits, not tokens. Optional + additive: token-based
  // harnesses (Claude Code) leave it undefined. The per-model multiplier is
  // already baked in by Kiro, so this is the priceable unit for those sessions.
  credits?: number;
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
  // Which harness produced this session (e.g. "claude-code", "kiro-cli"). Drives
  // token-vs-credit UI: Kiro sessions are credit-metered regardless of whether a
  // given session happened to record credits. Optional for pre-migration rows.
  harnessId?: string;
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
  // Kiro CLI sessions only: total credits metered across the session. undefined
  // for token-based harnesses. When set, totalCost is derived from credits.
  totalCredits?: number;
  // Three-state traffic-light derived from the session's cache/context
  // analysis. null = not yet computed (pre-migration row) or session too
  // short to classify.
  cacheHealth: CacheHealth | null;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}
