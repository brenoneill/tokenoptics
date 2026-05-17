// Web Worker entry. Runs heavy work off the main thread:
//  - "sync" jobs: walk a folder, parse sessions, write to IndexedDB
//  - "analyze" jobs: read messages from IndexedDB, run efficiency analysis,
//    write results back
//  - "analyze-routing" jobs: classify user prompts via Anthropic API, compute
//    per-prompt counterfactual cost, persist a RoutingRunRecord

import { analyzeSession } from "../../efficiency";
import { HARNESSES, getHarness } from "../../harnesses";
import { getBrowserConversationStore } from "./store";
import { getDexie, sessionKey } from "./db";
import { browserFolderReader } from "./reader";
import { hashMessagesAsync } from "./hash";
import { syncMount, type SyncProgress } from "./sync";
import { classifyUserMessage, CLASSIFIER_MODEL } from "../../analyze/anthropic";
import {
  extractPromptSpans,
  extractResponseFeatures,
  mergeContinuations,
  type ClassifiedSpan,
  type PromptSpan,
} from "../../analyze/session";
import { saveRoutingRun } from "../../analyze/store";
import { costForUsage } from "../../pricing";
import type {
  RoutingRunRecord,
  RoutingRunSummary,
  RoutingTurnRecord,
} from "../../analyze/types";
import type { Message } from "../../types";

interface SyncJob {
  harnessId: string;
  handle: FileSystemDirectoryHandle;
}

interface AnalyzeJob {
  // Identifies a (projectId, sessionId) within the worker's known harnesses.
  // The worker resolves the harness by looking up the conversation row.
  projectId: string;
  sessionId: string;
}

interface RoutingJob {
  projectId: string;
  sessionId: string;
  runId: string;
}

type Inbound =
  | { type: "sync"; jobs: SyncJob[] }
  | { type: "analyze"; jobs: AnalyzeJob[] }
  | { type: "analyze-routing"; jobs: RoutingJob[] };

interface RoutingPromptEvent {
  index: number;
  promptPreview: string;
  label?: string;
  error?: string;
}

type Outbound =
  | { type: "progress"; harnessId: string; progress: SyncProgress }
  | { type: "done"; harnessId: string; progress: SyncProgress }
  | { type: "analyzed"; projectId: string; sessionId: string; refreshed: boolean }
  | {
      type: "routing-progress";
      projectId: string;
      sessionId: string;
      completed: number;
      failed: number;
      total: number;
      event?: RoutingPromptEvent;
    }
  | {
      type: "routing-done";
      projectId: string;
      sessionId: string;
      runId: string;
    }
  | { type: "error"; key: string; message: string }
  | { type: "complete" };

function post(msg: Outbound): void {
  self.postMessage(msg);
}

async function runSync(jobs: SyncJob[]): Promise<void> {
  const db = getDexie();
  for (const job of jobs) {
    const harness = getHarness(job.harnessId);
    if (!harness) {
      post({ type: "error", key: job.harnessId, message: `Unknown harness: ${job.harnessId}` });
      continue;
    }
    const reader = browserFolderReader(job.handle);
    try {
      const progress = await syncMount({
        harness,
        reader,
        db,
        onProgress: (p) => post({ type: "progress", harnessId: job.harnessId, progress: p }),
      });
      post({ type: "done", harnessId: job.harnessId, progress });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", key: job.harnessId, message });
    }
  }
}

