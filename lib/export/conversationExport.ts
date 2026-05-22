// Conversation export — packages a Claude Code session (transcript + computed
// analysis) into a self-contained document the user can feed to an AI provider
// for QA analysis, primarily to investigate context drift.
//
// Pure functions over already-in-memory data — no network, no worker, no
// persistence. The view page already runs computeCacheReport synchronously on
// the main thread; building a string from the same data is the same shape of
// work.

import type { CacheSessionReport } from "../analyze/cache";
import type { QualityRunRecord } from "../analyze/quality";
import type { RoutingRunRecord } from "../analyze/types";
import { projectLabel } from "../conversation";
import { diffsForTool, filePathFor, isDiffTool, statsForTool, type DiffLine } from "../diff";
import { formatTokens, formatUSD } from "../pricing";
import { userPromptText } from "../transcript";
import type { Chunk } from "../labeling/types";
import type { Conversation, Message } from "../types";

export interface ExportInput {
  conversation: Conversation;
  chunks: Chunk[];
  cacheReport: CacheSessionReport;
  routingRun: RoutingRunRecord | null;
  qualityRun: QualityRunRecord | null;
}

export interface ExportOptions {
  // How much of the session body to include:
  //   "structural" — numbers only: prompts, action summaries, costs, line
  //                  counts. No source code anywhere — the right choice for
  //                  bloat / drift analysis.
  //   "full"       — also includes the assistant's written output.
  //   "code"       — also includes the line-by-line diff of every file edit,
  //                  i.e. the actual code. For debugging / root-cause work.
  detail: "structural" | "full" | "code";
}

// --- intermediate model -----------------------------------------------------
// Both the Markdown and JSON builders work off this shared representation so
// the two formats never drift apart.

interface ActionEntry {
  kind: "tool" | "edit";
  tool: string;
  // For "tool": a human-readable input summary. For "edit": the file path.
  detail: string;
  added?: number;
  removed?: number;
  // Unified-style diff text of an edit. Only populated for edits, and only
  // when the export detail level is "code" — otherwise no source code is
  // ever placed in the document.
  diff?: string;
}

interface SpanSummary {
  // 1-based prompt number (P1, P2, …). null = activity before the first
  // genuine user prompt.
  index: number | null;
  uuid: string;
  timestamp: string;
  promptText: string;
  assistantTurnCount: number;
  toolCallCount: number;
  editCount: number;
  linesAdded: number;
  linesRemoved: number;
  toolErrorCount: number;
  thinkingUsed: boolean;
  actions: ActionEntry[];
  assistantText: string[];
  cost: number;
  // Every message uuid in the span — used to map topic segments to prompts.
  messageUuids: string[];
}

// Mirrors the (non-exported) helper in components/conversation/ToolUseBlock.tsx
// so an exported action reads the same as the on-screen tool_use block.
function summarizeToolInput(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input === "string") return input;
  if (typeof input !== "object") return String(input);
  const obj = input as Record<string, unknown>;
  for (const key of ["command", "file_path", "query", "path", "url", "pattern", "description"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return `${key}: ${value}`;
  }
  try {
    const compact = JSON.stringify(obj);
    return compact.length > 140 ? compact.slice(0, 137) + "…" : compact;
  } catch {
    return "";
  }
}

// Renders the structured diff of a file edit as unified-style text — "+" for
// added lines, "-" for removed, " " for context. Multiple edit pairs (e.g.
// MultiEdit) are separated by a blank line.
function renderDiffText(diffs: DiffLine[][]): string {
  return diffs
    .map((diff) =>
      diff
        .map((entry) => {
          const prefix =
            entry.kind === "add" ? "+" : entry.kind === "remove" ? "-" : " ";
          return prefix + entry.line;
        })
        .join("\n"),
    )
    .join("\n\n");
}

function newSpan(index: number | null, m: Message, promptText: string): SpanSummary {
  return {
    index,
    uuid: m.uuid,
    timestamp: m.timestamp,
    promptText,
    assistantTurnCount: 0,
    toolCallCount: 0,
    editCount: 0,
    linesAdded: 0,
    linesRemoved: 0,
    toolErrorCount: 0,
    thinkingUsed: false,
    actions: [],
    assistantText: [],
    cost: 0,
    messageUuids: [],
  };
}

