"use client";

import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { useComparisonSelection } from "@/lib/comparisonCanvas/selectionStore";
import { useComparisonCanvasEnabled } from "@/lib/preferences/comparisonCanvas";
import type { ConversationSummary } from "@/lib/types";
import { ComparisonCanvasModal } from "./ComparisonCanvasModal";

interface Props {
  conversations: ConversationSummary[];
}

export function ComparisonCanvasChip({ conversations }: Props) {
  const enabled = useComparisonCanvasEnabled();
  const selection = useComparisonSelection();
  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  const count = selection.length;
  const interactable = count > 0;

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (interactable) setOpen(true);
          }}
          disabled={!interactable}
          aria-label={
            interactable
              ? `Open Comparison Canvas (${count} selected)`
              : "Select conversations to compare"
          }
          className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg transition-all ${
            interactable
              ? "border-violet bg-violet text-bg hover:opacity-90"
              : "cursor-not-allowed border-violet/40 bg-violet-subtle/60 text-violet backdrop-blur"
          }`}
        >
          <ArrowsRightLeftIcon className="h-4 w-4" aria-hidden />
          {interactable ? (
            <>
              <span className="font-mono text-xs">{count}</span>
              <span>in canvas</span>
            </>
          ) : (
            <span>Tap + to compare</span>
          )}
        </button>
      </div>

      <ComparisonCanvasModal
        open={open}
        onClose={() => setOpen(false)}
        selectedKeys={selection}
        conversations={conversations}
      />
    </>
  );
}
