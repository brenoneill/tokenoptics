import { computeCacheHealth } from "../../analyze/cache";
import type { FolderReader, Harness } from "../../harnesses/types";
import { sessionKey, type TokenopticsDB } from "./db";
import { hashMessagesAsync } from "./hash";

export interface SyncProgress {
  scanned: number;
  parsed: number; // newly written or refreshed
  skipped: number; // unchanged based on mtime
  removed: number; // gone from disk
}

export interface SyncOptions {
  harness: Harness;
  reader: FolderReader;
  db: TokenopticsDB;
  onProgress?: (p: SyncProgress) => void;
  signal?: AbortSignal;
}

// Reconcile one harness mount against the cached index. Mtime-based:
// re-parse only sessions where the file has been touched since last sync,
// and drop cached rows for sessions that have disappeared.
export async function syncMount(opts: SyncOptions): Promise<SyncProgress> {
  const { harness, reader, db, onProgress, signal } = opts;
  const progress: SyncProgress = { scanned: 0, parsed: 0, skipped: 0, removed: 0 };

  const seenKeys = new Set<string>();

  for await (const session of harness.discover(reader)) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    progress.scanned++;
    const key = sessionKey(harness.id, session.projectId, session.sessionId);
    seenKeys.add(key);

    const cached = await db.conversations.get(key);
    if (cached && session.mtimeMs !== undefined && cached.mtimeMs === session.mtimeMs) {
      progress.skipped++;
      onProgress?.(progress);
      continue;
    }

    const raw = await reader.readFile(session.locatorPath);
    if (raw == null) continue;
    const conversation = harness.parse(raw, session);
    if (!conversation) continue;

    const contentHash = await hashMessagesAsync(conversation.messages);
    const cacheHealth = computeCacheHealth(conversation.messages);

    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.conversations.put({
        key,
        harnessId: harness.id,
        projectId: conversation.projectId,
        sessionId: conversation.sessionId,
        title: conversation.title,
        cwd: conversation.cwd,
        gitBranch: conversation.gitBranch,
        startedAt: conversation.startedAt,
        endedAt: conversation.endedAt,
        messageCount: conversation.messageCount,
        primaryModel: conversation.primaryModel,
        totalCost: conversation.totalCost,
        totalInputTokens: conversation.totalInputTokens,
        totalOutputTokens: conversation.totalOutputTokens,
        totalCacheReadTokens: conversation.totalCacheReadTokens,
        totalCacheWriteTokens: conversation.totalCacheWriteTokens,
        cacheHealth,
        mtimeMs: session.mtimeMs ?? 0,
        contentHash,
      });
      // Replace messages atomically. delete-then-bulkPut keeps the
      // transaction simple; for very large sessions a streaming approach
      // (Phase 3 worker) will bulk-insert in batches instead.
      await db.messages.where("sessionKey").equals(key).delete();
      const rows = conversation.messages.map((m, seq) => ({
        sessionKey: key,
        seq,
        uuid: m.uuid,
        data: m,
      }));
      await db.messages.bulkPut(rows);
    });

    progress.parsed++;
    onProgress?.(progress);
  }

  // Reap sessions that are no longer on disk.
  const allCachedKeys = await db.conversations
    .where("harnessId")
    .equals(harness.id)
    .primaryKeys();
  const stale = allCachedKeys.filter((k) => !seenKeys.has(k));
  if (stale.length > 0) {
    await db.transaction(
      "rw",
      [
        db.conversations,
        db.messages,
        db.chunks,
        db.chunkMembers,
        db.efficiencyDetections,
        db.efficiencyTurns,
        db.efficiencySpans,
      ],
      async () => {
        await db.conversations.bulkDelete(stale);
        for (const k of stale) {
          await db.messages.where("sessionKey").equals(k).delete();
          await db.efficiencyDetections.delete(k);
          await db.efficiencyTurns.where("[sessionKey+ord]").between([k, -Infinity], [k, Infinity]).delete();
          await db.efficiencySpans.where("[sessionKey+ord]").between([k, -Infinity], [k, Infinity]).delete();
          // Chunks are user-created annotations — preserve them across re-syncs.
          // (If the underlying session is gone, the chunks become orphans;
          // we keep them so a moved/restored session re-attaches its labels.)
        }
      },
    );
    progress.removed = stale.length;
    onProgress?.(progress);
  }

  await db.mounts.update(harness.id, { lastSyncedAt: new Date().toISOString() });
  return progress;
}
