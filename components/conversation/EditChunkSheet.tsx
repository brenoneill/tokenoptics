"use client";

import { useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
import {
  useIncludeChunkSummary,
  useIncludeChunkType,
} from "@/lib/preferences/chunkDisplay";
import {
  CHUNK_TYPES,
  isChunkType,
  type Chunk,
  type ChunkType,
} from "@/lib/labeling/types";
import { getBrowserConversationStore } from "@/lib/storage/browser";

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

interface Props {
  chunk: Chunk;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditChunkSheet({ chunk, open, onClose, onSaved }: Props) {
  const includeType = useIncludeChunkType();
  const includeSummary = useIncludeChunkSummary();
  const [type, setType] = useState<ChunkType | null>(chunk.type);
  const [title, setTitle] = useState(chunk.title);
  const [summary, setSummary] = useState(chunk.summary);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setError(null);
    onClose();
  };

  const submit = async () => {
    setError(null);
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      setError("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await getBrowserConversationStore().updateChunk(chunk.id, {
        type: includeType ? type : chunk.type,
        title: trimmedTitle,
        summary: includeSummary ? summary.trim() : chunk.summary,
      });
      if (!ok) throw new Error("Chunk not found");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = title.trim().length > 0 && !submitting;

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Edit chunk"
      description={`${chunk.messageCount} ${chunk.messageCount === 1 ? "message" : "messages"} · members locked`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-bg-emphasis hover:text-fg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs text-fg-muted">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-fg"
          />
        </label>
        {includeType ? (
          <label className="block">
            <span className="mb-1 block text-xs text-fg-muted">Type (optional)</span>
            <select
              value={type ?? NONE_VALUE}
              onChange={(e) => {
                const v = e.target.value;
                setType(isChunkType(v) ? v : null);
              }}
              className="w-full rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-fg"
            >
              <option value={NONE_VALUE}>— None</option>
              {CHUNK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CHUNK_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {includeSummary ? (
          <label className="block">
            <span className="mb-1 block text-xs text-fg-muted">Summary (optional)</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-fg"
            />
          </label>
        ) : null}

        <p className="text-xs text-fg-subtle">
          To change which messages belong to this chunk, delete it and create a new one.
        </p>

        {error ? (
          <div className="rounded-md border border-danger/40 bg-danger-subtle/40 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
