import { colorForChunkIndex, type ChunkColor } from "@/lib/labeling/colors";
import type { ChunkType } from "@/lib/labeling/types";
import type { ScopeStats } from "@/lib/efficiency/scopeStats";
import type { ConversationSummary } from "@/lib/types";

const PROJECT_TOKENOPTICS = "-Users-dev-code-tokenoptics-app";
const CWD_TOKENOPTICS = "/Users/dev/code/tokenoptics-app";

export const mockConversations: ConversationSummary[] = [
  {
    projectId: PROJECT_TOKENOPTICS,
    sessionId: "9f3ac1d2-7b40-4e8e-a1a2-001100110011",
    title: "Sketch comparison canvas card layout",
    cwd: CWD_TOKENOPTICS,
    gitBranch: "feature/comparison-canvas",
    startedAt: "2026-05-03T10:15:00.000Z",
    endedAt: "2026-05-03T10:42:00.000Z",
    messageCount: 18,
    primaryModel: "claude-haiku-4-5",
    totalCost: 2.34,
    totalInputTokens: 38_000,
    totalOutputTokens: 92_000,
    totalCacheReadTokens: 12_000,
    totalCacheWriteTokens: 24_000,
  },
  {
    projectId: PROJECT_TOKENOPTICS,
    sessionId: "2c81fe93-6a55-4c10-9d4f-002200220022",
    title: "Build side-by-side comparison panels",
    cwd: CWD_TOKENOPTICS,
    gitBranch: "feature/comparison-canvas",
    startedAt: "2026-05-04T14:32:00.000Z",
    endedAt: "2026-05-04T15:00:00.000Z",
    messageCount: 47,
    primaryModel: "claude-sonnet-4-6",
    totalCost: 24.18,
    totalInputTokens: 62_000,
    totalOutputTokens: 184_000,
    totalCacheReadTokens: 1_420_000,
    totalCacheWriteTokens: 71_000,
  },
  {
    projectId: PROJECT_TOKENOPTICS,
    sessionId: "5d72b48a-019e-4ff2-bb7b-003300330033",
    title: "Refactor canvas state into Zustand store",
    cwd: CWD_TOKENOPTICS,
    gitBranch: "feature/comparison-canvas",
    startedAt: "2026-05-04T16:10:00.000Z",
    endedAt: "2026-05-04T18:45:00.000Z",
    messageCount: 96,
    primaryModel: "claude-opus-4-7",
    totalCost: 97.42,
    totalInputTokens: 218_000,
    totalOutputTokens: 482_000,
    totalCacheReadTokens: 44_000,
    totalCacheWriteTokens: 198_000,
  },
  {
    projectId: PROJECT_TOKENOPTICS,
    sessionId: "7e8d4f01-2a3b-4c5d-9e8f-005500550055",
    title: "Draft landing page hero and sections",
    cwd: CWD_TOKENOPTICS,
    gitBranch: "feature/landing-page",
    startedAt: "2026-05-05T09:12:00.000Z",
    endedAt: "2026-05-05T10:34:00.000Z",
    messageCount: 41,
    primaryModel: "claude-sonnet-4-6",
    totalCost: 14.62,
    totalInputTokens: 48_000,
    totalOutputTokens: 138_000,
    totalCacheReadTokens: 920_000,
    totalCacheWriteTokens: 54_000,
  },
  {
    projectId: PROJECT_TOKENOPTICS,
    sessionId: "8f9e5a12-3b4c-5d6e-af90-006600660066",
    title: "Wire chip filter and level switcher in Landing page",
    cwd: CWD_TOKENOPTICS,
    gitBranch: "feature/landing-page",
    startedAt: "2026-05-05T11:08:00.000Z",
    endedAt: "2026-05-05T12:02:00.000Z",
    messageCount: 28,
    primaryModel: "claude-sonnet-4-6",
    totalCost: 9.84,
    totalInputTokens: 34_000,
    totalOutputTokens: 96_000,
    totalCacheReadTokens: 612_000,
    totalCacheWriteTokens: 38_000,
  },
  {
    projectId: PROJECT_TOKENOPTICS,
    sessionId: "11aa22bb-33cc-44dd-55ee-004400440044",
    title: "Update README and bump version label",
    cwd: CWD_TOKENOPTICS,
    gitBranch: "main",
    startedAt: "2026-05-01T09:08:00.000Z",
    endedAt: "2026-05-01T09:21:00.000Z",
    messageCount: 9,
    primaryModel: "claude-haiku-4-5",
    totalCost: 1.08,
    totalInputTokens: 18_000,
    totalOutputTokens: 38_000,
    totalCacheReadTokens: 6_000,
    totalCacheWriteTokens: 9_000,
  },
];

const FEATURED_INDEX = 1;

export const featuredConversation: ConversationSummary =
  mockConversations[FEATURED_INDEX];

