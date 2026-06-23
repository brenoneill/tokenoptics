import { describe, expect, it } from "vitest";

import { normalizeKiroCli, parseKiroSessionJson } from "@/lib/normalizeKiroCli";

// Fixtures mirror the real Kiro CLI on-disk shapes (verified against
// ~/.kiro/sessions/cli) but use synthetic content. The .jsonl is the message
// stream; the .json carries per-turn usage + the model rate multiplier.

// Two turns. Turn 1: a simple prompt → assistant reply. Turn 2: prompt →
// assistant tool call → tool result → assistant final reply.
const JSONL = [
  JSON.stringify({
    version: "v1",
    kind: "Prompt",
    data: {
      message_id: "u1",
      content: [{ kind: "text", data: "ping" }],
      meta: { timestamp: 1778204060 },
    },
  }),
  JSON.stringify({
    version: "v1",
    kind: "AssistantMessage",
    data: { message_id: "a1", content: [{ kind: "text", data: "Pong." }] },
  }),
  JSON.stringify({
    version: "v1",
    kind: "Prompt",
    data: {
      message_id: "u2",
      content: [{ kind: "text", data: "list my notes" }],
      meta: { timestamp: 1778204200 },
    },
  }),
  JSON.stringify({
    version: "v1",
    kind: "AssistantMessage",
    data: {
      message_id: "a2",
      content: [
        { kind: "text", data: "Let me check." },
        {
          kind: "toolUse",
          data: { toolUseId: "t1", name: "get_vault_stats", input: { q: 1 } },
        },
      ],
    },
  }),
  JSON.stringify({
    version: "v1",
    kind: "ToolResults",
    data: {
      message_id: "r1",
      content: [
        {
          kind: "toolResult",
          data: {
            toolUseId: "t1",
            content: [{ kind: "text", data: '{"notes":227}' }],
          },
        },
      ],
    },
  }),
  JSON.stringify({
    version: "v1",
    kind: "AssistantMessage",
    data: { message_id: "a3", content: [{ kind: "text", data: "You have 227 notes." }] },
  }),
].join("\n");

const SESSION_JSON = JSON.stringify({
  session_id: "sess-1",
  cwd: "/Users/me/code/project",
  created_at: "2026-04-28T06:22:13.244650Z",
  updated_at: "2026-04-28T06:30:00.000000Z",
  title: "ping test",
  session_state: {
    rts_model_state: {
      model_info: {
        model_id: "claude-opus-4.8",
        model_name: "claude-opus-4.8",
        rate_multiplier: 2.2,
        rate_unit: "Credit",
        context_window_tokens: 1_000_000,
      },
    },
    conversation_metadata: {
      user_turn_metadatas: [
        {
          message_ids: ["u1", "a1"],
          input_token_count: 0,
          output_token_count: 0,
          metering_usage: [{ value: 1.5, unit: "credit" }],
          end_timestamp: 1778204065,
        },
        {
          message_ids: ["u2", "a2", "r1", "a3"],
          input_token_count: 0,
          output_token_count: 0,
          // two line items in one turn — both must be summed
          metering_usage: [
            { value: 2.0, unit: "credit" },
            { value: 0.5, unit: "credit" },
          ],
          end_timestamp: 1778204260,
        },
      ],
    },
  },
});

function build() {
  return normalizeKiroCli({
    jsonl: JSONL,
    sessionJson: parseKiroSessionJson(SESSION_JSON),
    projectId: "/Users/me/code/project",
    sessionId: "sess-1",
  });
}

describe("normalizeKiroCli", () => {
  it("renders the full message stream from the .jsonl", () => {
    const c = build();
    expect(c.messageCount).toBe(6);
    expect(c.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user", // ToolResults render as a user-role turn
      "assistant",
    ]);
  });

  it("extracts text, tool_use, and tool_result blocks", () => {
    const c = build();
    const toolUse = c.messages[3].blocks.find((b) => b.kind === "tool_use");
    expect(toolUse).toMatchObject({ kind: "tool_use", name: "get_vault_stats" });
    const toolResult = c.messages[4].blocks.find((b) => b.kind === "tool_result");
    expect(toolResult).toMatchObject({ kind: "tool_result", toolUseId: "t1" });
    // tool result block gets its tool name attached from the matching tool_use
    expect((toolResult as { toolName?: string }).toolName).toBe("get_vault_stats");
  });

  it("attaches per-turn credits to the turn's anchor (last) message", () => {
    const c = build();
    // turn 1 anchor = a1
    expect(c.messages[1].usage?.credits).toBe(1.5);
    // turn 2 anchor = a3, credits summed across both line items
    expect(c.messages[5].usage?.credits).toBe(2.5);
  });

  it("prices credits at the overage rate and totals them", () => {
    const c = build();
    expect(c.totalCredits).toBe(4.0); // 1.5 + 2.5
    expect(c.totalCost).toBeCloseTo(4.0 * 0.04, 10); // $0.16
    expect(c.messages[1].cost).toBeCloseTo(1.5 * 0.04, 10);
  });

  it("carries cwd, title, model, and timestamps from the .json/.jsonl", () => {
    const c = build();
    expect(c.cwd).toBe("/Users/me/code/project");
    expect(c.title).toBe("ping test");
    expect(c.primaryModel).toBe("claude-opus-4.8");
    expect(c.startedAt).toBe(new Date(1778204060 * 1000).toISOString());
    expect(c.totalCacheReadTokens).toBe(0);
  });

  it("falls back to a derived title when the .json is absent", () => {
    const c = normalizeKiroCli({
      jsonl: JSONL,
      sessionJson: null,
      projectId: "p",
      sessionId: "s",
    });
    expect(c.title).toBe("ping");
    expect(c.totalCredits).toBeUndefined();
    expect(c.totalCost).toBe(0); // no usage without the .json
    expect(c.messageCount).toBe(6); // stream still renders
  });

  it("skips Compaction entries but keeps surrounding messages", () => {
    const withCompaction = [
      JSONL,
      JSON.stringify({
        version: "v1",
        kind: "Compaction",
        data: { summary: "…", strategy: {}, messages_snapshot: [] },
      }),
    ].join("\n");
    const c = normalizeKiroCli({
      jsonl: withCompaction,
      sessionJson: parseKiroSessionJson(SESSION_JSON),
      projectId: "p",
      sessionId: "s",
    });
    expect(c.messageCount).toBe(6);
  });
});
