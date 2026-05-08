"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

import { Markdown } from "./Markdown";

const EXPAND_THRESHOLD = 500;

interface Props {
  text: string;
}

function previewLine(text: string): string {
  for (const line of text.split("\n")) {
    const trimmed = line.replace(/^#+\s*/, "").trim();
    if (trimmed) return trimmed;
  }
  return text.slice(0, 80);
}

export function TriggerBody({ text }: Props) {
  const long = text.length > EXPAND_THRESHOLD;
  const [open, setOpen] = useState(false);

  if (!long) {
    return <Markdown text={text} className="text-fg-muted" />;
  }

  const preview = previewLine(text);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-xs text-fg-muted transition-colors hover:text-fg"
        aria-expanded={open}
      >
        <ChevronRightIcon
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <span className="truncate font-medium" title={preview}>
          {preview}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[11px] text-fg-subtle">
          {text.length.toLocaleString()} chars
        </span>
      </button>
      {open ? (
        <div className="mt-2">
          <Markdown text={text} className="text-fg-muted" />
        </div>
      ) : null}
    </div>
  );
}
