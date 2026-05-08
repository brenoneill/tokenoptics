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
  blocks: ContentBlock[];
  usage?: Usage;
  cost?: number;
}

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
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}
