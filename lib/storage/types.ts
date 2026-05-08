import type {
  EfficiencyDetectionRecord,
  EfficiencyTurnRecord,
  SessionEfficiencyAggregate,
  SessionEfficiencySummary,
  SpanEfficiencyRecord,
} from "../efficiency/types";
import type { Chunk, ChunkType } from "../labeling/types";
import type { Conversation, ConversationSummary, Message } from "../types";

export interface InsertChunkArgs {
  projectId: string;
  sessionId: string;
  type: ChunkType | null;
  title: string;
  summary: string;
  memberMsgUuids: string[];
}

export interface UpdateChunkArgs {
  type: ChunkType | null;
  title: string;
  summary: string;
}

export interface ReplaceEfficiencyArgs {
  projectId: string;
  sessionId: string;
  contentHash: string;
  summary: SessionEfficiencySummary;
}

// Single async surface for everything the app needs: conversation discovery,
// chunk CRUD, and efficiency-analysis persistence. Server impl wraps the
// existing fs + SQLite code; the browser impl (Phase 2) backs onto Dexie.
export interface ConversationStore {
  listConversations(): Promise<ConversationSummary[]>;
  getConversation(projectId: string, sessionId: string): Promise<Conversation | null>;

  getChunks(projectId: string, sessionId: string, messages: Message[]): Promise<Chunk[]>;
  getSessionsWithChunks(): Promise<Set<string>>;
  insertChunk(args: InsertChunkArgs): Promise<string>;
  updateChunk(chunkId: string, args: UpdateChunkArgs): Promise<boolean>;
  deleteChunk(chunkId: string): Promise<void>;

  getEfficiencyDetection(
    projectId: string,
    sessionId: string,
  ): Promise<EfficiencyDetectionRecord | null>;
  getEfficiencySpans(projectId: string, sessionId: string): Promise<SpanEfficiencyRecord[]>;
  getEfficiencyTurns(projectId: string, sessionId: string): Promise<EfficiencyTurnRecord[]>;
  getAllEfficiencyAggregates(): Promise<Map<string, SessionEfficiencyAggregate>>;
  replaceEfficiencyAnalysis(args: ReplaceEfficiencyArgs): Promise<EfficiencyDetectionRecord>;
}

export class ConversationStoreMissingError extends Error {
  constructor(public readonly source: string) {
    super(`Conversation source not found: ${source}`);
    this.name = "ConversationStoreMissingError";
  }
}

// Per-harness folder mount. The server impl resolves to a real disk path; the
// browser impl (Phase 2) will resolve to a FileSystemDirectoryHandle.
export interface HarnessConnection {
  harnessId: string;
  label: string; // human-readable source description, e.g. "~/.claude/projects"
}
