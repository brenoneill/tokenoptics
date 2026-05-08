"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";

import type { ChunkColor } from "@/lib/labeling/colors";
import type { Chunk } from "@/lib/labeling/types";
import { formatUSD } from "@/lib/pricing";
import { ChunkActionsMenu } from "./ChunkActionsMenu";

export interface ChunkPillModel {
  chunk: Chunk;
  color: ChunkColor;
}

interface Props {
  pills: ChunkPillModel[];
  selectedId: string | null;
  onSelect: (chunkId: string) => void;
  onClear: () => void;
  onChunksChanged: () => void;
}

export function ChunkFilterBar({ pills, selectedId, onSelect, onClear, onChunksChanged }: Props) {
  if (pills.length === 0) return null;

  return (
    <div
      className="sticky z-10 -mx-4 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-bg/70"
      style={{ top: "var(--sticky-header-h, 0px)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {pills.map((pill) => (
          <ChunkPill
            key={pill.chunk.id}
            pill={pill}
            active={selectedId === pill.chunk.id}
            onSelect={() => onSelect(pill.chunk.id)}
            onChunksChanged={onChunksChanged}
          />
        ))}
        {selectedId !== null ? (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-bg-subtle px-3 py-1 text-xs text-fg-muted transition-colors hover:border-border-muted hover:text-fg"
          >
            <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
            Clear filter
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ChunkPill({
  pill,
  active,
  onSelect,
  onChunksChanged,
}: {
  pill: ChunkPillModel;
  active: boolean;
  onSelect: () => void;
  onChunksChanged: () => void;
}) {
  const { chunk, color } = pill;

  return (
    <div
      className="group inline-flex items-center gap-1 rounded-full border text-xs transition-colors"
      style={{
        borderColor: color.border,
        backgroundColor: active ? color.bg : "transparent",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="inline-flex items-center gap-2 rounded-full py-1 pl-3 pr-1.5 text-fg transition-colors hover:bg-bg-emphasis/40"
        title={chunk.title}
      >
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full transition-transform ${
            active ? "scale-125 ring-2 ring-bg" : ""
          }`}
          style={{ backgroundColor: color.dot }}
          aria-hidden
        />
        <span className={`max-w-[24ch] truncate ${active ? "font-medium" : ""}`}>
          {chunk.title}
        </span>
        <span className="font-mono text-[11px] text-fg">
          {formatUSD(chunk.totalCost)}
        </span>
        <span className="font-mono text-[10px] text-fg-subtle">
          {chunk.promptCount}
        </span>
      </button>
      <div className="pr-1">
        <ChunkActionsMenu chunk={chunk} onChange={onChunksChanged} />
      </div>
    </div>
  );
}
