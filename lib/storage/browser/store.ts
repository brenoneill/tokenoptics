import { browserFolderReader } from "./reader";
import { getDexie, sessionKey, type ConversationRow, type TokenopticsDB } from "./db";
import { syncMount, type SyncOptions, type SyncProgress } from "./sync";
import {
  ConversationStoreMissingError,
  type ConversationStore,
  type HarnessConnection,
  type InsertChunkArgs,
  type ReplaceEfficiencyArgs,
  type UpdateChunkArgs,
} from "../types";
import { getHarness, HARNESSES } from "../../harnesses";
import type { FolderReader } from "../../harnesses/types";
import { analysisKey } from "../../labeling/keys";
import { computeChunkMemberMetrics } from "../../labeling/metrics";
import type { Chunk, ChunkType } from "../../labeling/types";
import { isChunkType } from "../../labeling/types";
import type {
  EfficiencyDetectionRecord,
  EfficiencyTurnRecord,
  SessionEfficiencyAggregate,
  SpanEfficiencyRecord,
} from "../../efficiency/types";
import type { Conversation, ConversationSummary, Message } from "../../types";

function toSummary(row: ConversationRow): ConversationSummary {
  return {
    projectId: row.projectId,
    sessionId: row.sessionId,
    title: row.title,
    cwd: row.cwd,
    gitBranch: row.gitBranch,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    messageCount: row.messageCount,
    primaryModel: row.primaryModel,
    totalCost: row.totalCost,
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    totalCacheReadTokens: row.totalCacheReadTokens,
    totalCacheWriteTokens: row.totalCacheWriteTokens,
  };
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

class BrowserConversationStore implements ConversationStore {
  constructor(private readonly db: TokenopticsDB) {}

  // Primary-key lookup across harnesses. Compound-index range queries can't
  // pin (projectId, sessionId) while leaving harnessId free — the index is
  // lexicographic, so [minKey, p, s]…[maxKey, p, s] matches every row.
  private async findConversationRow(
    projectId: string,
    sessionId: string,
  ): Promise<ConversationRow | undefined> {
    for (const h of HARNESSES) {
      const row = await this.db.conversations.get(sessionKey(h.id, projectId, sessionId));
      if (row) return row;
    }
    return undefined;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const rows = await this.db.conversations.orderBy("endedAt").reverse().toArray();
    return rows.map(toSummary);
  }

  async getConversation(projectId: string, sessionId: string): Promise<Conversation | null> {
    const row = await this.findConversationRow(projectId, sessionId);
    if (!row) return null;

    const messageRows = await this.db.messages
      .where("[sessionKey+seq]")
      .between([row.key, -Infinity], [row.key, Infinity])
      .toArray();
    const messages: Message[] = messageRows
      .sort((a, b) => a.seq - b.seq)
      .map((r) => r.data);

    return { ...toSummary(row), messages };
  }

  async getChunks(projectId: string, sessionId: string, messages: Message[]): Promise<Chunk[]> {
    const conv = await this.findConversationRow(projectId, sessionId);
    if (!conv) return [];

    const chunkRows = await this.db.chunks.where("sessionKey").equals(conv.key).toArray();
    if (chunkRows.length === 0) return [];

    const memberRows = await this.db.chunkMembers
      .where("chunkId")
      .anyOf(chunkRows.map((c) => c.id))
      .toArray();
    const membersByChunk = new Map<string, string[]>();
    for (const row of memberRows) {
      const list = membersByChunk.get(row.chunkId);
      if (list) list.push(row.messageUuid);
      else membersByChunk.set(row.chunkId, [row.messageUuid]);
    }

    const indexByUuid = new Map<string, number>();
    messages.forEach((m, i) => indexByUuid.set(m.uuid, i));

    const enriched = chunkRows.map((row) => {
      const memberMsgUuids = (membersByChunk.get(row.id) ?? [])
        .filter((uuid) => indexByUuid.has(uuid))
        .sort((a, b) => (indexByUuid.get(a) ?? 0) - (indexByUuid.get(b) ?? 0));
      const metrics = computeChunkMemberMetrics(memberMsgUuids, messages);
      const type: ChunkType | null = isChunkType(row.type) ? row.type : null;
      return {
        id: row.id,
        projectId,
        sessionId,
        type,
        title: row.title,
        summary: row.summary,
        memberMsgUuids,
        createdAt: row.createdAt,
        startMsgUuid: metrics.startMsgUuid,
        endMsgUuid: metrics.endMsgUuid,
        messageCount: metrics.messageCount,
        promptCount: metrics.promptCount,
        errorCount: metrics.errorCount,
        totalCost: metrics.totalCost,
        startIdx: metrics.startIdx,
      };
    });

    enriched.sort((a, b) => {
      if (a.startIdx !== b.startIdx) return a.startIdx - b.startIdx;
      return a.createdAt < b.createdAt ? -1 : 1;
    });

    return enriched.map((c, ord): Chunk => ({
      id: c.id,
      projectId,
      sessionId,
      type: c.type,
      title: c.title,
      summary: c.summary,
      memberMsgUuids: c.memberMsgUuids,
      createdAt: c.createdAt,
      ord,
      startMsgUuid: c.startMsgUuid,
      endMsgUuid: c.endMsgUuid,
      messageCount: c.messageCount,
      promptCount: c.promptCount,
      errorCount: c.errorCount,
      totalCost: c.totalCost,
    }));
  }

  async getSessionsWithChunks(): Promise<Set<string>> {
    const sessionKeys = (await this.db.chunks.orderBy("sessionKey").uniqueKeys()) as string[];
    const out = new Set<string>();
    for (const sk of sessionKeys) {
      const parts = sk.split("::");
      // sessionKey is `${harnessId}::${projectId}::${sessionId}`
      if (parts.length !== 3) continue;
      out.add(analysisKey(parts[1], parts[2]));
    }
    return out;
  }

  async insertChunk(args: InsertChunkArgs): Promise<string> {
    if (args.memberMsgUuids.length === 0) {
      throw new Error("Cannot create a chunk with no member messages");
    }
    const conv = await this.findConversationRow(args.projectId, args.sessionId);
    if (!conv) throw new Error("Conversation not found");

    const id = randomId();
    const now = new Date().toISOString();
    await this.db.transaction("rw", this.db.chunks, this.db.chunkMembers, async () => {
      await this.db.chunks.add({
        id,
        sessionKey: conv.key,
        type: args.type,
        title: args.title,
        summary: args.summary,
        createdAt: now,
      });
      await this.db.chunkMembers.bulkAdd(
        args.memberMsgUuids.map((uuid) => ({ chunkId: id, messageUuid: uuid })),
      );
    });
    return id;
  }

  async updateChunk(chunkId: string, args: UpdateChunkArgs): Promise<boolean> {
    const updated = await this.db.chunks.update(chunkId, {
      type: args.type,
      title: args.title,
      summary: args.summary,
    });
    return updated > 0;
  }

  async deleteChunk(chunkId: string): Promise<void> {
    await this.db.transaction("rw", this.db.chunks, this.db.chunkMembers, async () => {
      await this.db.chunks.delete(chunkId);
      await this.db.chunkMembers.where("chunkId").equals(chunkId).delete();
    });
  }

  async getEfficiencyDetection(
    projectId: string,
    sessionId: string,
  ): Promise<EfficiencyDetectionRecord | null> {
    const conv = await this.findConversation(projectId, sessionId);
    if (!conv) return null;
    const row = await this.db.efficiencyDetections.get(conv.key);
    return row ? (row.data as EfficiencyDetectionRecord) : null;
  }

  async getEfficiencySpans(projectId: string, sessionId: string): Promise<SpanEfficiencyRecord[]> {
    const conv = await this.findConversation(projectId, sessionId);
    if (!conv) return [];
    const rows = await this.db.efficiencySpans
      .where("[sessionKey+ord]")
      .between([conv.key, -Infinity], [conv.key, Infinity])
      .toArray();
    return rows.sort((a, b) => a.ord - b.ord).map((r) => r.data as SpanEfficiencyRecord);
  }

  async getEfficiencyTurns(projectId: string, sessionId: string): Promise<EfficiencyTurnRecord[]> {
    const conv = await this.findConversation(projectId, sessionId);
    if (!conv) return [];
    const rows = await this.db.efficiencyTurns
      .where("[sessionKey+ord]")
      .between([conv.key, -Infinity], [conv.key, Infinity])
      .toArray();
    return rows.sort((a, b) => a.ord - b.ord).map((r) => r.data as EfficiencyTurnRecord);
  }

  async getAllEfficiencyAggregates(): Promise<Map<string, SessionEfficiencyAggregate>> {
    const rows = await this.db.efficiencyDetections.toArray();
    const map = new Map<string, SessionEfficiencyAggregate>();
    for (const row of rows) {
      const detection = row.data as EfficiencyDetectionRecord;
      map.set(analysisKey(detection.projectId, detection.sessionId), {
        totalTurns: detection.totalTurns,
        needed: detection.needed,
        sonnetSufficient: detection.sonnetSufficient,
        haikuSufficient: detection.haikuSufficient,
        ambiguous: detection.ambiguous,
        actualCost: detection.actualCost,
        counterfactualCost: detection.counterfactualCost,
        wasteTotal: detection.waste.total,
      });
    }
    return map;
  }

  async replaceEfficiencyAnalysis(
    args: ReplaceEfficiencyArgs,
  ): Promise<EfficiencyDetectionRecord> {
    const conv = await this.findConversation(args.projectId, args.sessionId);
    if (!conv) throw new Error("Conversation not found");
    const now = new Date().toISOString();

    const detection: EfficiencyDetectionRecord = {
      projectId: args.projectId,
      sessionId: args.sessionId,
      contentHash: args.contentHash,
      analyzedAt: now,
      totalTurns: args.summary.totalTurns,
      needed: args.summary.needed,
      sonnetSufficient: args.summary.sonnetSufficient,
      haikuSufficient: args.summary.haikuSufficient,
      ambiguous: args.summary.ambiguous,
      actualCost: args.summary.actualCost,
      counterfactualCost: args.summary.counterfactualCost,
      waste: args.summary.totalWaste,
      validation: args.summary.validation,
      spans: {
        totalSpans: args.summary.spans.totalSpans,
        needed: args.summary.spans.needed,
        sonnetSufficient: args.summary.spans.sonnetSufficient,
        haikuSufficient: args.summary.spans.haikuSufficient,
        ambiguous: args.summary.spans.ambiguous,
        actualCost: args.summary.spans.actualCost,
        counterfactualCost: args.summary.spans.counterfactualCost,
        waste: args.summary.spans.totalWaste,
      },
    };

    await this.db.transaction(
      "rw",
      this.db.efficiencyDetections,
      this.db.efficiencyTurns,
      this.db.efficiencySpans,
      async () => {
        await this.db.efficiencyDetections.put({
          sessionKey: conv.key,
          contentHash: args.contentHash,
          analyzedAt: now,
          data: detection,
        });
        await this.db.efficiencyTurns
          .where("[sessionKey+ord]")
          .between([conv.key, -Infinity], [conv.key, Infinity])
          .delete();
        await this.db.efficiencySpans
          .where("[sessionKey+ord]")
          .between([conv.key, -Infinity], [conv.key, Infinity])
          .delete();

        const turnRows = args.summary.turns.map((turn, ord) => {
          const cacheWriteTokens =
            turn.shape.cacheWrite5mTokens + turn.shape.cacheWrite1hTokens;
          const record: EfficiencyTurnRecord = {
            id: randomId(),
            projectId: args.projectId,
            sessionId: args.sessionId,
            ord,
            msgUuid: turn.shape.msgUuid,
            actualModel: turn.shape.actualModel ?? null,
            actualTier: turn.shape.actualTier ?? null,
            verdict: turn.classification.verdict,
            suggestedTier: turn.classification.suggestedTier,
            reasons: turn.classification.reasons,
            hadThinking: turn.shape.hadThinking,
            thinkingTokensEstimate: turn.shape.thinkingTokensEstimate,
            textChars: turn.shape.textChars,
            toolUseCount: turn.shape.toolUseCount,
            hadErrorRecovery: turn.shape.hadErrorRecovery,
            inputTokens: turn.shape.inputTokens,
            outputTokens: turn.shape.outputTokens,
            cacheReadTokens: turn.shape.cacheReadTokens,
            cacheWriteTokens,
            actualCost: turn.shape.actualCost,
            counterfactualCost: turn.counterfactualCost,
            waste: turn.waste,
            mechanicalSuccess: turn.mechanicalSuccess,
            createdAt: now,
          };
          return { id: record.id, sessionKey: conv.key, ord, data: record };
        });
        await this.db.efficiencyTurns.bulkAdd(turnRows);

        const spanRows = args.summary.spans.spans.map((span, ord) => {
          const record: SpanEfficiencyRecord = {
            id: randomId(),
            projectId: args.projectId,
            sessionId: args.sessionId,
            ord,
            userMsgUuid: span.shape.userMsgUuid,
            userPromptPreview: span.shape.userPromptPreview,
            startMsgUuid: span.shape.startMsgUuid,
            endMsgUuid: span.shape.endMsgUuid,
            assistantTurnCount: span.shape.assistantTurnCount,
            verdict: span.classification.verdict,
            suggestedTier: span.classification.suggestedTier,
            reasons: span.classification.reasons,
            actualModel: span.shape.actualModel ?? null,
            actualTier: span.shape.actualTier ?? null,
            totalToolUseCount: span.shape.totalToolUseCount,
            totalTextChars: span.shape.totalTextChars,
            totalThinkingTokensEstimate: span.shape.totalThinkingTokensEstimate,
            anyHadThinking: span.shape.anyHadThinking,
            anyHadErrorRecovery: span.shape.anyHadErrorRecovery,
            allMechanicalSuccess: span.shape.allMechanicalSuccess,
            diffStats: span.shape.diffStats,
            inputTokens: span.shape.inputTokens,
            outputTokens: span.shape.outputTokens,
            cacheReadTokens: span.shape.cacheReadTokens,
            cacheWriteTokens:
              span.shape.cacheWrite5mTokens + span.shape.cacheWrite1hTokens,
            actualCost: span.shape.actualCost,
            counterfactualCost: span.counterfactualCost,
            waste: span.waste,
            createdAt: now,
          };
          return { id: record.id, sessionKey: conv.key, ord, data: record };
        });
        await this.db.efficiencySpans.bulkAdd(spanRows);
      },
    );

    return detection;
  }

  private findConversation(projectId: string, sessionId: string) {
    return this.findConversationRow(projectId, sessionId);
  }
}

// Mount management. The mount table holds one row per (harness, folder handle).
// Phase 3 wires this up to the user's "Connect folder" UX; for now expose the
// CRUD primitives.
export async function getMounts(): Promise<HarnessConnection[]> {
  const rows = await getDexie().mounts.toArray();
  return rows.map((r) => ({ harnessId: r.harnessId, label: r.label }));
}

export async function setMount(
  harnessId: string,
  handle: FileSystemDirectoryHandle,
  label: string,
): Promise<void> {
  if (!getHarness(harnessId)) throw new Error(`Unknown harness: ${harnessId}`);
  await getDexie().mounts.put({
    harnessId,
    handle,
    label,
    lastSyncedAt: null,
  });
}

export async function clearMount(harnessId: string): Promise<void> {
  await getDexie().mounts.delete(harnessId);
}

export async function syncAll(opts?: {
  onProgress?: (harnessId: string, p: SyncProgress) => void;
  signal?: AbortSignal;
}): Promise<Record<string, SyncProgress>> {
  const out: Record<string, SyncProgress> = {};
  const db = getDexie();
  const mounts = await db.mounts.toArray();
  for (const mount of mounts) {
    const harness = getHarness(mount.harnessId);
    if (!harness) continue;
    // Re-verify permission before walking the folder. Caller handles failure.
    if ("queryPermission" in mount.handle) {
      const perm = await mount.handle.queryPermission({ mode: "read" });
      if (perm !== "granted") {
        const req = await mount.handle.requestPermission({ mode: "read" });
        if (req !== "granted") {
          throw new ConversationStoreMissingError(mount.label);
        }
      }
    }
    const reader: FolderReader = browserFolderReader(mount.handle);
    out[mount.harnessId] = await syncMount({
      harness,
      reader,
      db,
      onProgress: opts?.onProgress
        ? (p) => opts.onProgress?.(mount.harnessId, p)
        : undefined,
      signal: opts?.signal,
    });
  }
  return out;
}

let cached: ConversationStore | null = null;

export function getBrowserConversationStore(): ConversationStore {
  if (cached) return cached;
  cached = new BrowserConversationStore(getDexie());
  return cached;
}

export type { SyncProgress, SyncOptions };
export { HARNESSES };
