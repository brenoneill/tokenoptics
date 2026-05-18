// Per-span quality classifier. One Haiku call per user prompt. Returns:
//   - relationship label (fresh_task / clean_continuation / info_gap / direction_change)
//   - which recent assistant turns (by index, mapped back to uuid by caller)
//     got invalidated by this prompt
//   - latent info the user could've supplied upfront
//
// Scope is strictly user-side: the prompt explicitly tells the model not to
// flag assistant tool errors or natural design iteration as waste — only
// late-arriving user info or direction changes.

import { getApiKey, MissingApiKeyError } from "./anthropic";
import type { Message } from "../types";
import type { SpanRelationship } from "./quality";

const CLASSIFIER_MODEL = "claude-haiku-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_PROMPT_CHARS = 4000;
const MAX_PRIOR_CONTEXT_CHARS = 1200;
const MAX_TURN_SUMMARY_CHARS = 240;
const RECENT_TURN_WINDOW = 5;

const RELATIONSHIPS: SpanRelationship[] = [
  "fresh_task",
  "clean_continuation",
  "info_gap",
  "direction_change",
];

export interface RecentAssistantTurn {
  // Stable index passed to the model. We map back to uuid on the response.
  index: number;
  uuid: string;
  outputTokens: number;
  summary: string; // first MAX_TURN_SUMMARY_CHARS chars of joined text
  toolUseNames: string[]; // distinct tool names used in this turn
}

export interface QualityClassificationResult {
  relationship: SpanRelationship;
  reason: string;
  latentInfo: string[];
  invalidatedTurnUuids: string[];
  usage: { inputTokens: number; outputTokens: number };
}

function buildSystemPrompt(): string {
  return `You analyze prompt quality in a coding-agent session (Claude Code). For each user prompt, you decide its relationship to the prior task and — when relevant — flag specific prior assistant turns whose output got invalidated.

Scope: USER-SIDE info gaps only. Do NOT label assistant tool errors, misreads, or correctness bugs as waste — those aren't the user's fault. Do NOT treat natural design iteration ("let's go with option A") as waste either; that's the agent working as intended. Waste is specifically about info the USER could have given in the initial prompt but withheld until later.

Relationship labels (pick exactly ONE):

- fresh_task: A new, unrelated task. The user is not building on prior work — they're starting something new.
- clean_continuation: A reply, clarification, approval, option-pick, or natural iteration that did NOT cause rework. Includes design choices among options the assistant offered, answers to assistant questions, and routine refinements. The prior assistant work is still useful.
- info_gap: The user provided information they could have given in the initial prompt — a file path, a framework version, an existing pattern to follow, a scope constraint, a negative requirement — and as a result some prior assistant work was invalidated. Example: assistant searched for and modified the wrong file because the user didn't say which file; user later names the right file.
- direction_change: The user reversed or contradicted prior direction ("no, do X instead", "actually scrap that approach", "let's use Y instead of Z"). The user changed their mind, and prior assistant work toward the abandoned direction is wasted.

When you pick info_gap or direction_change, ALSO:
1. List the specific info the user gave late, in latent_info — short bullet phrases like "file path: lib/auth.ts", "framework: Tailwind v4", "existing pattern: components/Card", "scope: only mobile breakpoint". For direction_change, describe the prior direction that got abandoned.
2. From <recent_assistant_turns>, return invalidated_turn_indices — the indices of assistant turns whose output was rendered useless by this prompt. Be conservative: only include a turn if its work clearly would not have been done given the new info. If unsure, omit. Returning [] is fine.

When you pick fresh_task or clean_continuation, set latent_info=[] and invalidated_turn_indices=[].

You MUST respond by calling the classify_quality tool exactly once.`;
}

function formatTurn(t: RecentAssistantTurn): string {
  const tools =
    t.toolUseNames.length > 0 ? ` tools=[${t.toolUseNames.join(", ")}]` : "";
  return `- [${t.index}] output_tokens=${t.outputTokens}${tools}\n  summary: ${t.summary}`;
}

function trimPrompt(text: string): string {
  if (text.length <= MAX_PROMPT_CHARS) return text;
  const head = text.slice(0, MAX_PROMPT_CHARS - 200);
  const tail = text.slice(-200);
  return `${head}\n\n[... truncated ...]\n\n${tail}`;
}

function trimPriorContext(text: string | null | undefined): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= MAX_PRIOR_CONTEXT_CHARS) return trimmed;
  return `…${trimmed.slice(-MAX_PRIOR_CONTEXT_CHARS)}`;
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  name: string;
  input: unknown;
}
interface AnthropicResponse {
  content: Array<AnthropicToolUseBlock | { type: string; [k: string]: unknown }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export async function classifySpanQuality(
  prompt: string,
  priorAssistantContext: string | null,
  recentTurns: RecentAssistantTurn[],
  opts?: { signal?: AbortSignal },
): Promise<QualityClassificationResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new MissingApiKeyError();

