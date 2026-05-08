"use client";

import {
  ChevronUpIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

import { expandPromptsToMembers } from "@/lib/labeling/metrics";
import {
  useIncludeChunkSummary,
  useIncludeChunkType,
} from "@/lib/preferences/chunkDisplay";
import { CHUNK_TYPES, isChunkType, type ChunkType } from "@/lib/labeling/types";
import { getBrowserConversationStore } from "@/lib/storage/browser";
import { userPromptText } from "@/lib/transcript";
import type { Message } from "@/lib/types";
import { useSelection } from "./SelectionContext";

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

const NONE_VALUE = "__none__";
const TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: NONE_VALUE, label: "— None" },
  ...CHUNK_TYPES.map((t) => ({ value: t, label: CHUNK_TYPE_LABEL[t] })),
];

interface Props {
  projectId: string;
  sessionId: string;
  messages: Message[];
  onSaved: () => void;
}

function previewText(message: Message): string {
  const text = userPromptText(message) ?? "";
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

export function FloatingLabeler({ projectId, sessionId, messages, onSaved }: Props) {
  const selection = useSelection();
  const includeType = useIncludeChunkType();
  const includeSummary = useIncludeChunkSummary();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ChunkType | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderedSelectedMessages = useMemo(() => {
    if (!selection) return [];
    return messages.filter((m) => selection.selected.has(m.uuid));
  }, [messages, selection]);

  const count = selection?.selected.size ?? 0;

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!selection) return null;

  const reset = () => {
    setTitle("");
    setSummary("");
    setError(null);
  };

  const submit = async () => {
    if (selection.selected.size === 0) {
      setError("Tick at least one prompt.");
      return;
    }
    setError(null);
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    try {
      const promptUuids = Array.from(selection.selected);
      const memberMsgUuids = expandPromptsToMembers(promptUuids, messages);
      if (memberMsgUuids.length === 0) {
        throw new Error("Selected prompts not found in conversation.");
      }
      await getBrowserConversationStore().insertChunk({
        projectId,
        sessionId,
        type: includeType ? type : null,
        title: trimmedTitle,
        summary: includeSummary ? summary.trim() : "",
        memberMsgUuids,
      });
      selection.clear();
      reset();
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = count > 0 && !submitting && title.trim().length > 0;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="pointer-events-auto flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-violet/40 bg-bg shadow-2xl"
          role="dialog"
          aria-label="Configure label"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="text-sm font-semibold text-fg">Create chunk</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-m-1 rounded-md p-1 text-fg-subtle transition-colors hover:bg-bg-emphasis hover:text-fg"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-3">
            {/* Selected prompts */}
            {count === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-fg-subtle">
                Tick a checkbox on a user prompt. Trailing system actions ride along.
              </p>
            ) : (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
                    Selected
                  </span>
                  <button
                    type="button"
                    onClick={selection.clear}
                    className="text-[11px] text-fg-subtle transition-colors hover:text-danger"
                  >
                    clear all
                  </button>
                </div>
                <ol className="max-h-32 space-y-1 overflow-y-auto">
                  {orderedSelectedMessages.map((m, idx) => (
                    <li
                      key={m.uuid}
                      className="flex items-start gap-2 rounded-md border border-border bg-bg-subtle/40 px-2 py-1.5 text-xs"
                    >
                      <span className="mt-0.5 font-mono text-[10px] text-fg-subtle">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-fg">
                        {previewText(m)}
                      </span>
                      <button
                        type="button"
                        onClick={() => selection.toggle(m.uuid)}
                        className="text-[10px] text-fg-subtle transition-colors hover:text-danger"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="space-y-3">
              <Field label="Title">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="CREATE CHUNK TITLE"
                  autoFocus
                  className="w-full rounded-md border border-border bg-bg px-2 py-1 text-sm text-fg"
                />
              </Field>
              {includeType ? (
                <Field label="Type (optional)">
                  <select
                    value={type ?? NONE_VALUE}
                    onChange={(e) => {
                      const v = e.target.value;
                      setType(isChunkType(v) ? v : null);
                    }}
                    className="w-full rounded-md border border-border bg-bg px-2 py-1 text-sm text-fg"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {includeSummary ? (
                <Field label="Summary (optional)">
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-border bg-bg px-2 py-1 text-sm text-fg"
                  />
                </Field>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-md border border-danger/40 bg-danger-subtle/40 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-bg-subtle/40 px-4 py-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-md bg-violet px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save Chunk"}
            </button>
          </div>
        </form>
      ) : null}

      {/* Persistent chip */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg transition-all ${
          count > 0
            ? "border-violet bg-violet text-bg hover:opacity-90"
            : "border-violet/40 bg-violet-subtle/60 text-violet backdrop-blur hover:bg-violet-subtle"
        }`}
        aria-expanded={open}
        aria-label={
          count > 0 ? `${count} prompts added — configure` : "Tick a prompt to label"
        }
      >
        {count > 0 ? (
          <>
            <span className="font-mono text-xs">{count}</span>
            <span>added</span>
            <ChevronUpIcon
              className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </>
        ) : (
          <>
            <PlusIcon className="h-4 w-4" aria-hidden />
            <span>Tick a prompt to label</span>
          </>
        )}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-fg-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}