async function runAnalyze(jobs: AnalyzeJob[]): Promise<void> {
  const db = getDexie();
  const store = getBrowserConversationStore();
  for (const job of jobs) {
    const errorKey = `${job.projectId}:${job.sessionId}`;
    try {
      // Primary-key lookup across known harnesses; see store.ts for why a
      // compound-index range query won't work here.
      let row = undefined;
      for (const h of HARNESSES) {
        row = await db.conversations.get(sessionKey(h.id, job.projectId, job.sessionId));
        if (row) break;
      }
      if (!row) {
        post({ type: "error", key: errorKey, message: "Conversation not indexed" });
        continue;
      }

      // Read all messages for this session in seq order.
      const messageRows = await db.messages
        .where("[sessionKey+seq]")
        .between([row.key, -Infinity], [row.key, Infinity])
        .toArray();
      const messages: Message[] = messageRows
        .sort((a, b) => a.seq - b.seq)
        .map((r) => r.data);

      const contentHash = await hashMessagesAsync(messages);
      const existing = await db.efficiencyDetections.get(row.key);
      if (existing && existing.contentHash === contentHash) {
        post({ type: "analyzed", projectId: job.projectId, sessionId: job.sessionId, refreshed: false });
        continue;
      }

      const summary = analyzeSession(messages);
      await store.replaceEfficiencyAnalysis({
        projectId: job.projectId,
        sessionId: job.sessionId,
        contentHash,
        summary,
      });
      post({ type: "analyzed", projectId: job.projectId, sessionId: job.sessionId, refreshed: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", key: errorKey, message });
    }
  }
}

async function loadSessionMessages(
  projectId: string,
  sessionId: string,
): Promise<Message[] | null> {
  const db = getDexie();
  let row = undefined;
  for (const h of HARNESSES) {
    row = await db.conversations.get(sessionKey(h.id, projectId, sessionId));
    if (row) break;
  }
  if (!row) return null;
  const messageRows = await db.messages
    .where("[sessionKey+seq]")
    .between([row.key, -Infinity], [row.key, Infinity])
    .toArray();
  return messageRows.sort((a, b) => a.seq - b.seq).map((r) => r.data);
}

const CLASSIFY_CONCURRENCY = 4;

interface ClassifySpansResult {
  turns: RoutingTurnRecord[];
  failures: { index: number; promptPreview: string; message: string }[];
}

async function classifySpans(
  spans: PromptSpan[],
  onEvent: (
    completed: number,
    failed: number,
    event: RoutingPromptEvent,
  ) => void,
): Promise<ClassifySpansResult> {
  // Pass 1: classify every span in parallel (results stored by index so the
  // merging pass can walk them in original order).
  const classified: (ClassifiedSpan | null)[] = new Array(spans.length).fill(null);
  const failures: ClassifySpansResult["failures"] = [];
  let cursor = 0;
  let completed = 0;
  let failed = 0;

  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(CLASSIFY_CONCURRENCY, spans.length); w++) {
    workers.push(
      (async () => {
        while (true) {
          const idx = cursor++;
          if (idx >= spans.length) return;
          const span = spans[idx];
          const promptPreview = span.promptText.slice(0, 80);
          try {
            const features = extractResponseFeatures(span);
            const classification = await classifyUserMessage(
              span.promptText,
              features,
              span.priorAssistantContext,
            );
            classified[idx] = { span, classification };
            completed++;
            onEvent(completed, failed, {
              index: idx,
              promptPreview,
              label: classification.label,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            failures.push({ index: idx, promptPreview, message });
            failed++;
            onEvent(completed, failed, {
              index: idx,
              promptPreview,
              error: message,
            });
          }
        }
      })(),
    );
  }
  await Promise.all(workers);

  // Pass 2: merge continuations into the preceding bucket and emit turn
  // records. We drop spans that failed to classify entirely — they break
  // the bucketing chain, but the failure was already surfaced via onEvent.
  const ordered = classified.filter((c): c is ClassifiedSpan => c !== null);
  return {
    turns: mergeContinuations(ordered),
    failures,
  };
}

function summarizeTurns(
  turns: RoutingTurnRecord[],
  totalUserPrompts: number,
  failedCount: number,
): RoutingRunSummary {
  let actualCost = 0;
  let recommendedCost = 0;
  let totalSavings = 0;
  let underSpeccedDelta = 0;
  let savingsCount = 0;
  let alignedCount = 0;
  let underSpeccedCount = 0;
  let classifierInput = 0;
  let classifierOutput = 0;
  let continuationCount = 0;

  for (const t of turns) {
    actualCost += t.actualCost;
    recommendedCost += t.counterfactualCost;
    totalSavings += t.savings;
    underSpeccedDelta += t.underspendDelta;
    if (t.comparison === "savings") savingsCount++;
    else if (t.comparison === "aligned") alignedCount++;
    else underSpeccedCount++;
    classifierInput += t.classifierInputTokens;
    classifierOutput += t.classifierOutputTokens;
    continuationCount += t.followUpReplyCount;
  }

  const classifierCost = costForUsage(CLASSIFIER_MODEL, {
    inputTokens: classifierInput,
    outputTokens: classifierOutput,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
  });

  return {
    totalUserPrompts,
    classifiedCount: turns.length,
    continuationCount,
    skippedCount: failedCount,
    actualCost,
    recommendedCost,
    totalSavings,
    underSpeccedCount,
    underSpeccedDelta,
    alignedCount,
    savingsCount,
    classifierCost,
    classifierModel: CLASSIFIER_MODEL,
  };
}

async function runRouting(jobs: RoutingJob[]): Promise<void> {
  for (const job of jobs) {
    const errorKey = `${job.projectId}:${job.sessionId}`;
    try {
      const messages = await loadSessionMessages(job.projectId, job.sessionId);
      if (!messages) {
        post({ type: "error", key: errorKey, message: "Conversation not indexed" });
        continue;
      }
      const spans = extractPromptSpans(messages);
      if (spans.length === 0) {
        const record: RoutingRunRecord = {
          runId: job.runId,
          projectId: job.projectId,
          sessionId: job.sessionId,
          completedAt: new Date().toISOString(),
          classifierModel: CLASSIFIER_MODEL,
          summary: summarizeTurns([], 0, 0),
          turns: [],
        };
        await saveRoutingRun(record);
        post({
          type: "routing-done",
          projectId: job.projectId,
          sessionId: job.sessionId,
          runId: job.runId,
        });
        continue;
      }

      post({
        type: "routing-progress",
        projectId: job.projectId,
        sessionId: job.sessionId,
        completed: 0,
        failed: 0,
        total: spans.length,
      });

      const { turns, failures } = await classifySpans(
        spans,
        (completed, failed, event) => {
          post({
            type: "routing-progress",
            projectId: job.projectId,
            sessionId: job.sessionId,
            completed,
            failed,
            total: spans.length,
            event,
          });
        },
      );

      if (turns.length === 0 && failures.length > 0) {
        // Every classification failed — surface a single representative error
        // so the UI shows what went wrong instead of an empty saved run.
        post({ type: "error", key: errorKey, message: failures[0].message });
        continue;
      }

      const record: RoutingRunRecord = {
        runId: job.runId,
        projectId: job.projectId,
        sessionId: job.sessionId,
        completedAt: new Date().toISOString(),
        classifierModel: CLASSIFIER_MODEL,
        summary: summarizeTurns(turns, spans.length, failures.length),
        turns,
      };
      await saveRoutingRun(record);
      if (failures.length > 0) {
        post({
          type: "error",
          key: errorKey,
          message: `${failures.length} of ${spans.length} prompts failed to classify (e.g. "${failures[0].message}"). Partial results saved.`,
        });
      }
      post({
        type: "routing-done",
        projectId: job.projectId,
        sessionId: job.sessionId,
        runId: job.runId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", key: errorKey, message });
    }
  }
}

self.onmessage = async (e: MessageEvent<Inbound>) => {
  const msg = e.data;
  if (msg.type === "sync") {
    await runSync(msg.jobs);
  } else if (msg.type === "analyze") {
    await runAnalyze(msg.jobs);
  } else if (msg.type === "analyze-routing") {
    await runRouting(msg.jobs);
  } else {
    return;
  }
  post({ type: "complete" });
};

export type { AnalyzeJob, Inbound, Outbound, RoutingJob, SyncJob };
