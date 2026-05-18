import Dexie, { type Table } from "dexie";

import type { Message } from "../../types";

// IndexedDB row shapes. We keep field names camelCase (matching the TS types)
// rather than mirroring SQLite snake_case, since this is a fresh schema.

export interface MountRow {
  harnessId: string; // primary
  handle: FileSystemDirectoryHandle;
  label: string;
  lastSyncedAt: string | null;
}

export interface ConversationRow {
  // Composite identity. We index sessions globally by [harnessId+projectId+sessionId]
  // since session IDs are not guaranteed unique across harnesses.
  key: string; // `${harnessId}::${projectId}::${sessionId}`
  harnessId: string;
  projectId: string;
  sessionId: string;
  title: string;
  cwd: string;
  gitBranch?: string;
  startedAt: string;
  endedAt: string;
  messageCount: number;
  primaryModel: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  // Cache coherency
  mtimeMs: number; // file mtime — drives "is this row stale?" checks
  contentHash: string; // sha256 of message identity tuple — drives efficiency invalidation
}

export interface MessageRow {
  // Composite primary key [sessionKey+seq] — sequential reads of one session
  // are a range scan, which Dexie/IndexedDB handle efficiently.
  sessionKey: string;
  seq: number;
  uuid: string;
  data: Message;
}

export interface ChunkRow {
  id: string; // primary
  sessionKey: string;
  type: string | null;
  title: string;
  summary: string;
  createdAt: string;
}

export interface ChunkMemberRow {
  // Composite primary key [chunkId+messageUuid]
  chunkId: string;
  messageUuid: string;
}

export interface EfficiencyDetectionRow {
  sessionKey: string; // primary
  contentHash: string;
  analyzedAt: string;
  data: unknown; // full EfficiencyDetectionRecord serialized as-is
}

export interface EfficiencyTurnRow {
  id: string;
  sessionKey: string;
  ord: number;
  data: unknown; // full EfficiencyTurnRecord
}

export interface EfficiencySpanRow {
  id: string;
  sessionKey: string;
  ord: number;
  data: unknown; // full SpanEfficiencyRecord
}

export interface PrefRow {
  key: string; // primary
  value: unknown;
  updatedAt: string;
}

export interface RoutingRunRow {
  // One row per session — re-running replaces the previous run.
  sessionKey: string; // primary
  runId: string;
  completedAt: string;
  data: unknown; // full RoutingRunRecord
}

export interface QualityRunRow {
  // Prompt-quality analysis — one row per session, re-running replaces.
  sessionKey: string; // primary
  runId: string;
  completedAt: string;
  data: unknown; // full QualityRunRecord
}

export class TokenopticsDB extends Dexie {
  mounts!: Table<MountRow, string>;
  conversations!: Table<ConversationRow, string>;
  messages!: Table<MessageRow, [string, number]>;
  chunks!: Table<ChunkRow, string>;
  chunkMembers!: Table<ChunkMemberRow, [string, string]>;
  efficiencyDetections!: Table<EfficiencyDetectionRow, string>;
  efficiencyTurns!: Table<EfficiencyTurnRow, string>;
  efficiencySpans!: Table<EfficiencySpanRow, string>;
  prefs!: Table<PrefRow, string>;
  routingRuns!: Table<RoutingRunRow, string>;
  qualityRuns!: Table<QualityRunRow, string>;

  constructor() {
    super("tokenoptics");
    this.version(1).stores({
      mounts: "harnessId",
      conversations: "key, endedAt, harnessId, [harnessId+projectId+sessionId]",
      messages: "[sessionKey+seq], sessionKey, uuid",
      chunks: "id, sessionKey",
      chunkMembers: "[chunkId+messageUuid], chunkId, messageUuid",
      efficiencyDetections: "sessionKey",
      efficiencyTurns: "id, [sessionKey+ord]",
      efficiencySpans: "id, [sessionKey+ord]",
    });
    this.version(2).stores({
      prefs: "key",
    });
    this.version(3).stores({
      routingRuns: "sessionKey",
    });
    this.version(4).stores({
      qualityRuns: "sessionKey",
    });
  }
}

let cached: TokenopticsDB | null = null;

export function getDexie(): TokenopticsDB {
  if (cached) return cached;
  cached = new TokenopticsDB();
  return cached;
}

export function sessionKey(harnessId: string, projectId: string, sessionId: string): string {
  return `${harnessId}::${projectId}::${sessionId}`;
}
