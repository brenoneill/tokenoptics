// Web Worker entry. Runs heavy work off the main thread:
//  - "sync" jobs: walk a folder, parse sessions, write to IndexedDB
//  - "analyze" jobs: read messages from IndexedDB, run efficiency analysis,
//    write results back

import { analyzeSession } from "../../efficiency";
import { HARNESSES, getHarness } from "../../harnesses";
import { getBrowserConversationStore } from "./store";
import { getDexie, sessionKey } from "./db";
import { browserFolderReader } from "./reader";
import { hashMessagesAsync } from "./hash";
import { syncMount, type SyncProgress } from "./sync";
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

type Inbound =
  | { type: "sync"; jobs: SyncJob[] }
  | { type: "analyze"; jobs: AnalyzeJob[] };

type Outbound =
  | { type: "progress"; harnessId: string; progress: SyncProgress }
  | { type: "done"; harnessId: string; progress: SyncProgress }
  | { type: "analyzed"; projectId: string; sessionId: string; refreshed: boolean }
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

self.onmessage = async (e: MessageEvent<Inbound>) => {
  const msg = e.data;
  if (msg.type === "sync") {
    await runSync(msg.jobs);
  } else if (msg.type === "analyze") {
    await runAnalyze(msg.jobs);
  } else {
    return;
  }
  post({ type: "complete" });
};

export type { AnalyzeJob, Inbound, Outbound, SyncJob };
