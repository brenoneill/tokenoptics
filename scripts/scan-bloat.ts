// One-off: scan ~/.claude/projects/ for sessions where the cache analyzer
// fires drift signals (recoverableBloatCost > 0). Pure local read — no
// network calls. Run via:
//
//   npx tsx scripts/scan-bloat.ts
//
// Reuses lib/analyze/cache.ts (the same code the in-app analyzer uses)
// so the verdicts here match what each session would show in the UI.

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { computeCacheReport } from "../lib/analyze/cache";
import { formatUSD } from "../lib/pricing";
import type { Message, Usage } from "../lib/types";

const ROOT = path.join(os.homedir(), ".claude/projects");

interface JsonlAssistantEntry {
  type: "assistant";
  sessionId?: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  cwd?: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation?: {
        ephemeral_5m_input_tokens?: number;
        ephemeral_1h_input_tokens?: number;
      };
    };
  };
}

// We build a minimal Message[] for each session — computeCacheReport only
// reads role, model, and usage. The block list can stay empty.
function toMessage(entry: JsonlAssistantEntry): Message | null {
  const u = entry.message?.usage;
  if (!u) return null;
  const usage: Usage = {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWrite5mTokens: u.cache_creation?.ephemeral_5m_input_tokens ?? 0,
    cacheWrite1hTokens: u.cache_creation?.ephemeral_1h_input_tokens ?? 0,
  };
  return {
    uuid: entry.uuid ?? "",
    parentUuid: entry.parentUuid ?? null,
    role: "assistant",
    timestamp: entry.timestamp ?? "",
    model: entry.message?.model,
    blocks: [],
    usage,
  };
}

async function readSessionMessages(file: string): Promise<{
  sessionId: string;
  messages: Message[];
}> {
  const text = await fs.readFile(file, "utf8");
  const messages: Message[] = [];
  let sessionId = path.basename(file, ".jsonl");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let entry: JsonlAssistantEntry;
    try {
      entry = JSON.parse(line) as JsonlAssistantEntry;
    } catch {
      continue;
    }
    if (entry.type !== "assistant") continue;
    if (entry.sessionId) sessionId = entry.sessionId;
    const msg = toMessage(entry);
    if (msg) messages.push(msg);
  }
  return { sessionId, messages };
}

async function* walkSessionFiles(root: string): AsyncGenerator<{
  projectDir: string;
  file: string;
}> {
  let projects: string[];
  try {
    projects = await fs.readdir(root);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
  for (const project of projects) {
    const projDir = path.join(root, project);
    let entries: string[];
    try {
      entries = await fs.readdir(projDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue;
      yield { projectDir: project, file: path.join(projDir, entry) };
    }
  }
}

interface ScanResult {
  sessionId: string;
  projectDir: string;
  totalCost: number;
  assistantTurnCount: number;
  cacheHitRatio: number;
  finalRampRatio: number;
  aboveBaselineContextCost: number;
  recoverableBloatCost: number;
  recommendationTitles: string[];
}

function decodeProjectDir(name: string): string {
  // Claude Code encodes cwd by replacing path separators with hyphens.
  // We don't try to perfectly reverse that — just strip the leading "-Users-"
  // pattern so the project name is human-skimable in the report.
  return name.replace(/^-/, "/").replace(/-/g, "/");
}

async function main(): Promise<void> {
  const results: ScanResult[] = [];
  let scanned = 0;
  let skipped = 0;

  for await (const { projectDir, file } of walkSessionFiles(ROOT)) {
    scanned += 1;
    const { sessionId, messages } = await readSessionMessages(file);
    if (messages.length === 0) {
      skipped += 1;
      continue;
    }
    const report = computeCacheReport(messages);
    results.push({
      sessionId,
      projectDir,
      totalCost: report.totalCost,
      assistantTurnCount: report.assistantTurnCount,
      cacheHitRatio: report.cacheHitRatio,
      finalRampRatio: report.finalRampRatio,
      aboveBaselineContextCost: report.aboveBaselineContextCost,
      recoverableBloatCost: report.recoverableBloatCost,
      recommendationTitles: report.recommendations.map((r) => r.title),
    });
  }

  const withBloat = results
    .filter((r) => r.recoverableBloatCost > 0)
    .sort((a, b) => b.recoverableBloatCost - a.recoverableBloatCost);

  console.log(
    `Scanned ${scanned} session files (${skipped} had no assistant usage). ` +
      `${withBloat.length} flagged with drift signals.\n`,
  );

  if (withBloat.length === 0) {
    console.log("No sessions tripped any drift signal.");
    console.log(
      "Top 5 sessions by above-baseline context cost (informational only):\n",
    );
    const informational = [...results]
      .filter((r) => r.aboveBaselineContextCost > 0)
      .sort((a, b) => b.aboveBaselineContextCost - a.aboveBaselineContextCost)
      .slice(0, 5);
    for (const r of informational) {
      console.log(formatRow(r));
    }
    return;
  }

  console.log("Sessions with detected bloat (sorted by $ recoverable):\n");
  for (const r of withBloat) {
    console.log(formatRow(r));
  }
}

function formatRow(r: ScanResult): string {
  const proj = decodeProjectDir(r.projectDir);
  const recsBlock =
    r.recommendationTitles.length > 0
      ? `\n    triggers: ${r.recommendationTitles.join(" | ")}`
      : "";
  return [
    `  ${r.sessionId.slice(0, 8)}  ${proj}`,
    `    turns=${r.assistantTurnCount}  totalCost=${formatUSD(r.totalCost)}  hit=${(r.cacheHitRatio * 100).toFixed(0)}%  ramp=${r.finalRampRatio.toFixed(1)}×`,
    `    above-baseline=${formatUSD(r.aboveBaselineContextCost)}  recoverable=${formatUSD(r.recoverableBloatCost)}${recsBlock}`,
  ].join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
