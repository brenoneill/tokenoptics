// Main-thread proxies for worker jobs. Each call spawns a worker, runs one
// job batch, and terminates. Spawning is cheap; pooling could be added if
// per-call latency becomes meaningful.

import type { AnalyzeJob, Inbound, Outbound, SyncJob } from "./worker";
import type { SyncProgress } from "./sync";

export type ProgressHandler = (harnessId: string, progress: SyncProgress) => void;

export interface SyncRunResult {
  perHarness: Record<string, SyncProgress>;
  errors: Record<string, string>;
}

export function runSyncInWorker(
  jobs: SyncJob[],
  onProgress?: ProgressHandler,
): Promise<SyncRunResult> {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const result: SyncRunResult = { perHarness: {}, errors: {} };

  return new Promise<SyncRunResult>((resolve, reject) => {
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Sync worker failed"));
    };
    worker.onmessage = (e: MessageEvent<Outbound>) => {
      const msg = e.data;
      switch (msg.type) {
        case "progress":
          onProgress?.(msg.harnessId, msg.progress);
          break;
        case "done":
          result.perHarness[msg.harnessId] = msg.progress;
          onProgress?.(msg.harnessId, msg.progress);
          break;
        case "error":
          result.errors[msg.key] = msg.message;
          break;
        case "complete":
          worker.terminate();
          resolve(result);
          break;
      }
    };

    const startMessage: Inbound = { type: "sync", jobs };
    worker.postMessage(startMessage);
  });
}

export interface AnalyzeRunResult {
  refreshed: { projectId: string; sessionId: string }[];
  errors: Record<string, string>;
}

export function runAnalyzeInWorker(jobs: AnalyzeJob[]): Promise<AnalyzeRunResult> {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const result: AnalyzeRunResult = { refreshed: [], errors: {} };
  return new Promise<AnalyzeRunResult>((resolve, reject) => {
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Analyze worker failed"));
    };
    worker.onmessage = (e: MessageEvent<Outbound>) => {
      const msg = e.data;
      switch (msg.type) {
        case "analyzed":
          if (msg.refreshed) {
            result.refreshed.push({ projectId: msg.projectId, sessionId: msg.sessionId });
          }
          break;
        case "error":
          result.errors[msg.key] = msg.message;
          break;
        case "complete":
          worker.terminate();
          resolve(result);
          break;
      }
    };
    const startMessage: Inbound = { type: "analyze", jobs };
    worker.postMessage(startMessage);
  });
}
