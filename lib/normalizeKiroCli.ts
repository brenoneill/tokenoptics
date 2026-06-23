import { costForCredits, costForUsage } from "./pricing";
import type { Conversation, ContentBlock, Message, Usage } from "./types";

// --- Kiro CLI on-disk shapes ------------------------------------------------
//
// A Kiro CLI session is split across two sibling files in ~/.kiro/sessions/cli/:
//
//   <sessionId>.jsonl  — the ordered message stream. One JSON object per line,
//                        each wrapped in a {version, kind, data} envelope.
//                        kind ∈ {Prompt, AssistantMessage, ToolResults, Compaction}.
//                        This is the ONLY place user prompts and tool calls live,
//                        but it carries no token/credit usage.
//
//   <sessionId>.json   — full session state. Has cwd/title/timestamps at the top
//                        level, the per-model rate multiplier in
//                        session_state.rts_model_state.model_info, and per-turn
//                        usage (tokens + metered credits) in
//                        session_state.conversation_metadata.user_turn_metadatas[].
//                        Each turn lists the message_ids it spans.
//
// We render messages from the .jsonl stream and attach per-turn usage from the
// .json, mapping each turn's usage onto the last assistant message in that turn
// (matched by message_id). The credit value Kiro records already includes the
// model's rate multiplier, so cost = credits × $/credit needs no model lookup.

interface KiroEnvelope {
  version?: string;
  kind?: string;
  data?: KiroEnvelopeData;
}

interface KiroEnvelopeData {
  message_id?: string;
  content?: KiroContentBlock[];
  results?: unknown;
  meta?: { timestamp?: number };
  // Compaction
  summary?: string;
}

interface KiroContentBlock {
  kind?: string; // "text" | "toolUse" | "toolResult" | "json" | ...
  data?: unknown;
}

interface KiroToolUseData {
  toolUseId?: string;
  name?: string;
  input?: unknown;
}

interface KiroToolResultData {
  toolUseId?: string;
  content?: unknown;
}

interface KiroMeteringUsage {
  value?: number;
  unit?: string;
}

interface KiroTurnMetadata {
  message_ids?: string[];
  input_token_count?: number;
  output_token_count?: number;
  metering_usage?: KiroMeteringUsage[];
  end_timestamp?: number;
}

interface KiroModelInfo {
  model_id?: string;
  model_name?: string;
  rate_multiplier?: number;
  rate_unit?: string;
  context_window_tokens?: number;
}

interface KiroSessionJson {
  session_id?: string;
  cwd?: string;
  created_at?: string;
  updated_at?: string;
  title?: string;
  session_state?: {
    rts_model_state?: { model_info?: KiroModelInfo | null };
    conversation_metadata?: { user_turn_metadatas?: KiroTurnMetadata[] };
  };
}

// Per-turn usage extracted from the .json, keyed by the assistant message_id it
// should attach to (the last message in the turn).
interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  credits: number;
  endTimestamp?: number;
}

