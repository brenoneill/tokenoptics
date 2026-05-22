import { describe, expect, it } from "vitest";

import { computeCacheReport } from "@/lib/analyze/cache";
import {
  buildMarkdownExport,
  exportFilename,
  type ExportInput,
} from "@/lib/export/conversationExport";
import type { Chunk } from "@/lib/labeling/types";
import type { ContentBlock, Conversation, Message, Usage } from "@/lib/types";

// --- fixtures ---------------------------------------------------------------

const ZERO_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
};

function userMessage(uuid: string, second: number, blocks: ContentBlock[]): Message {
  return {
    uuid,
    parentUuid: null,
    role: "user",
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString(),
    blocks,
  };
}

function assistantMessage(
  uuid: string,
  second: number,
  blocks: ContentBlock[],
  cost: number,
): Message {
  return {
    uuid,
    parentUuid: null,
    role: "assistant",
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString(),
    model: "claude-opus-4-7",
    blocks,
    usage: { ...ZERO_USAGE, outputTokens: 800, cacheReadTokens: 40_000 },
    cost,
  };
}

// Two prompt spans: P1 adds a login form (an Edit), P2 fixes a build error
// (a Bash call that errors).
const MESSAGES: Message[] = [
  userMessage("u1", 0, [{ kind: "text", text: "Add a login form to the app" }]),
  assistantMessage(
    "a1",
    1,
    [
      { kind: "thinking", text: "" },
      { kind: "text", text: "ASSISTANT_PROSE_ONE: I will add the login form." },
      {
        kind: "tool_use",
        toolUseId: "t1",
        name: "Edit",
        input: {
          file_path: "src/Login.tsx",
          old_string: "old",
          new_string: "new line a\nnew line b",
        },
      },
    ],
    0.1,
  ),
  userMessage("u2", 2, [
    { kind: "tool_result", toolUseId: "t1", isError: false, charCount: 12 },
  ]),
  userMessage("u3", 3, [{ kind: "text", text: "Now fix the failing build" }]),
  assistantMessage(
    "a2",
    4,
    [
      { kind: "text", text: "ASSISTANT_PROSE_TWO: Running the build." },
      {
        kind: "tool_use",
        toolUseId: "t2",
        name: "Bash",
        input: { command: "npm run build" },
      },
    ],
    0.2,
  ),
  userMessage("u4", 5, [
    { kind: "tool_result", toolUseId: "t2", isError: true, charCount: 30 },
  ]),
];

const CONVERSATION: Conversation = {
  projectId: "-Users-me-myproject",
  sessionId: "8869b6e0-aaaa-bbbb-cccc-dddddddddddd",
  title: "Login form work",
  cwd: "/Users/me/myproject",
  gitBranch: "working",
  startedAt: MESSAGES[0].timestamp,
  endedAt: MESSAGES[MESSAGES.length - 1].timestamp,
  messageCount: MESSAGES.length,
  primaryModel: "claude-opus-4-7",
  totalCost: 0.3,
  totalInputTokens: 0,
  totalOutputTokens: 1600,
  totalCacheReadTokens: 80_000,
  totalCacheWriteTokens: 0,
  cacheHealth: "good",
  messages: MESSAGES,
};

const CHUNK: Chunk = {
  id: "c1",
  projectId: CONVERSATION.projectId,
  sessionId: CONVERSATION.sessionId,
  type: "create",
  title: "Build the login form",
  summary: "Adding the login UI.",
  memberMsgUuids: ["u1", "a1"],
  createdAt: CONVERSATION.startedAt,
  ord: 0,
  startMsgUuid: "u1",
  endMsgUuid: "a1",
  messageCount: 2,
  promptCount: 1,
  errorCount: 0,
  totalCost: 0.1,
};

function makeInput(overrides: Partial<ExportInput> = {}): ExportInput {
  return {
    conversation: CONVERSATION,
    chunks: [CHUNK],
    cacheReport: computeCacheReport(MESSAGES),
    routingRun: null,
    qualityRun: null,
    ...overrides,
  };
}

// --- markdown ---------------------------------------------------------------

describe("buildMarkdownExport", () => {
  it("emits the core document sections", () => {
    const md = buildMarkdownExport(makeInput(), { detail: "structural" });
    expect(md).toContain("# Claude Code Session Export — Login form work");
    expect(md).toContain("## Session overview");
    expect(md).toContain("## Drift signals");
    expect(md).toContain("## Transcript");
    expect(md).toContain("### P1 —");
    expect(md).toContain("### P2 —");
    expect(md).toContain("Add a login form to the app");
  });

  it("includes assistant prose only at full detail", () => {
    const structural = buildMarkdownExport(makeInput(), { detail: "structural" });
    const full = buildMarkdownExport(makeInput(), { detail: "full" });
    expect(structural).not.toContain("ASSISTANT_PROSE_ONE");
    expect(full).toContain("ASSISTANT_PROSE_ONE");
  });

  it("renders actions with file paths and tool errors", () => {
    const md = buildMarkdownExport(makeInput(), { detail: "structural" });
    expect(md).toContain("src/Login.tsx");
    expect(md).toContain("`Bash`");
    expect(md).toContain("command: npm run build");
    expect(md).toContain("tool errors");
  });

  it("includes the topic-segments section only when chunks exist", () => {
    const withChunks = buildMarkdownExport(makeInput(), { detail: "structural" });
    const withoutChunks = buildMarkdownExport(makeInput({ chunks: [] }), {
      detail: "structural",
    });
    expect(withChunks).toContain("## Topic segments");
    expect(withChunks).toContain("Build the login form");
    expect(withoutChunks).not.toContain("## Topic segments");
  });

  it("omits routing and quality sections when no run exists", () => {
    const md = buildMarkdownExport(makeInput(), { detail: "structural" });
    expect(md).not.toContain("## Routing analysis");
    expect(md).not.toContain("## Quality analysis");
  });
});

// --- code & diffs -----------------------------------------------------------

describe("export detail levels — code exposure", () => {
  it("markdown includes file diffs only at code detail", () => {
    const metrics = buildMarkdownExport(makeInput(), { detail: "structural" });
    const full = buildMarkdownExport(makeInput(), { detail: "full" });
    const code = buildMarkdownExport(makeInput(), { detail: "code" });
    // Metrics-only and assistant-output levels expose no source code.
    expect(metrics).not.toContain("_Diffs:_");
    expect(metrics).not.toContain("+new line a");
    expect(full).not.toContain("_Diffs:_");
    expect(full).not.toContain("+new line a");
    // But the line counts are still present at every level.
    expect(metrics).toContain("src/Login.tsx");
    // Code detail adds the actual diff.
    expect(code).toContain("_Diffs:_");
    expect(code).toContain("+new line a");
    expect(code).toContain("-old");
    expect(code).toContain("```diff");
  });
});

// --- filename ---------------------------------------------------------------

describe("exportFilename", () => {
  it("builds a slugged .md filename", () => {
    expect(exportFilename(CONVERSATION)).toBe(
      "tokenoptics-myproject-8869b6e0.md",
    );
  });
});