// `withCode` decides whether each edit also carries its line-by-line diff.
// When false (the default for bloat analysis) no source code is captured at
// all — only the file path and line counts.
function accumulate(span: SpanSummary, m: Message, withCode: boolean): void {
  span.messageUuids.push(m.uuid);
  if (typeof m.cost === "number") span.cost += m.cost;
  if (m.role === "assistant") span.assistantTurnCount += 1;
  for (const block of m.blocks) {
    // Thinking blocks lose their text on the round-trip (AGENTS.md rule 8) —
    // the block's presence is the only signal, so that is all we record.
    if (block.kind === "thinking") span.thinkingUsed = true;
    if (block.kind === "text" && m.role === "assistant" && block.text.trim()) {
      span.assistantText.push(block.text.trim());
    }
    if (block.kind === "tool_result" && block.isError) span.toolErrorCount += 1;
    if (block.kind === "tool_use") {
      if (isDiffTool(block.name)) {
        const stats = statsForTool(block.name, block.input);
        span.editCount += 1;
        span.linesAdded += stats.added;
        span.linesRemoved += stats.removed;
        const action: ActionEntry = {
          kind: "edit",
          tool: block.name,
          detail: filePathFor(block.input),
          added: stats.added,
          removed: stats.removed,
        };
        if (withCode) {
          const diff = renderDiffText(diffsForTool(block.name, block.input));
          if (diff) action.diff = diff;
        }
        span.actions.push(action);
      } else {
        span.toolCallCount += 1;
        span.actions.push({
          kind: "tool",
          tool: block.name,
          detail: summarizeToolInput(block.input),
        });
      }
    }
  }
}

// Segments the conversation into prompt spans: each genuine user prompt plus
// every message that followed it, up to the next prompt. A "prompt" is a user
// message that userPromptText() resolves to non-null text — the same rule the
// transcript view uses.
function buildSpans(messages: Message[], withCode: boolean): SpanSummary[] {
  const spans: SpanSummary[] = [];
  let current: SpanSummary | null = null;
  let promptCounter = 0;

  for (const m of messages) {
    const promptText = m.role === "user" ? userPromptText(m) : null;
    if (promptText !== null) {
      if (current) spans.push(current);
      promptCounter += 1;
      current = newSpan(promptCounter, m, promptText);
      current.messageUuids.push(m.uuid);
      continue;
    }
    if (!current) current = newSpan(null, m, "");
    accumulate(current, m, withCode);
  }
  if (current) spans.push(current);
  return spans;
}

