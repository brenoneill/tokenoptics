"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

import { DiffBlock } from "@/components/conversation/DiffBlock";
import { MessageBlock } from "@/components/conversation/MessageBlock";
import { formatUSD } from "@/lib/pricing";
import type { FoldRenderItem } from "@/lib/transcript";

interface Props {
  items: FoldRenderItem[];
  toolResultCount: number;
  assistantOutputCount: number;
  assistantMessageCount: number;
  diffCount: number;
  addedLines: number;
  removedLines: number;
  rewrittenLines: number;
  totalCost: number;
}

export function CollapsedFold({
  items,
  toolResultCount,
  assistantOutputCount,
  assistantMessageCount,
  diffCount,
  addedLines,
  removedLines,
  rewrittenLines,
  totalCost,
}: Props) {
  const [open, setOpen] = useState(false);

  const segments: string[] = [];
  if (toolResultCount > 0) {
    segments.push(`${toolResultCount} tool result${toolResultCount === 1 ? "" : "s"}`);
  }
  if (assistantOutputCount > 0) {
    segments.push(
      `${assistantOutputCount} assistant output${assistantOutputCount === 1 ? "" : "s"}`,
    );
  }
  if (assistantMessageCount > 0) {
    segments.push(
      `${assistantMessageCount} assistant message${assistantMessageCount === 1 ? "" : "s"}`,
    );
  }
  if (diffCount > 0) {
    segments.push(`${diffCount} diff${diffCount === 1 ? "" : "s"}`);
  }
  if (segments.length === 0) {
    segments.push(`${items.length} message${items.length === 1 ? "" : "s"}`);
  }

  return (
    <div className="rounded-md border border-dashed border-border-muted bg-bg-subtle/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-fg-muted transition-colors hover:bg-bg-emphasis"
        aria-expanded={open}
      >
        <ChevronRightIcon
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <span className="font-mono">{segments.join(" · ")}</span>
        {diffCount > 0 ? (
          <span className="ml-2 flex shrink-0 items-center gap-2 font-mono">
            <span className="text-success">+{addedLines}</span>
            <span className="text-danger">-{removedLines}</span>
            <span
              className="text-fg-subtle"
              title={`${rewrittenLines} unchanged line${rewrittenLines === 1 ? "" : "s"} re-printed (still output-billed)`}
            >
              ~{rewrittenLines}
            </span>
          </span>
        ) : null}
        {totalCost > 0 ? (
          <span className="ml-auto font-mono text-fg-subtle">
            {formatUSD(totalCost)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border-muted p-3">
          {items.map((item, idx) => {
            if (item.type === "diff") {
              return (
                <DiffBlock
                  key={`${item.message.uuid}-${item.block.toolUseId}`}
                  toolName={item.block.name}
                  input={item.block.input}
                />
              );
            }
            return (
              <MessageBlock
                key={`${item.message.uuid}-${idx}`}
                message={item.message}
                hideText={item.hideText}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
