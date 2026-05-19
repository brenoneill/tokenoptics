import { costForUsage } from "./pricing";
import type {
  Conversation,
  ContentBlock,
  Message,
  Usage,
} from "./types";

interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
}

interface RawContent {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

interface RawMessage {
  role?: "user" | "assistant";
  model?: string;
  content?: RawContent[] | string;
  usage?: RawUsage;
}

interface RawEntry {
  type?: string;
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  timestamp?: string;
  cwd?: string;
  gitBranch?: string;
  message?: RawMessage;
  aiTitle?: string;
}

const RENDERABLE_TYPES = new Set(["user", "assistant"]);
const AI_TITLE_TYPE = "ai-title";

function toUsage(raw: RawUsage | undefined): Usage | undefined {
  if (!raw) return undefined;
  return {
    inputTokens: raw.input_tokens ?? 0,
    outputTokens: raw.output_tokens ?? 0,
    cacheReadTokens: raw.cache_read_input_tokens ?? 0,
    cacheWrite5mTokens: raw.cache_creation?.ephemeral_5m_input_tokens ?? 0,
    cacheWrite1hTokens: raw.cache_creation?.ephemeral_1h_input_tokens ?? 0,
  };
}

function charCountOf(content: unknown): number {
  if (typeof content === "string") return content.length;
  if (Array.isArray(content)) {
    return content.reduce((sum: number, item) => {
      if (typeof item === "string") return sum + item.length;
      if (item && typeof item === "object" && "text" in item) {
        return sum + ((item as { text?: string }).text?.length ?? 0);
      }
      return sum;
    }, 0);
  }
  return 0;
}

function toBlocks(content: RawContent[] | string | undefined): ContentBlock[] {
  if (!content) return [];
  if (typeof content === "string") {
    return [{ kind: "text", text: content }];
  }

  const blocks: ContentBlock[] = [];
  for (const c of content) {
    switch (c.type) {
      case "text":
        if (c.text) blocks.push({ kind: "text", text: c.text });
        break;
      case "thinking":
        // Keep the block even when text is empty: stored transcripts retain only
        // the signature, but presence of the block is the signal that thinking
        // happened. Dropping it would also drop thinking-only assistant turns.
        blocks.push({ kind: "thinking", text: c.thinking ?? "" });
        break;
      case "tool_use":
        blocks.push({
          kind: "tool_use",
          toolUseId: c.id ?? "",
          name: c.name ?? "tool",
          input: c.input ?? {},
        });
        break;
      case "tool_result":
        blocks.push({
          kind: "tool_result",
          toolUseId: c.tool_use_id ?? "",
          isError: Boolean(c.is_error),
          charCount: charCountOf(c.content),
        });
        break;
      default:
        break;
    }
  }
  return blocks;
}

function safeParse(line: string): RawEntry | null {
  try {
    return JSON.parse(line) as RawEntry;
  } catch {
    return null;
  }
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.parentUuid === null) ?? messages.find((m) => m.role === "user");
  if (!firstUser) return "Untitled conversation";

  for (const block of firstUser.blocks) {
    if (block.kind === "text" && block.text.trim()) {
      const cleaned = block.text
        .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (cleaned) {
        const firstLine = cleaned.split("\n").find((l) => l.trim()) ?? cleaned;
        return firstLine.length > 90 ? firstLine.slice(0, 87) + "…" : firstLine;
      }
    }
  }
  return "Untitled conversation";
}

function pickPrimaryModel(messages: Message[]): string {
  const counts = new Map<string, number>();
  for (const m of messages) {
    if (m.model) counts.set(m.model, (counts.get(m.model) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [model, count] of counts) {
    if (count > bestCount) {
      best = model;
      bestCount = count;
    }
  }
  return best || "unknown";
}

function attachToolNames(messages: Message[]): void {
  const toolNameById = new Map<string, string>();
  for (const m of messages) {
    for (const b of m.blocks) {
      if (b.kind === "tool_use" && b.toolUseId) toolNameById.set(b.toolUseId, b.name);
    }
  }
  for (const m of messages) {
    for (const b of m.blocks) {
      if (b.kind === "tool_result" && b.toolUseId) {
        b.toolName = toolNameById.get(b.toolUseId);
      }
    }
  }
}

export function normalizeJsonl(
  raw: string,
  meta: { projectId: string; sessionId: string },
): Conversation {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  const messages: Message[] = [];
  let cwd = "";
  let gitBranch: string | undefined;
  let aiTitle: string | undefined;

  for (const line of lines) {
    const entry = safeParse(line);
    if (!entry || !entry.type) continue;
    if (entry.type === AI_TITLE_TYPE) {
      if (typeof entry.aiTitle === "string") {
        const trimmed = entry.aiTitle.trim();
        if (trimmed) aiTitle = trimmed;
      }
      continue;
    }
    if (!RENDERABLE_TYPES.has(entry.type)) continue;
    if (!entry.message) continue;

    if (entry.cwd) cwd = entry.cwd;
    if (entry.gitBranch) gitBranch = entry.gitBranch;

    const blocks = toBlocks(entry.message.content);
    if (blocks.length === 0) continue;

    const usage = toUsage(entry.message.usage);
    const model = entry.message.model;
    const cost = usage ? costForUsage(model, usage) : undefined;

    messages.push({
      uuid: entry.uuid ?? "",
      parentUuid: entry.parentUuid ?? null,
      role: entry.type as "user" | "assistant",
      timestamp: entry.timestamp ?? "",
      model,
      blocks,
      usage,
      cost,
    });
  }

  attachToolNames(messages);

  const totals = messages.reduce(
    (acc, m) => {
      if (m.usage) {
        acc.input += m.usage.inputTokens;
        acc.output += m.usage.outputTokens;
        acc.cacheRead += m.usage.cacheReadTokens;
        acc.cacheWrite += m.usage.cacheWrite5mTokens + m.usage.cacheWrite1hTokens;
      }
      if (m.cost) acc.cost += m.cost;
      return acc;
    },
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
  );

  const startedAt = messages[0]?.timestamp ?? "";
  const endedAt = messages[messages.length - 1]?.timestamp ?? startedAt;

  return {
    projectId: meta.projectId,
    sessionId: meta.sessionId,
    title: aiTitle ?? deriveTitle(messages),
    cwd,
    gitBranch,
    startedAt,
    endedAt,
    messageCount: messages.length,
    primaryModel: pickPrimaryModel(messages),
    totalCost: totals.cost,
    totalInputTokens: totals.input,
    totalOutputTokens: totals.output,
    totalCacheReadTokens: totals.cacheRead,
    totalCacheWriteTokens: totals.cacheWrite,
    // Filled in by sync (computeCacheHealth runs after parse). Harnesses
    // don't know about analysis output, so the parse step leaves this null.
    cacheHealth: null,
    messages,
  };
}
