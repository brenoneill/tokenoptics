export const CHUNK_TYPES = [
  "create",
  "refactor",
  "bugfix",
  "debug",
  "explain",
  "chore",
  "error_loop",
  "other",
] as const;

export type ChunkType = (typeof CHUNK_TYPES)[number];

export function isChunkType(value: unknown): value is ChunkType {
  return typeof value === "string" && (CHUNK_TYPES as readonly string[]).includes(value);
}

export interface Chunk {
  id: string;
  projectId: string;
  sessionId: string;
  type: ChunkType | null;
  title: string;
  summary: string;
  memberMsgUuids: string[];
  createdAt: string;
  // Derived at read time when conversation messages are available.
  ord: number;
  startMsgUuid: string;
  endMsgUuid: string;
  messageCount: number;
  promptCount: number;
  errorCount: number;
  totalCost: number;
}
