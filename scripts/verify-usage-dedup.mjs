import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { normalizeJsonl } from "../lib/normalize.ts";
import { costForUsage, formatTokens, formatUSD } from "../lib/pricing.ts";

const sessionArg = process.argv[2];

function sumRawAssistant(lines) {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let cost = 0;
  let linesWithUsage = 0;
  const ids = new Set();

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== "assistant" || !entry.message?.usage) continue;
    linesWithUsage += 1;
    const u = entry.message.usage;
    input += u.input_tokens ?? 0;
    output += u.output_tokens ?? 0;
    cacheRead += u.cache_read_input_tokens ?? 0;
    cacheWrite +=
      (u.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
      (u.cache_creation?.ephemeral_1h_input_tokens ?? 0);
    cost += costForUsage(entry.message.model, {
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWrite5mTokens: u.cache_creation?.ephemeral_5m_input_tokens ?? 0,
      cacheWrite1hTokens: u.cache_creation?.ephemeral_1h_input_tokens ?? 0,
    });
    ids.add(entry.message.id ?? entry.uuid);
  }

  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    cost,
    linesWithUsage,
    distinctIds: ids.size,
  };
}

function sumNormalized(messages) {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let cost = 0;
  let withUsage = 0;

  for (const m of messages) {
    if (!m.usage) continue;
    withUsage += 1;
    input += m.usage.inputTokens;
    output += m.usage.outputTokens;
    cacheRead += m.usage.cacheReadTokens;
    cacheWrite += m.usage.cacheWrite5mTokens + m.usage.cacheWrite1hTokens;
    cost += m.cost ?? 0;
  }

  return { input, output, cacheRead, cacheWrite, cost, withUsage };
}

function printTotals(label, totals) {
  console.log(
    `${label}  Input ${formatTokens(totals.input)}  Output ${formatTokens(totals.output)}  Cache read ${formatTokens(totals.cacheRead)}  Cache write ${formatTokens(totals.cacheWrite)}  Cost ${formatUSD(totals.cost)}`,
  );
}

function runSession(filePath, sessionId) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split("\n");
  const before = sumRawAssistant(lines);
  const conv = normalizeJsonl(raw, { projectId: "p", sessionId });
  const after = sumNormalized(conv.messages);

  console.log(`\nSession: ${sessionId}`);
  console.log(
    `  Assistant lines with usage: ${before.linesWithUsage} → ${after.withUsage} (${before.distinctIds} distinct message.id)`,
  );
  printTotals("  BEFORE (naive sum)", before);
  printTotals("  AFTER  (deduped)  ", after);
  if (after.cost > 0) {
    console.log(`  Inflation factor: ${(before.cost / after.cost).toFixed(2)}×`);
  }
  if (Math.abs(conv.totalCost - after.cost) > 1e-9) {
    console.log(
      `  WARN: conversation.totalCost ${formatUSD(conv.totalCost)} != message sum ${formatUSD(after.cost)}`,
    );
  }
}

const defaultDir = join(
  process.env.HOME ?? "",
  ".claude/projects/-Users-brendanoneill-tokenoptics",
);

if (sessionArg) {
  const filePath = sessionArg.includes("/")
    ? sessionArg
    : join(defaultDir, `${sessionArg}.jsonl`);
  runSession(filePath, sessionArg.replace(/\.jsonl$/, ""));
} else {
  for (const f of readdirSync(defaultDir).filter((name) => name.endsWith(".jsonl"))) {
    runSession(join(defaultDir, f), f.replace(/\.jsonl$/, ""));
  }
}
