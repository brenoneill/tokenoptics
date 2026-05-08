"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";

import type { ChunkColor } from "@/lib/labeling/colors";
import { formatUSD, pricingForModel } from "@/lib/pricing";
import type { Message, Usage } from "@/lib/types";

interface Props {
  messages: Message[];
  color?: ChunkColor;
}

type Family = "opus" | "sonnet" | "haiku";
const FAMILIES: ReadonlyArray<Family> = ["opus", "sonnet", "haiku"];

const COMPARISON_MODELS: ReadonlyArray<{
  id: string;
  label: string;
  family: Family;
}> = [
  { id: "claude-opus-4-7", label: "Opus", family: "opus" },
  { id: "claude-sonnet-4-6", label: "Sonnet", family: "sonnet" },
  { id: "claude-haiku-4-5", label: "Haiku", family: "haiku" },
];

function familyOf(model: string | undefined): Family | null {
  if (!model) return null;
  if (model.includes("opus")) return "opus";
  if (model.includes("sonnet")) return "sonnet";
  if (model.includes("haiku")) return "haiku";
  return null;
}

interface Aggregate {
  usage: Usage;
  primary: Family | null;
  primaryPct: number;
}

function aggregate(messages: Message[]): Aggregate {
  const usage: Usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
  };
  const counts: Record<Family, number> = { opus: 0, sonnet: 0, haiku: 0 };
  let familyTotal = 0;
  for (const m of messages) {
    if (!m.usage) continue;
    usage.inputTokens += m.usage.inputTokens;
    usage.outputTokens += m.usage.outputTokens;
    usage.cacheReadTokens += m.usage.cacheReadTokens;
    usage.cacheWrite5mTokens += m.usage.cacheWrite5mTokens;
    usage.cacheWrite1hTokens += m.usage.cacheWrite1hTokens;
    const f = familyOf(m.model);
    if (f) {
      counts[f] += 1;
      familyTotal += 1;
    }
  }
  let primary: Family | null = null;
  let primaryCount = 0;
  for (const f of FAMILIES) {
    if (counts[f] > primaryCount) {
      primary = f;
      primaryCount = counts[f];
    }
  }
  return {
    usage,
    primary,
    primaryPct: familyTotal > 0 && primary ? (primaryCount / familyTotal) * 100 : 0,
  };
}

function costFor(modelId: string, usage: Usage): number {
  const p = pricingForModel(modelId);
  return (
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheReadTokens * p.cacheRead +
      usage.cacheWrite5mTokens * p.cacheWrite +
      usage.cacheWrite1hTokens * p.cacheWrite1h) /
    1_000_000
  );
}

export function ModelComparisonBar({ messages, color }: Props) {
  const { usage, primary, primaryPct } = useMemo(
    () => aggregate(messages),
    [messages],
  );

  const costs = useMemo(
    () =>
      COMPARISON_MODELS.map((m) => ({ ...m, cost: costFor(m.id, usage) })),
    [usage],
  );

  const baseStyle: CSSProperties = color
    ? { backgroundColor: color.bg, borderColor: color.border }
    : {};

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {costs.map((m) => {
        const isPrimary = primary === m.family;
        const style: CSSProperties = { ...baseStyle };
        if (isPrimary && color) {
          style.borderColor = color.dot;
        }
        return (
          <div
            key={m.id}
            className={`flex items-baseline justify-between rounded-md border px-4 py-2 transition-colors ${
              color
                ? isPrimary
                  ? "border-2"
                  : ""
                : isPrimary
                  ? "border-accent bg-bg-subtle"
                  : "border-border bg-bg-subtle/60"
            }`}
            style={style}
          >
            <span className="text-xs uppercase tracking-wide text-fg-muted">
              {m.label}
              {isPrimary ? (
                <span className="ml-1 normal-case text-fg-subtle">
                  ({Math.round(primaryPct)}% used)
                </span>
              ) : null}
            </span>
            <span className="font-mono text-base text-fg">
              {formatUSD(m.cost)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
