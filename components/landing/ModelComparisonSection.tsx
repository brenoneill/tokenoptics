"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import {
  colorForChunkIndex,
  surfaceColorForChunkType,
  textClassForChunkType,
  type ChunkColor,
} from "@/lib/labeling/colors";
import type { ChunkType } from "@/lib/labeling/types";
import { formatUSD, pricingForModel } from "@/lib/pricing";
import type { Usage } from "@/lib/types";

const CHUNK_TYPE_LABEL: Record<ChunkType, string> = {
  create: "Create",
  refactor: "Refactor",
  bugfix: "Bugfix",
  debug: "Debug",
  explain: "Explain",
  chore: "Chore",
  error_loop: "Error Loop",
  other: "Other",
};

type Family = "opus" | "sonnet" | "haiku";

interface ModelOption {
  id: string;
  label: string;
  family: Family;
}

const COMPARISON_MODELS: ReadonlyArray<ModelOption> = [
  { id: "claude-opus-4-7", label: "Opus", family: "opus" },
  { id: "claude-sonnet-4-6", label: "Sonnet", family: "sonnet" },
  { id: "claude-haiku-4-5", label: "Haiku", family: "haiku" },
];

interface ScopeDemo {
  id: string;
  label: string;
  type: ChunkType;
  hint: string;
  usage: Usage;
  primary: { family: Family; pct: number };
  color?: ChunkColor;
}

const SCOPES: ReadonlyArray<ScopeDemo> = [
  {
    id: "refactor",
    label: "Refactor canvas state into Zustand store",
    type: "refactor",
    hint: "whole conversation · 96 messages · 2h 35m",
    usage: {
      inputTokens: 220_000,
      outputTokens: 680_000,
      cacheReadTokens: 38_500_000,
      cacheWrite5mTokens: 580_000,
      cacheWrite1hTokens: 0,
    },
    primary: { family: "opus", pct: 100 },
    color: colorForChunkIndex(0),
  },
  {
    id: "build",
    label: "Build side-by-side comparison panels",
    type: "create",
    hint: "chunk · 47 messages · mixed models",
    usage: {
      inputTokens: 95_000,
      outputTokens: 285_000,
      cacheReadTokens: 14_200_000,
      cacheWrite5mTokens: 240_000,
      cacheWrite1hTokens: 0,
    },
    primary: { family: "sonnet", pct: 81 },
    color: colorForChunkIndex(1),
  },
  {
    id: "error-loop",
    label: "Chase Transition flicker bug on Opus",
    type: "error_loop",
    hint: "chunk · 28 messages · 100% Opus",
    usage: {
      inputTokens: 45_000,
      outputTokens: 165_000,
      cacheReadTokens: 8_400_000,
      cacheWrite5mTokens: 95_000,
      cacheWrite1hTokens: 0,
    },
    primary: { family: "opus", pct: 100 },
    color: colorForChunkIndex(2),
  },
];

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

export function ModelComparisonSection() {
  const [activeId, setActiveId] = useState<string>(SCOPES[2].id);
  const active = SCOPES.find((s) => s.id === activeId) ?? SCOPES[0];

  const costs = useMemo(
    () =>
      COMPARISON_MODELS.map((m) => ({
        ...m,
        cost: costFor(m.id, active.usage),
      })),
    [active.usage],
  );

  const baseStyle: CSSProperties = active.color
    ? { backgroundColor: active.color.bg, borderColor: active.color.border }
    : {};

  return (
    <section className="space-y-8">
      <div className="max-w-2xl">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet">
          model comparison
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
          What if you'd run this on a different model?
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Tokenoptics re-prices any chunk or whole conversation against{" "}
          <span className="text-fg">Opus</span>,{" "}
          <span className="text-fg">Sonnet</span>, and{" "}
          <span className="text-fg">Haiku</span> — using the actual tokens you
          spent. The card you actually used is highlighted, with the share of
          the work it handled, so you can see where dropping a tier would have
          paid off and where it wouldn't.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-border-muted bg-bg-subtle/40 p-6">
        <div className="flex flex-wrap items-center gap-2">
          {SCOPES.map((s) => {
            const isActive = s.id === activeId;
            const surface = surfaceColorForChunkType(s.type);
            const dotColor =
              surface?.dot ?? s.color?.dot ?? "var(--color-fg-subtle)";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                aria-pressed={isActive}
                className="inline-flex items-center gap-2 rounded-full border py-1 pl-3 pr-3.5 text-xs text-fg transition-colors"
                style={{
                  borderColor:
                    surface?.border ?? s.color?.border ?? "var(--color-border)",
                  backgroundColor: surface
                    ? surface.bg
                    : isActive
                      ? (s.color?.bg ?? "var(--color-bg-emphasis)")
                      : "transparent",
                }}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    isActive ? "scale-125 ring-2 ring-bg" : ""
                  }`}
                  style={{ backgroundColor: dotColor }}
                  aria-hidden
                />
                <span className={isActive ? "font-medium" : ""}>{s.label}</span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${
                    textClassForChunkType(s.type) ?? "text-fg-subtle"
                  }`}
                >
                  {CHUNK_TYPE_LABEL[s.type]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {costs.map((m) => {
            const isPrimary = active.primary.family === m.family;
            const style: CSSProperties = { ...baseStyle };
            if (isPrimary && active.color) {
              style.borderColor = active.color.dot;
            }
            return (
              <div
                key={m.id}
                className={`flex items-baseline justify-between rounded-md border px-4 py-2 transition-colors ${
                  active.color
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
                      ({Math.round(active.primary.pct)}% used)
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
      </div>
    </section>
  );
}