  const priorTrimmed = trimPriorContext(priorAssistantContext);
  const priorBlock = priorTrimmed
    ? `<prior_assistant_message>\n${priorTrimmed}\n</prior_assistant_message>`
    : `<prior_assistant_message>(none — first prompt of session)</prior_assistant_message>`;

  const turnsBlock =
    recentTurns.length > 0
      ? `<recent_assistant_turns>\n${recentTurns.map(formatTurn).join("\n")}\n</recent_assistant_turns>`
      : `<recent_assistant_turns>(none)</recent_assistant_turns>`;

  const userContent = `Classify this user prompt's relationship to prior assistant work.

${priorBlock}

${turnsBlock}

<prompt>
${trimPrompt(prompt)}
</prompt>`;

  const body = {
    model: CLASSIFIER_MODEL,
    max_tokens: 512,
    system: buildSystemPrompt(),
    tools: [
      {
        name: "classify_quality",
        description:
          "Record the prompt-quality classification for this user prompt.",
        input_schema: {
          type: "object",
          properties: {
            relationship: { type: "string", enum: RELATIONSHIPS },
            reason: {
              type: "string",
              description:
                "One sentence. For info_gap/direction_change, cite the specific info the user added late and which turn(s) got invalidated.",
            },
            latent_info: {
              type: "array",
              description:
                "Short bullet phrases naming info the user supplied late that could have been in the initial prompt. Empty for fresh_task / clean_continuation.",
              items: { type: "string" },
            },
            invalidated_turn_indices: {
              type: "array",
              description:
                "Indices from <recent_assistant_turns> whose output was rendered useless by this prompt. Empty for fresh_task / clean_continuation.",
              items: { type: "integer" },
            },
          },
          required: [
            "relationship",
            "reason",
            "latent_info",
            "invalidated_turn_indices",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "classify_quality" },
    messages: [{ role: "user", content: userContent }],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    signal: opts?.signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as AnthropicResponse;
  const toolUse = data.content.find(
    (b): b is AnthropicToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    throw new Error("Anthropic response did not include a classify_quality tool call");
  }
  const input = toolUse.input as {
    relationship?: string;
    reason?: string;
    latent_info?: unknown;
    invalidated_turn_indices?: unknown;
  };
  if (!input.relationship || !RELATIONSHIPS.includes(input.relationship as SpanRelationship)) {
    throw new Error(`Unexpected relationship in classification: ${input.relationship}`);
  }

  const latentInfo = Array.isArray(input.latent_info)
    ? input.latent_info.filter((s): s is string => typeof s === "string")
    : [];
  const rawIndices = Array.isArray(input.invalidated_turn_indices)
    ? input.invalidated_turn_indices.filter((n): n is number => typeof n === "number")
    : [];
  const indexToUuid = new Map<number, string>();
  for (const t of recentTurns) indexToUuid.set(t.index, t.uuid);
  const invalidatedTurnUuids: string[] = [];
  for (const i of rawIndices) {
    const uuid = indexToUuid.get(i);
    if (uuid) invalidatedTurnUuids.push(uuid);
  }

  return {
    relationship: input.relationship as SpanRelationship,
    reason: input.reason ?? "",
    latentInfo,
    invalidatedTurnUuids,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

// Helpers for building recent-turn windows the classifier sees. Caller hands
// us the assistant messages from the last N spans (or fewer) in chronological
// order; we return at most RECENT_TURN_WINDOW most-recent turns.
export function buildRecentTurnWindow(
  messages: Message[],
  startingIndex: number,
): RecentAssistantTurn[] {
  const turns: RecentAssistantTurn[] = [];
  let idx = startingIndex;
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    const textParts: string[] = [];
    const toolUseNames = new Set<string>();
    for (const block of m.blocks) {
      if (block.kind === "text" && block.text.trim()) textParts.push(block.text);
      else if (block.kind === "tool_use") toolUseNames.add(block.name);
    }
    const joined = textParts.join("\n").trim();
    const summary =
      joined.length <= MAX_TURN_SUMMARY_CHARS
        ? joined
        : `${joined.slice(0, MAX_TURN_SUMMARY_CHARS)}…`;
    turns.push({
      index: idx++,
      uuid: m.uuid,
      outputTokens: m.usage?.outputTokens ?? 0,
      summary: summary || "(no text — tool-only turn)",
      toolUseNames: Array.from(toolUseNames).sort(),
    });
  }
  if (turns.length <= RECENT_TURN_WINDOW) return turns;
  return turns.slice(-RECENT_TURN_WINDOW);
}

export { CLASSIFIER_MODEL as QUALITY_CLASSIFIER_MODEL, RECENT_TURN_WINDOW };
