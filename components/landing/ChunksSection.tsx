"use client";

import { useState } from "react";

import { StatBar } from "@/components/conversation/StatBar";
import {
  surfaceColorForChunkType,
  textClassForChunkType,
} from "@/lib/labeling/colors";
import { formatUSD } from "@/lib/pricing";
import {
  featuredConversation,
  mockChunkDemo,
  type ChunkDemoEntry,
} from "@/lib/mock/landingFixtures";

const DEFAULT_CHUNK_INDEX = 3;

export function ChunksSection() {
  const [activeId, setActiveId] = useState<string>(
    mockChunkDemo[DEFAULT_CHUNK_INDEX].id,
  );
  const active =
    mockChunkDemo.find((c) => c.id === activeId) ??
    mockChunkDemo[DEFAULT_CHUNK_INDEX];

  return (
    <section className="space-y-8">
      <div className="max-w-2xl">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet">
          chunk level
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
          Zoom in: what did each piece of work cost?
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Slice any conversation into labeled chunks — a sketch, a build, a
          bugfix, a polish pass. Each chunk gets its own cost, tokens, and
          prompt count, so you can answer{" "}
          <span className="text-fg">
            &ldquo;was this debug session worth it?&rdquo;
          </span>{" "}
          or{" "}
          <span className="text-fg">
            &ldquo;where did all the cache misses happen?&rdquo;
          </span>
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-border-muted bg-bg-subtle/40 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-muted pb-4">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
              Conversation
            </div>
            <div className="truncate text-sm font-medium text-fg">
              {featuredConversation.title}
            </div>
          </div>
          <div className="font-mono text-sm text-fg-subtle">
            <span className="text-fg-muted">total</span>{" "}
            <span className="text-fg">
              {formatUSD(featuredConversation.totalCost)}
            </span>
            {" · "}
            <span className="text-fg-muted">{mockChunkDemo.length} chunks</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mockChunkDemo.map((c) => (
            <ChunkPill
              key={c.id}
              chunk={c}
              active={c.id === activeId}
              onSelect={() => setActiveId(c.id)}
            />
          ))}
        </div>

        <StatBar
          scopeLabel={active.title}
          stats={active.stats}
          color={active.color}
        />
      </div>
    </section>
  );
}

function ChunkPill({
  chunk,
  active,
  onSelect,
}: {
  chunk: ChunkDemoEntry;
  active: boolean;
  onSelect: () => void;
}) {
  const surface = surfaceColorForChunkType(chunk.type);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="group inline-flex items-center gap-2 rounded-full border py-1 pl-3 pr-3.5 text-xs text-fg transition-colors"
      style={{
        borderColor: surface?.border ?? chunk.color.border,
        backgroundColor: surface
          ? surface.bg
          : active
            ? chunk.color.bg
            : "transparent",
      }}
    >
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full transition-transform ${
          active ? "scale-125 ring-2 ring-bg" : ""
        }`}
        style={{ backgroundColor: surface?.dot ?? chunk.color.dot }}
        aria-hidden
      />
      <span className={`max-w-[28ch] truncate ${active ? "font-medium" : ""}`}>
        {chunk.title}
      </span>
      <span
        className={`font-mono text-[10px] uppercase tracking-wider ${
          textClassForChunkType(chunk.type) ?? "text-fg-subtle"
        }`}
      >
        {chunk.type}
      </span>
      <span className="font-mono text-[11px] text-fg">
        {formatUSD(chunk.stats.cost)}
      </span>
    </button>
  );
}
