"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

import { Badge } from "@/components/ui/Badge";
import { formatUSD } from "@/lib/pricing";
import type { QualityTaskRecord, WasteCategory } from "@/lib/analyze/quality";

interface Props {
  tasks: QualityTaskRecord[];
}

const CATEGORY_VARIANT: Record<
  WasteCategory,
  { variant: "neutral" | "warn" | "danger" | "accent"; text: string }
> = {
  none: { variant: "neutral", text: "clean" },
  info_gap: { variant: "warn", text: "info gap" },
  direction_change: { variant: "accent", text: "direction change" },
  mixed: { variant: "danger", text: "mixed" },
};

export function QualityTasksTable({ tasks }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-md border border-border bg-bg-subtle/60 px-4 py-6 text-center text-sm text-fg-muted">
        No tasks to analyze in this session.
      </div>
    );
  }

  // Sort by wasted cost descending so the worst offenders appear first.
  const sorted = [...tasks].sort((a, b) => b.wastedCost - a.wastedCost);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg-subtle/40">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border-muted bg-bg-emphasis/40 text-[10px] uppercase tracking-wider text-fg-subtle">
          <tr>
            <th className="w-8 px-3 py-2"></th>
            <th className="px-3 py-2">Lead prompt</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2 text-right">Follow-ups</th>
            <th className="px-3 py-2 text-right">Wasted tokens</th>
            <th className="px-3 py-2 text-right">Wasted cost</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task, i) => (
            <Row key={task.leadPromptUuid} task={task} index={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ task, index }: { task: QualityTaskRecord; index: number }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDownIcon : ChevronRightIcon;
  const category = CATEGORY_VARIANT[task.category];
  const hasWaste = task.category !== "none";

  return (
    <>
      <tr
        className={`border-b border-border-muted ${index % 2 === 0 ? "" : "bg-bg-subtle/30"} cursor-pointer hover:bg-bg-hover`}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-3 py-2 align-top">
          <Icon className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
        </td>
        <td className="max-w-[28rem] truncate px-3 py-2 align-top text-fg">
          {task.leadPromptPreview || <span className="text-fg-subtle">(empty)</span>}
        </td>
        <td className="px-3 py-2 align-top">
          <Badge variant={category.variant} mono>
            {category.text}
          </Badge>
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-fg-muted">
          {task.wastefulFollowUpCount}/{task.followUpCount}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-fg">
          {hasWaste ? task.wastedOutputTokens.toLocaleString() : "—"}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-fg">
          {hasWaste ? formatUSD(task.wastedCost) : "—"}
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-border-muted bg-bg-subtle/20">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  Full lead prompt
                </div>
                <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-md border border-border-muted bg-bg-emphasis/30 p-3 font-mono text-[11px] text-fg">
                  {task.leadPromptPreview}
                  {task.leadPromptCharCount > task.leadPromptPreview.length
                    ? "\n…"
                    : ""}
                </pre>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  Classifier reasoning
                </div>
                <p className="mt-1 text-xs italic text-fg-muted">
                  {task.reason || "(no waste detected)"}
                </p>
                {task.latentInfo.length > 0 ? (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
                      Info the user added late
                    </div>
                    <ul className="mt-1 space-y-1 text-xs text-fg">
                      {task.latentInfo.map((info, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-fg-subtle">·</span>
                          <span className="font-mono">{info}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                  <span className="text-fg-subtle">Follow-up replies</span>
                  <span className="text-right text-fg">{task.followUpCount}</span>
                  <span className="text-fg-subtle">Wasteful follow-ups</span>
                  <span className="text-right text-fg">
                    {task.wastefulFollowUpCount}
                  </span>
                  <span className="text-fg-subtle">Wasted output tokens</span>
                  <span className="text-right text-fg">
                    {task.wastedOutputTokens.toLocaleString()}
                  </span>
                  <span className="text-fg-subtle">Wasted cost</span>
                  <span className="text-right text-fg">
                    {formatUSD(task.wastedCost)}
                  </span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