const RENDERABLE_KINDS = new Set([
  "Prompt",
  "AssistantMessage",
  "ToolResults",
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function charCountOf(content: unknown): number {
  if (typeof content === "string") return content.length;
  if (Array.isArray(content)) {
    return content.reduce((sum: number, item) => {
      if (typeof item === "string") return sum + item.length;
      if (isObject(item)) {
        // Kiro tool results nest text under .text or .data.text; sum any strings.
        return sum + charCountOf(Object.values(item));
      }
      return sum;
    }, 0);
  }
  if (isObject(content)) {
    let sum = 0;
    for (const v of Object.values(content)) {
      if (typeof v === "string") sum += v.length;
    }
    return sum;
  }
  return 0;
}

// Map one envelope's content[] into normalized ContentBlocks. role tells us how
// to read text (Prompt + AssistantMessage both use {kind:"text", data:string}).
function blocksFromEnvelope(env: KiroEnvelope): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const content = env.data?.content;
  if (!Array.isArray(content)) return blocks;

  for (const c of content) {
    switch (c.kind) {
      case "text": {
        const text = typeof c.data === "string" ? c.data : "";
        if (text) blocks.push({ kind: "text", text });
        break;
      }
      case "thinking": {
        const text = typeof c.data === "string" ? c.data : "";
        blocks.push({ kind: "thinking", text });
        break;
      }
      case "toolUse": {
        const d = (c.data ?? {}) as KiroToolUseData;
        blocks.push({
          kind: "tool_use",
          toolUseId: d.toolUseId ?? "",
          name: d.name ?? "tool",
          input: d.input ?? {},
        });
        break;
      }
      case "toolResult": {
        const d = (c.data ?? {}) as KiroToolResultData;
        blocks.push({
          kind: "tool_result",
          toolUseId: d.toolUseId ?? "",
          isError: false,
          charCount: charCountOf(d.content),
        });
        break;
      }
      default:
        break;
    }
  }
  return blocks;
}

function roleForKind(kind: string | undefined): "user" | "assistant" | null {
  if (kind === "Prompt") return "user";
  if (kind === "AssistantMessage") return "assistant";
  // ToolResults are tool output fed back to the model — model "user" turn.
  if (kind === "ToolResults") return "user";
  return null;
}

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Build the per-turn usage map from the .json: turnUsage keyed by the LAST
// message_id of each turn, which is where we hang the turn's tokens + credits.
function buildTurnUsage(sessionJson: KiroSessionJson | null): Map<string, TurnUsage> {
  const map = new Map<string, TurnUsage>();
  const turns =
    sessionJson?.session_state?.conversation_metadata?.user_turn_metadatas;
  if (!Array.isArray(turns)) return map;

  for (const turn of turns) {
    const ids = turn.message_ids;
    if (!Array.isArray(ids) || ids.length === 0) continue;
    const anchor = ids[ids.length - 1];

    let credits = 0;
    for (const m of turn.metering_usage ?? []) {
      if (m.unit === "credit" && typeof m.value === "number") credits += m.value;
    }

    map.set(anchor, {
      inputTokens: turn.input_token_count ?? 0,
      outputTokens: turn.output_token_count ?? 0,
      credits,
      endTimestamp: turn.end_timestamp,
    });
  }
  return map;
}

function isoFromUnixSeconds(secs: number | undefined): string {
  if (!secs || !Number.isFinite(secs)) return "";
  return new Date(secs * 1000).toISOString();
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "Untitled conversation";
  for (const block of firstUser.blocks) {
    if (block.kind === "text" && block.text.trim()) {
      const firstLine =
        block.text.split("\n").find((l) => l.trim()) ?? block.text;
      return firstLine.length > 90 ? firstLine.slice(0, 87) + "…" : firstLine;
    }
  }
  return "Untitled conversation";
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

export interface NormalizeKiroCliInput {
  // .jsonl message stream
  jsonl: string;
  // parsed sibling .json (may be null if missing — then no usage/cost)
  sessionJson: KiroSessionJson | null;
  projectId: string;
  sessionId: string;
}

export function normalizeKiroCli(input: NormalizeKiroCliInput): Conversation {
  const { jsonl, sessionJson, projectId, sessionId } = input;

  const modelInfo = sessionJson?.session_state?.rts_model_state?.model_info ?? null;
  const model = modelInfo?.model_id || modelInfo?.model_name || undefined;
  const turnUsage = buildTurnUsage(sessionJson);

  const lines = jsonl.split("\n").filter((l) => l.trim().length > 0);
  const messages: Message[] = [];
  let prevUuid: string | null = null;
  let lastTimestamp = "";

  for (const line of lines) {
    const env = safeParseJson<KiroEnvelope>(line);
    if (!env || !env.kind) continue;
    if (!RENDERABLE_KINDS.has(env.kind)) continue; // skips Compaction

    const role = roleForKind(env.kind);
    if (!role) continue;

    const blocks = blocksFromEnvelope(env);
    if (blocks.length === 0) continue;

    const uuid = env.data?.message_id ?? "";
    const tsSecs = env.data?.meta?.timestamp;
    const timestamp = isoFromUnixSeconds(tsSecs) || lastTimestamp;
    if (timestamp) lastTimestamp = timestamp;

    // Attach this turn's usage if this message is a turn anchor (last id of a
    // turn in the .json). Only assistant messages anchor turns in practice.
    const usageForTurn = uuid ? turnUsage.get(uuid) : undefined;
    let usage: Usage | undefined;
    let cost: number | undefined;
    if (usageForTurn) {
      usage = {
        inputTokens: usageForTurn.inputTokens,
        outputTokens: usageForTurn.outputTokens,
        cacheReadTokens: 0,
        cacheWrite5mTokens: 0,
        cacheWrite1hTokens: 0,
        credits: usageForTurn.credits,
      };
      // Prefer credits (the metered, multiplier-inclusive unit). Fall back to
      // token-based pricing only when no credits were recorded but tokens were.
      if (usageForTurn.credits > 0) {
        cost = costForCredits(usageForTurn.credits);
      } else if (usageForTurn.inputTokens > 0 || usageForTurn.outputTokens > 0) {
        cost = costForUsage(model, usage);
      }
    }

    messages.push({
      uuid,
      parentUuid: prevUuid,
      role,
      timestamp,
      model: role === "assistant" ? model : undefined,
      blocks,
      usage,
      cost,
    });
    prevUuid = uuid || prevUuid;
  }

  attachToolNames(messages);

  const totals = messages.reduce(
    (acc, m) => {
      if (m.usage) {
        acc.input += m.usage.inputTokens;
        acc.output += m.usage.outputTokens;
        acc.credits += m.usage.credits ?? 0;
      }
      if (m.cost) acc.cost += m.cost;
      return acc;
    },
    { input: 0, output: 0, credits: 0, cost: 0 },
  );

  const createdAt = sessionJson?.created_at ?? "";
  const updatedAt = sessionJson?.updated_at ?? "";
  const startedAt = messages[0]?.timestamp || createdAt;
  const endedAt =
    messages[messages.length - 1]?.timestamp || updatedAt || startedAt;

  return {
    projectId,
    sessionId,
    title: sessionJson?.title?.trim() || deriveTitle(messages),
    cwd: sessionJson?.cwd ?? "",
    gitBranch: undefined,
    startedAt,
    endedAt,
    messageCount: messages.length,
    primaryModel: model ?? "unknown",
    totalCost: totals.cost,
    totalInputTokens: totals.input,
    totalOutputTokens: totals.output,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalCredits: totals.credits > 0 ? totals.credits : undefined,
    cacheHealth: null,
    messages,
  };
}

// Exposed for the harness so it can parse the sibling .json itself.
export function parseKiroSessionJson(raw: string): KiroSessionJson | null {
  return safeParseJson<KiroSessionJson>(raw);
}
