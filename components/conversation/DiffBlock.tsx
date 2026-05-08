"use client";

import { useMemo, useState } from "react";
import { ChevronRightIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

import { diffsForTool, filePathFor, statsFromDiffs } from "@/lib/diff";

interface Props {
  toolName: string;
  input: unknown;
}

export function DiffBlock({ toolName, input }: Props) {
  const [open, setOpen] = useState(false);

  const { diffs, added, removed, context, filePath } = useMemo(() => {
    const all = diffsForTool(toolName, input);
    const stats = statsFromDiffs(all);
    return {
      diffs: all,
      added: stats.added,
      removed: stats.removed,
      context: stats.context,
      filePath: filePathFor(input),
    };
  }, [toolName, input]);

  return (
    <article
      className="rounded-md border border-border bg-bg-subtle/40"
      aria-label={`${toolName} diff for ${filePath}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-bg-emphasis"
        aria-expanded={open}
      >
        <ChevronRightIcon
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <PencilSquareIcon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        <span className="font-mono uppercase tracking-wider text-fg-muted">
          {toolName}
        </span>
        <span className="truncate font-mono text-fg" title={filePath}>
          {filePath}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2 font-mono">
          <span className="text-success">+{added}</span>
          <span className="text-danger">-{removed}</span>
          <span
            className="text-fg-subtle"
            title={`${context} unchanged line${context === 1 ? "" : "s"} re-printed in this edit (still output-billed)`}
          >
            ~{context}
          </span>
        </span>
      </button>

      {open ? (
        <div className="border-t border-border-muted">
          {diffs.map((diff, idx) => (
            <div key={idx} className={idx > 0 ? "border-t border-border-muted" : ""}>
              {diffs.length > 1 ? (
                <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                  edit {idx + 1}
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <pre className="font-mono text-xs leading-relaxed">
                  {diff.length === 0 ? (
                    <div className="px-3 py-2 text-fg-subtle">(no changes)</div>
                  ) : (
                    diff.map((d, i) => (
                      <div
                        key={i}
                        className={
                          d.kind === "add"
                            ? "bg-success-subtle text-success"
                            : d.kind === "remove"
                              ? "bg-danger-subtle text-danger"
                              : "text-fg-muted"
                        }
                      >
                        <span className="inline-block w-6 select-none px-2 text-fg-subtle">
                          {d.kind === "add" ? "+" : d.kind === "remove" ? "-" : " "}
                        </span>
                        {d.line || " "}
                      </div>
                    ))
                  )}
                </pre>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