// --- formatting helpers -----------------------------------------------------

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(0)}%`;
}

function sessionDurationMs(c: Conversation): number {
  const start = Date.parse(c.startedAt);
  const end = Date.parse(c.endedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, end - start);
}

// Markdown table-cell sanitiser — collapse newlines and escape pipes.
function cell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function mdTable(headers: string[], rows: string[][]): string[] {
  const out = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) out.push(`| ${row.map(cell).join(" | ")} |`);
  return out;
}

// Renders a prompt as a Markdown blockquote so multi-line prompts stay clearly
// delimited from the surrounding document.
function blockquote(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "> _(empty)_";
  return trimmed
    .split("\n")
    .map((l) => (l ? `> ${l}` : ">"))
    .join("\n");
}

// --- Markdown builder -------------------------------------------------------

export function buildMarkdownExport(input: ExportInput, opts: ExportOptions): string {
  const { conversation, chunks, cacheReport, routingRun, qualityRun } = input;
  const withCode = opts.detail === "code";
  const withProse = opts.detail !== "structural";
  const spans = buildSpans(conversation.messages, withCode);
  const promptSpans = spans.filter((s) => s.index !== null);
  const out: string[] = [];

  out.push(`# Claude Code Session Export — ${conversation.title}`);
  out.push("");
  out.push(`_Generated by tokenoptics on ${new Date().toISOString()}._`);
  out.push("");

  // --- Session overview ---
  out.push("## Session overview");
  out.push("");
  out.push(...mdTable(
    ["Field", "Value"],
    [
      ["Project", projectLabel(conversation)],
      ["Git branch", conversation.gitBranch ?? "—"],
      ["Primary model", conversation.primaryModel],
      ["Session ID", conversation.sessionId],
      ["Started", conversation.startedAt],
      ["Ended", conversation.endedAt],
      ["Duration", formatDuration(sessionDurationMs(conversation))],
      ["Messages", String(conversation.messageCount)],
      ["User prompts", String(promptSpans.length)],
      ["Assistant turns", String(cacheReport.assistantTurnCount)],
      ["Total cost", formatUSD(conversation.totalCost)],
      ["Input tokens", formatTokens(conversation.totalInputTokens)],
      ["Output tokens", formatTokens(conversation.totalOutputTokens)],
      ["Cache read tokens", formatTokens(conversation.totalCacheReadTokens)],
      ["Cache write tokens", formatTokens(conversation.totalCacheWriteTokens)],
      ["Cache health", conversation.cacheHealth ?? "not assessed"],
    ],
  ));
  out.push("");

  // --- Drift signals ---
  out.push("## Drift signals");
  out.push("");
  out.push(
    "Computed from token-usage fields. These are the quantitative indicators " +
      "of context drift — read them alongside the transcript below.",
  );
  out.push("");
  out.push(...mdTable(
    ["Metric", "Value", "What it means"],
    [
      [
        "Cache hit ratio",
        formatPct(cacheReport.cacheHitRatio),
        "Share of input tokens served from cache. Falls when the session sprawls.",
      ],
      [
        "Final ramp ratio",
        `${cacheReport.finalRampRatio.toFixed(1)}×`,
        "Cost of the last 3 turns vs the early-session baseline. >3× = climbing.",
      ],
      [
        "Cache-read cost share",
        formatPct(cacheReport.cacheReadCostShare),
        "Share of total cost spent re-processing the conversation's own history.",
      ],
      [
        "Above-baseline context cost",
        `${formatUSD(cacheReport.aboveBaselineContextCost)} (${formatPct(cacheReport.aboveBaselineContextShare)})`,
        "Cost of carrying history above a focused-session baseline.",
      ],
      [
        "Likely recoverable bloat",
        formatUSD(cacheReport.recoverableBloatCost),
        "Above-baseline cost that drift signals flag as genuinely recoverable.",
      ],
    ],
  ));
  out.push("");

  if (cacheReport.recommendations.length > 0) {
    out.push("### Recommendations");
    out.push("");
    for (const rec of cacheReport.recommendations) {
      out.push(`- **[${rec.severity}] ${rec.title}** — ${rec.message}`);
    }
    out.push("");
  } else {
    out.push("_No drift recommendations fired for this session._");
    out.push("");
  }

  if (cacheReport.trajectory.length > 0) {
    out.push("### Cost-per-turn trajectory");
    out.push("");
    out.push("Each assistant turn in order. A rising cost with `cache_read` as the dominant bucket is the signature of drift.");
    out.push("");
    out.push(...mdTable(
      ["Turn", "Model", "Cost", "Cumulative", "Dominant bucket"],
      cacheReport.trajectory.map((p) => [
        String(p.turnIndex),
        p.model ?? "—",
        formatUSD(p.cost),
        formatUSD(p.cumulativeCost),
        p.dominantBucket,
      ]),
    ));
    out.push("");
  }

  // --- Topic segments ---
  if (chunks.length > 0) {
    out.push("## Topic segments");
    out.push("");
    out.push("User-labelled segments of this session. Each lists the prompts (P-numbers) it covers — a useful cross-reference for spotting where topics changed.");
    out.push("");
    const sorted = [...chunks].sort((a, b) => a.ord - b.ord);
    for (const chunk of sorted) {
      const members = new Set(chunk.memberMsgUuids);
      const covered = promptSpans
        .filter((s) => s.messageUuids.some((u) => members.has(u)))
        .map((s) => `P${s.index}`);
      out.push(`### ${chunk.ord + 1}. ${chunk.title}`);
      out.push("");
      out.push(...mdTable(
        ["Field", "Value"],
        [
          ["Type", chunk.type ?? "—"],
          ["Prompts covered", covered.length > 0 ? covered.join(", ") : "—"],
          ["Messages", String(chunk.messageCount)],
          ["Prompts", String(chunk.promptCount)],
          ["Tool errors", String(chunk.errorCount)],
          ["Cost", formatUSD(chunk.totalCost)],
        ],
      ));
      if (chunk.summary.trim()) {
        out.push("");
        out.push(chunk.summary.trim());
      }
      out.push("");
    }
  }

  // --- Routing analysis ---
  if (routingRun) {
    const s = routingRun.summary;
    out.push("## Routing analysis");
    out.push("");
    out.push(
      `${s.classifiedCount} prompts classified by ${routingRun.classifierModel}. ` +
        `Aligned: ${s.alignedCount} · Could downgrade: ${s.savingsCount} · ` +
        `Under-specced: ${s.underSpeccedCount}. ` +
        `Potential savings: ${formatUSD(s.totalSavings)}.`,
    );
    out.push("");
    if (routingRun.turns.length > 0) {
      out.push(...mdTable(
        ["Prompt", "Label", "Used", "Recommended", "Verdict", "Actual", "Counterfactual"],
        routingRun.turns.map((t) => [
          t.promptPreview,
          t.label,
          t.actualModel ?? "—",
          t.recommendedModel,
          t.comparison,
          formatUSD(t.actualCost),
          formatUSD(t.counterfactualCost),
        ]),
      ));
      out.push("");
    }
  }

  // --- Quality analysis ---
  if (qualityRun) {
    const s = qualityRun.summary;
    out.push("## Quality analysis");
    out.push("");
    out.push(
      `${s.totalTasks} tasks · ${s.wastefulTaskCount} with rework from user-side ` +
        `information gaps. Wasted output: ${formatTokens(s.totalWastedOutputTokens)} tokens ` +
        `(${formatUSD(s.totalWastedCost)}).`,
    );
    out.push("");
    for (const task of qualityRun.tasks) {
      out.push(
        `- **${task.leadPromptPreview}** — category: \`${task.category}\`` +
          (task.wastedCost > 0
            ? ` · wasted ${formatUSD(task.wastedCost)} (${formatTokens(task.wastedOutputTokens)} output tokens)`
            : ""),
      );
      if (task.reason.trim()) out.push(`  - Reason: ${task.reason.trim()}`);
      if (task.latentInfo.length > 0) {
        out.push(`  - Late-supplied info: ${task.latentInfo.join("; ")}`);
      }
    }
    out.push("");
  }

  // --- Transcript ---
  out.push("## Transcript");
  out.push("");
  out.push("Each prompt span below is the user prompt followed by what the assistant did in response.");
  out.push("");

  for (const span of spans) {
    const short = span.uuid.slice(0, 8);
    if (span.index === null) {
      out.push(`### Session start — before first prompt · ${short}`);
    } else {
      out.push(`### P${span.index} — ${span.timestamp} · ${short}`);
    }
    out.push("");
    if (span.index !== null) {
      out.push("**User prompt:**");
      out.push("");
      out.push(blockquote(span.promptText));
      out.push("");
    }

    const aggregate = [
      `${span.assistantTurnCount} assistant turn${span.assistantTurnCount === 1 ? "" : "s"}`,
      `${span.toolCallCount} tool call${span.toolCallCount === 1 ? "" : "s"}`,
      `${span.editCount} file edit${span.editCount === 1 ? "" : "s"}`,
      `+${span.linesAdded}/-${span.linesRemoved} lines`,
      `${formatUSD(span.cost)}`,
    ];
    if (span.toolErrorCount > 0) aggregate.push(`${span.toolErrorCount} tool errors`);
    if (span.thinkingUsed) aggregate.push("thinking used");
    out.push(`**Assistant work:** ${aggregate.join(" · ")}`);
    out.push("");

    if (withProse && span.assistantText.length > 0) {
      out.push("_Assistant output:_");
      out.push("");
      for (const text of span.assistantText) {
        out.push(blockquote(text));
        out.push("");
      }
    }

    if (span.actions.length > 0) {
      out.push("_Actions:_");
      out.push("");
      for (const a of span.actions) {
        if (a.kind === "edit") {
          out.push(`- \`${a.tool}\` ${a.detail} (+${a.added ?? 0}/-${a.removed ?? 0})`);
        } else {
          out.push(`- \`${a.tool}\`${a.detail ? ` — ${a.detail}` : ""}`);
        }
      }
      out.push("");
    }

    // Diffs are the only place actual source code appears — gated on the
    // "code" detail level so a bloat-analysis export carries none.
    if (withCode) {
      const diffs = span.actions.filter(
        (a): a is ActionEntry & { diff: string } => a.kind === "edit" && !!a.diff,
      );
      if (diffs.length > 0) {
        out.push("_Diffs:_");
        out.push("");
        for (const a of diffs) {
          out.push(`\`${a.detail}\` — \`${a.tool}\``);
          out.push("");
          // Four-backtick fence so triple-backticks inside the file survive.
          out.push("````diff");
          out.push(a.diff);
          out.push("````");
          out.push("");
        }
      }
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// --- filename ---------------------------------------------------------------

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "session"
  );
}

export function exportFilename(conversation: Conversation): string {
  const short = conversation.sessionId.slice(0, 8) || "session";
  return `tokenoptics-${slug(projectLabel(conversation))}-${short}.md`;
}
