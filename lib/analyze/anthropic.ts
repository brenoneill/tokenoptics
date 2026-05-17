import {
  ALL_LABELS,
  LABEL_DESCRIPTIONS,
  LABEL_TRIGGERS,
  type RoutingLabel,
} from "./routing";
import type { ResponseFeatures } from "./types";

const CLASSIFIER_MODEL = "claude-haiku-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_PROMPT_CHARS = 8000;
const MAX_PRIOR_CONTEXT_CHARS = 1200;

// Returned by the classifier alongside the four routable labels. Marks a
// user prompt as a reply/follow-up to the prior assistant message — not
// independently routable, since the model can't change mid-task. The
// merging pass folds these into the prior bucket.
export const CONTINUATION_LABEL = "continuation" as const;
export type ClassifiedLabel = RoutingLabel | typeof CONTINUATION_LABEL;
const CLASSIFIED_LABELS: ClassifiedLabel[] = [...ALL_LABELS, CONTINUATION_LABEL];

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_ANTHROPIC_API_KEY is not set. Add it to .env.local and rebuild to enable LLM classification.",
    );
    this.name = "MissingApiKeyError";
  }
}

export function getApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  return key && key.trim().length > 0 ? key : null;
}

export interface ClassificationResult {
  label: ClassifiedLabel;
  reasoning: string;
  usage: { inputTokens: number; outputTokens: number };
}

function buildSystemPrompt(): string {
  const labelLines = ALL_LABELS.map((l) => {
    const triggers = LABEL_TRIGGERS[l];
    const triggerHint =
      triggers.length > 0 ? ` (example triggers: ${triggers.join(", ")})` : "";
    return `- ${l}: ${LABEL_DESCRIPTIONS[l]}${triggerHint}`;
  }).join("\n");

  return `You classify a single user prompt from a coding-agent session into ONE intent label.

The agent in question is Claude Code: the user can't change the underlying model mid-task — only between fresh prompts. So when the user is replying to or following up on the assistant's previous message, that work isn't independently routable and must be labeled "continuation".

Labels:
- continuation: The prompt is a reply, follow-up, clarification, approval, or option-pick in response to the assistant's prior message. Short answers ("yes", "A", "go ahead", "proceed", "no, do Y instead") AND longer guidance that builds on what the assistant just proposed ("yes, but also add a test for the empty-input case") both qualify. Use this whenever the user is responding to the assistant rather than launching a new task.
${labelLines}

Inputs you receive:
- <prompt>: the user's message text
- <response_signals>: distilled facts about what the assistant did in reply (tool-call count, output length, thinking used, etc.) — treat as strong evidence of true task complexity, sometimes stronger than the prompt text itself
- <prior_assistant_message>: tail of the assistant's last visible message before this prompt (may be empty for the first prompt of a session)

How to choose:
1. First check <prior_assistant_message>. If the assistant was asking the user something — a question, a plan to approve, a choice between options, a request for clarification — and the user's prompt reads as a response to that, label "continuation". This is true even if the prompt itself sounds substantive ("yes, refactor all three files like you described"): the work is bound to the prior task and prior model.
2. Otherwise, pick from the four routable labels using the prompt and response signals. A prompt that reads trivial but triggered many tool calls / errors / thinking is "implementation" or "planning", not "cleanup". A prompt that looks ambitious but resolved in a single short response is "cleanup". Architecture/design/strategy without writing code is "planning". Use "default_implementation" only when it's clearly a coding task but doesn't fit cleanly elsewhere.

You MUST respond by calling the classify_prompt tool exactly once.`;
}

function formatFeatures(f: ResponseFeatures): string {
  const lines = [
    `- assistant turns: ${f.assistantTurnCount}`,
    `- tool uses: ${f.toolUseCount}${f.toolErrorCount > 0 ? ` (${f.toolErrorCount} returned errors)` : ""}`,
    `- extended thinking used: ${f.thinkingUsed ? "yes" : "no"}`,
    `- assistant text output: ~${f.textChars} chars`,
  ];
  if (f.distinctToolNames.length > 0) {
    const shown = f.distinctToolNames.slice(0, 8).join(", ");
    const more =
      f.distinctToolNames.length > 8
        ? `, +${f.distinctToolNames.length - 8} more`
        : "";
    lines.push(`- distinct tools used: ${shown}${more}`);
  }
  return lines.join("\n");
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

export async function classifyUserMessage(
  prompt: string,
  features: ResponseFeatures,
  priorAssistantContext: string | null,
  opts?: { signal?: AbortSignal },
): Promise<ClassificationResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new MissingApiKeyError();

  const priorTrimmed = trimPriorContext(priorAssistantContext);
  const priorBlock = priorTrimmed
    ? `<prior_assistant_message>
${priorTrimmed}
</prior_assistant_message>`
    : `<prior_assistant_message>(none — first prompt of session)</prior_assistant_message>`;

  const userContent = `Classify this user prompt.

${priorBlock}

<prompt>
${trimPrompt(prompt)}
</prompt>

<response_signals>
${formatFeatures(features)}
</response_signals>`;

  const body = {
    model: CLASSIFIER_MODEL,
    max_tokens: 256,
    system: buildSystemPrompt(),
    tools: [
      {
        name: "classify_prompt",
        description: "Record the routing classification for the user prompt.",
        input_schema: {
          type: "object",
          properties: {
            label: { type: "string", enum: CLASSIFIED_LABELS },
            reasoning: {
              type: "string",
              description:
                "One sentence explaining the choice. Reference the prior assistant message when picking 'continuation', and the response signals when they influenced the call.",
            },
          },
          required: ["label", "reasoning"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "classify_prompt" },
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
    throw new Error("Anthropic response did not include a classify_prompt tool call");
  }
  const input = toolUse.input as { label?: string; reasoning?: string };
  if (!input.label || !CLASSIFIED_LABELS.includes(input.label as ClassifiedLabel)) {
    throw new Error(`Unexpected label in classification: ${input.label}`);
  }
  return {
    label: input.label as ClassifiedLabel,
    reasoning: input.reasoning ?? "",
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

export { CLASSIFIER_MODEL };
