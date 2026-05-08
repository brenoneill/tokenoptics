"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  MagnifyingGlassIcon,
  FolderOpenIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import { ComparisonCanvasChip } from "@/components/conversation/ComparisonCanvasChip";
import { ConversationCard } from "@/components/conversation/ConversationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { projectLabel } from "@/lib/conversation";
import { formatTokens, formatUSD } from "@/lib/pricing";
import type { ConversationSummary } from "@/lib/types";

const ALL_PROJECTS = "__all__";
const ALL_BRANCHES = "__all__";
const NO_BRANCH = "__none__";

export interface ConversationEntry {
  conversation: ConversationSummary;
  hasChunks: boolean;
}

interface Props {
  entries: ConversationEntry[];
  header?: ReactNode;
}

function branchKey(c: ConversationSummary): string {
  const b = c.gitBranch?.trim();
  return b && b.length > 0 ? b : NO_BRANCH;
}

export function ConversationsBrowser({ entries, header }: Props) {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState<string>(ALL_PROJECTS);
  const [branch, setBranch] = useState<string>(ALL_BRANCHES);
  const [labelledOnly, setLabelledOnly] = useState(false);

  const projectOptions = useMemo<SelectOption[]>(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const label = projectLabel(e.conversation);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [
      { value: ALL_PROJECTS, label: "All projects", count: entries.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([label, count]) => ({ value: label, label, count })),
    ];
  }, [entries]);

  const branchOptions = useMemo<SelectOption[]>(() => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const e of entries) {
      const c = e.conversation;
      if (project !== ALL_PROJECTS && projectLabel(c) !== project) continue;
      const key = branchKey(c);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total++;
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => {
      if (a[0] === NO_BRANCH) return 1;
      if (b[0] === NO_BRANCH) return -1;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    });
    return [
      { value: ALL_BRANCHES, label: "All branches", count: total },
      ...sorted.map(([key, count]) => ({
        value: key,
        label: key === NO_BRANCH ? "(no branch)" : key,
        count,
      })),
    ];
  }, [entries, project]);

  useEffect(() => {
    if (branch === ALL_BRANCHES) return;
    if (!branchOptions.some((b) => b.value === branch)) {
      setBranch(ALL_BRANCHES);
    }
  }, [branch, branchOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const c = e.conversation;
      if (project !== ALL_PROJECTS && projectLabel(c) !== project) return false;
      if (branch !== ALL_BRANCHES && branchKey(c) !== branch) return false;
      if (labelledOnly && !e.hasChunks) return false;
      if (!q) return true;
      return [
        c.title,
        c.cwd,
        c.gitBranch ?? "",
        c.primaryModel,
        c.sessionId,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [entries, query, project, branch, labelledOnly]);

  const totals = useMemo(() => {
    let cost = 0;
    let output = 0;
    let input = 0;
    for (const e of filtered) {
      cost += e.conversation.totalCost;
      output += e.conversation.totalOutputTokens;
      input += e.conversation.totalInputTokens;
    }
    return { cost, output, input };
  }, [filtered]);

  const isFiltered =
    query.trim().length > 0 ||
    project !== ALL_PROJECTS ||
    branch !== ALL_BRANCHES ||
    labelledOnly;

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-20 bg-bg pt-4 pb-4">
        {header}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="max-w-md flex-1">
            <Input
              icon={MagnifyingGlassIcon}
              placeholder="Search conversations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search conversations"
            />
          </div>
          <Select
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setBranch(ALL_BRANCHES);
            }}
            aria-label="Filter by project"
            options={projectOptions}
          />
          <Select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            aria-label="Filter by branch"
            disabled={branchOptions.length <= 1}
            options={branchOptions}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLabelledOnly((v) => !v)}
            aria-pressed={labelledOnly}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              labelledOnly
                ? "border-violet/30 bg-violet-subtle text-violet"
                : "border-border bg-bg-emphasis text-fg-muted hover:bg-bg-subtle"
            }`}
          >
            <SparklesIcon className="h-3.5 w-3.5" aria-hidden />
            Labeled
          </button>
        </div>
      </div>

      <ComparisonCanvasChip
        conversations={entries.map((e) => e.conversation)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title={isFiltered ? "No matches" : "No conversations yet"}
          description={
            isFiltered
              ? "Try a different search term, project, or branch."
              : "Once you use Claude Code, conversations will appear here."
          }
        />
      ) : (
        <>
          <VirtualizedCardGrid entries={filtered} />
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border border-accent/30 bg-bg-subtle/60 px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-fg-muted">
              {filtered.length} of {entries.length}{" "}
              {entries.length === 1 ? "conversation" : "conversations"}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <TotalStat label="Cost" value={formatUSD(totals.cost)} accent />
              <TotalStat label="Output" value={formatTokens(totals.output)} />
              <TotalStat label="Input" value={formatTokens(totals.input)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function useColumnsPerRow(): number {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      // Tailwind: md = 768, xl = 1280 (matches the previous grid-cols-1/2/3 breakpoints).
      if (w >= 1280) setCols(3);
      else if (w >= 768) setCols(2);
      else setCols(1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return cols;
}

function VirtualizedCardGrid({ entries }: { entries: ConversationEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cols = useColumnsPerRow();
  const rowCount = Math.ceil(entries.length / cols);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 240, // approximate card height + gap
    overscan: 4,
    scrollMargin: containerRef.current?.offsetTop ?? 0,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={containerRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {items.map((row) => {
        const startIdx = row.index * cols;
        const rowEntries = entries.slice(startIdx, startIdx + cols);
        return (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 grid w-full grid-cols-1 gap-4 pb-4 md:grid-cols-2 xl:grid-cols-3"
            style={{
              transform: `translateY(${row.start - (containerRef.current?.offsetTop ?? 0)}px)`,
            }}
          >
            {rowEntries.map((e) => (
              <ConversationCard
                key={`${e.conversation.projectId}-${e.conversation.sessionId}`}
                conversation={e.conversation}
                hasChunks={e.hasChunks}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TotalStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const color = accent ? "text-accent" : "text-fg";
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs uppercase tracking-wide text-fg-muted">
        {label}
      </span>
      <span className={`font-mono text-xl ${color}`}>{value}</span>
    </div>
  );
}
