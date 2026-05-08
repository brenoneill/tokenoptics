"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Fragment, useMemo } from "react";

import { ComparisonPanel } from "@/components/conversation/ComparisonPanel";
import { LogoMark } from "@/components/ui/LogoMark";
import {
  clearComparison,
  removeFromComparison,
  selectionKey,
} from "@/lib/comparisonCanvas/selectionStore";
import type { ConversationSummary } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedKeys: readonly string[];
  conversations: ConversationSummary[];
}

export function ComparisonCanvasModal({
  open,
  onClose,
  selectedKeys,
  conversations,
}: Props) {
  const conversationsByKey = useMemo(() => {
    const map = new Map<string, ConversationSummary>();
    for (const c of conversations) {
      map.set(selectionKey(c.projectId, c.sessionId), c);
    }
    return map;
  }, [conversations]);

  const items = useMemo(
    () =>
      selectedKeys
        .map((k) => conversationsByKey.get(k))
        .filter((c): c is ConversationSummary => Boolean(c)),
    [selectedKeys, conversationsByKey],
  );

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="transition-opacity duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/70" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="flex h-full max-h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-xl border border-violet/40 bg-bg shadow-2xl">
              <BrandingHeader onClose={onClose} count={items.length} />

              <div className="flex-1 overflow-auto bg-gradient-to-br from-bg via-bg to-bg-subtle/40 px-6 py-6">
                {items.length === 0 ? (
                  <EmptyCanvas />
                ) : (
                  <div className="flex h-full flex-row gap-4">
                    {items.map((c) => (
                      <ComparisonPanel
                        key={selectionKey(c.projectId, c.sessionId)}
                        conversation={c}
                        onRemove={() =>
                          removeFromComparison(
                            selectionKey(c.projectId, c.sessionId),
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              <BrandingFooter count={items.length} />
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function BrandingHeader({
  onClose,
  count,
}: {
  onClose: () => void;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-violet/30 bg-gradient-to-r from-violet-subtle/40 via-bg-subtle to-accent-subtle/40 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-violet/50 bg-bg text-violet shadow-sm">
          <LogoMark className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight text-fg">
              tokenoptics
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet">
              comparison canvas
            </span>
          </div>
          <div className="text-xs text-fg-muted">
            Side-by-side token + cost transparency for Claude Code sessions
            {count > 0 ? ` · ${count} selected` : ""}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="-m-1 rounded-md p-1 text-fg-subtle transition-colors hover:bg-bg-emphasis hover:text-fg"
      >
        <XMarkIcon className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

function BrandingFooter({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-violet/30 bg-bg-subtle/60 px-6 py-3">
      <div className="flex items-center gap-3 text-[11px] text-fg-subtle">
        <span className="font-mono uppercase tracking-[0.18em] text-violet">
          tokenoptics
        </span>
        <span className="text-fg-subtle/60">·</span>
        <span>Token-level visibility into every Claude Code session</span>
      </div>
      <div className="flex items-center gap-3">
        {count > 0 ? (
          <button
            type="button"
            onClick={clearComparison}
            className="rounded-md border border-border px-3 py-1 text-xs text-fg-muted transition-colors hover:border-danger/50 hover:bg-danger-subtle/40 hover:text-danger"
          >
            Clear all
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md rounded-lg border border-dashed border-border bg-bg-subtle/40 px-6 py-8 text-center">
        <div className="text-sm font-medium text-fg">No conversations selected</div>
        <div className="mt-1 text-xs text-fg-muted">
          Tap the + button on any conversation card to add it to the canvas.
        </div>
      </div>
    </div>
  );
}
