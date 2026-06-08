import { describe, expect, it } from "vitest";

import { computeCacheReport } from "./analyze/cache";
import { computeScopeStats } from "./efficiency/scopeStats";
import { normalizeJsonl } from "./normalize";
import { costForUsage } from "./pricing";

function assistantLine(opts: {
  uuid: string;
  messageId: string;
  input?: number;
  output?: number;
}): string {
  return JSON.stringify({
    type: "assistant",
    uuid: opts.uuid,
    parentUuid: "user-1",
    timestamp: "2026-06-08T12:00:00.000Z",
    message: {
      id: opts.messageId,
      model: "claude-sonnet-4-6",
      role: "assistant",
      content: [{ type: "text", text: `chunk ${opts.uuid}` }],
      usage: {
        input_tokens: opts.input ?? 1000,
        output_tokens: opts.output ?? 500,
        cache_read_input_tokens: 10_000,
        cache_creation: {
          ephemeral_5m_input_tokens: 200,
          ephemeral_1h_input_tokens: 0,
        },
      },
    },
  });
}

describe("normalizeJsonl — assistant usage dedup", () => {
  it("counts usage once per message.id across streaming lines", () => {
    const raw = [
      assistantLine({ uuid: "line-a", messageId: "msg_dup" }),
      assistantLine({ uuid: "line-b", messageId: "msg_dup" }),
      assistantLine({ uuid: "line-c", messageId: "msg_other" }),
    ].join("\n");

    const conv = normalizeJsonl(raw, { projectId: "p", sessionId: "s" });
    const withUsage = conv.messages.filter((m) => m.usage);

    expect(withUsage).toHaveLength(2);
    expect(conv.totalInputTokens).toBe(2000);
    expect(conv.totalOutputTokens).toBe(1000);
    expect(conv.totalCacheReadTokens).toBe(20_000);
    expect(conv.totalCacheWriteTokens).toBe(400);

    const expectedCost = withUsage.reduce(
      (sum, m) => sum + costForUsage(m.model, m.usage!),
      0,
    );
    expect(conv.totalCost).toBeCloseTo(expectedCost, 10);

    const scope = computeScopeStats(conv.messages);
    const cache = computeCacheReport(conv.messages);
    expect(scope.cost).toBeCloseTo(conv.totalCost, 10);
    expect(cache.totalCost).toBeCloseTo(conv.totalCost, 10);
    expect(scope.inputTokens).toBe(conv.totalInputTokens);
    expect(cache.inputTokens).toBe(conv.totalInputTokens);
  });

  it("does not double-count cache_creation_input_tokens when ephemeral buckets are present", () => {
    const raw = JSON.stringify({
      type: "assistant",
      uuid: "only",
      parentUuid: null,
      timestamp: "2026-06-08T12:00:00.000Z",
      message: {
        id: "msg_cache",
        model: "claude-sonnet-4-6",
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 5000,
          cache_creation: {
            ephemeral_5m_input_tokens: 3000,
            ephemeral_1h_input_tokens: 2000,
          },
        },
      },
    });

    const conv = normalizeJsonl(raw, { projectId: "p", sessionId: "s" });
    expect(conv.totalCacheWriteTokens).toBe(5000);
  });
});