export const mockFeaturedScopeStats: ScopeStats = {
  cost: featuredConversation.totalCost,
  inputTokens: featuredConversation.totalInputTokens,
  outputTokens: featuredConversation.totalOutputTokens,
  cacheReadTokens: featuredConversation.totalCacheReadTokens,
  cacheWriteTokens: featuredConversation.totalCacheWriteTokens,
  messageCount: featuredConversation.messageCount,
  promptCount: 9,
  linesAdded: 312,
  linesRemoved: 47,
  linesRewritten: 12,
  diffCount: 18,
  startedAt: featuredConversation.startedAt,
  endedAt: featuredConversation.endedAt,
  durationMs:
    Date.parse(featuredConversation.endedAt) -
    Date.parse(featuredConversation.startedAt),
};

export const branchDemoBranch = "feature/comparison-canvas";

export const branchDemoConversations: ConversationSummary[] =
  mockConversations.filter((c) => c.gitBranch === branchDemoBranch);

function projectShortLabel(projectId: string): string {
  const decoded = projectId.startsWith("-")
    ? projectId.slice(1).replace(/-/g, "/")
    : projectId;
  return decoded.split("/").filter(Boolean).pop() || projectId;
}

export const featuredProject = {
  projectId: PROJECT_TOKENOPTICS,
  label: projectShortLabel(PROJECT_TOKENOPTICS),
  conversations: mockConversations,
};

export interface ChunkDemoEntry {
  id: string;
  title: string;
  type: ChunkType;
  color: ChunkColor;
  stats: ScopeStats;
}

const FEATURED_STARTED_MS = Date.parse(featuredConversation.startedAt);
function chunkTime(offsetMin: number): string {
  return new Date(FEATURED_STARTED_MS + offsetMin * 60_000).toISOString();
}

export const mockChunkDemo: ChunkDemoEntry[] = [
  {
    id: "chunk-1",
    title: "Sketch Headless UI dialog skeleton",
    type: "create",
    color: colorForChunkIndex(0),
    stats: {
      cost: 3.62,
      inputTokens: 9_300,
      outputTokens: 27_600,
      cacheReadTokens: 213_000,
      cacheWriteTokens: 10_600,
      messageCount: 7,
      promptCount: 2,
      linesAdded: 52,
      linesRemoved: 2,
      linesRewritten: 0,
      diffCount: 3,
      startedAt: chunkTime(0),
      endedAt: chunkTime(4),
      durationMs: 4 * 60_000,
    },
  },
  {
    id: "chunk-2",
    title: "Build ComparisonPanel layout",
    type: "create",
    color: colorForChunkIndex(1),
    stats: {
      cost: 9.84,
      inputTokens: 25_200,
      outputTokens: 74_900,
      cacheReadTokens: 578_000,
      cacheWriteTokens: 28_900,
      messageCount: 18,
      promptCount: 3,
      linesAdded: 156,
      linesRemoved: 18,
      linesRewritten: 6,
      diffCount: 7,
      startedAt: chunkTime(4),
      endedAt: chunkTime(15),
      durationMs: 11 * 60_000,
    },
  },
  {
    id: "chunk-3",
    title: "Fix close button + layout overflow",
    type: "bugfix",
    color: colorForChunkIndex(2),
    stats: {
      cost: 4.21,
      inputTokens: 10_800,
      outputTokens: 32_000,
      cacheReadTokens: 247_000,
      cacheWriteTokens: 12_400,
      messageCount: 9,
      promptCount: 2,
      linesAdded: 34,
      linesRemoved: 12,
      linesRewritten: 4,
      diffCount: 4,
      startedAt: chunkTime(15),
      endedAt: chunkTime(20),
      durationMs: 5 * 60_000,
    },
  },
  {
    id: "chunk-4",
    title: "Loop debugging Transition flicker bug",
    type: "error_loop",
    color: colorForChunkIndex(3),
    stats: {
      cost: 4.88,
      inputTokens: 12_500,
      outputTokens: 37_100,
      cacheReadTokens: 287_000,
      cacheWriteTokens: 14_300,
      messageCount: 9,
      promptCount: 1,
      linesAdded: 28,
      linesRemoved: 12,
      linesRewritten: 0,
      diffCount: 3,
      startedAt: chunkTime(20),
      endedAt: chunkTime(25),
      durationMs: 5 * 60_000,
    },
  },
  {
    id: "chunk-5",
    title: "Polish typography and spacing",
    type: "refactor",
    color: colorForChunkIndex(4),
    stats: {
      cost: 1.63,
      inputTokens: 4_200,
      outputTokens: 12_400,
      cacheReadTokens: 95_000,
      cacheWriteTokens: 4_800,
      messageCount: 4,
      promptCount: 1,
      linesAdded: 42,
      linesRemoved: 3,
      linesRewritten: 2,
      diffCount: 1,
      startedAt: chunkTime(25),
      endedAt: chunkTime(28),
      durationMs: 3 * 60_000,
    },
  },
];
