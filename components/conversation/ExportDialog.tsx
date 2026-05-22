"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Fragment, useState } from "react";

import type { CacheSessionReport } from "@/lib/analyze/cache";
import type { QualityRunRecord } from "@/lib/analyze/quality";
import type { RoutingRunRecord } from "@/lib/analyze/types";
import {
  buildMarkdownExport,
  exportFilename,
  type ExportInput,
} from "@/lib/export/conversationExport";
import { downloadFile } from "@/lib/export/download";
import type { Chunk } from "@/lib/labeling/types";
import type { Conversation } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  chunks: Chunk[];
  cacheReport: CacheSessionReport;
  routingRun: RoutingRunRecord | null;
  qualityRun: QualityRunRecord | null;
}

// A self-contained Markdown download of the conversation (transcript +
// computed analysis), built entirely client-side so no transcript content
// touches the network (AGENTS.md rule 2). The user picks a detail level here,
// then the file is handed straight to the browser.
export function ExportDialog({
  open,
  onClose,
  conversation,
  chunks,
  cacheReport,
  routingRun,
  qualityRun,
}: Props) {
  const [detail, setDetail] = useState<"structural" | "full" | "code">(
    "structural",
  );

  const handleExport = () => {
    const input: ExportInput = {
      conversation,
      chunks,
      cacheReport,
      routingRun,
      qualityRun,
    };
    downloadFile(
      exportFilename(conversation),
      buildMarkdownExport(input, { detail }),
      "text/markdown;charset=utf-8",
    );
    onClose();
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="transition-opacity duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-md rounded-lg border border-border bg-bg shadow-xl">
              <div className="px-5 py-4">
                <DialogTitle className="text-base font-semibold text-fg">
                  Export conversation
                </DialogTitle>
                <p className="mt-1 text-sm text-fg-muted">
                  Download this session as a Markdown document you can hand to
                  an AI to analyse for context drift. Everything is generated
                  locally — nothing is sent anywhere.
                </p>

                <div className="mt-4">
                  <fieldset>
                    <legend className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
                      Detail
                    </legend>
                    <div className="mt-2 space-y-1">
                      <RadioRow
                        checked={detail === "structural"}
                        onChange={() => setDetail("structural")}
                        label="Metrics only (recommended)"
                        hint="Lines changed, costs and tokens — no source code. Best for bloat & drift analysis."
                      />
                      <RadioRow
                        checked={detail === "full"}
                        onChange={() => setDetail("full")}
                        label="With assistant output"
                        hint="Also includes the assistant's written explanations."
                      />
                      <RadioRow
                        checked={detail === "code"}
                        onChange={() => setDetail("code")}
                        label="With code & diffs"
                        hint="Also includes line-by-line file diffs. Best for debugging or root-causing a bug."
                      />
                    </div>
                  </fieldset>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border bg-bg-subtle/40 px-5 py-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-bg-emphasis hover:text-fg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
                >
                  Download
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function RadioRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-bg-emphasis">
      <input
        type="radio"
        name="export-detail"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 accent-violet"
      />
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        <span className="block text-xs text-fg-muted">{hint}</span>
      </span>
    </label>
  );
}
