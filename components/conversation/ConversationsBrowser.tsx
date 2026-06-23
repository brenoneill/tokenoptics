"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  MagnifyingGlassIcon,
  FolderOpenIcon,
  SparklesIcon,
  ChevronDownIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { ComparisonCanvasChip } from "@/components/conversation/ComparisonCanvasChip";
import { ConversationCard } from "@/components/conversation/ConversationCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { projectLabel } from "@/lib/conversation";
import {
  KIRO_CREDIT_RATE_USD,
  KIRO_PLANS,
  formatCredits,
  formatTokens,
  formatUSD,
  kiroPlanCostForCredits,
  isCreditHarness,
  type KiroPlanId,
} from "@/lib/pricing";
import { setKiroPlan, useKiroPlan } from "@/lib/preferences/kiroPlan";
import {
  setMinConversationCost,
  useMinConversationCost,
} from "@/lib/preferences/minConversationCost";
import type { CacheHealth } from "@/lib/analyze/cache";
import type { ConversationSummary } from "@/lib/types";

const ALL_PROJECTS = "__all__";
const ALL_BRANCHES = "__all__";
const NO_BRANCH = "__none__";
const ALL_BLOAT = "__all__";

type SortKey = "recent" | "cost-desc" | "cost-asc";

// "Level of bloat" is the session's cache/context health — the same
// traffic-light shown on each card (see CacheHealthDot). A conversation
// with cacheHealth === null (too short to classify) only matches "All".
type BloatFilter = typeof ALL_BLOAT | CacheHealth;

const BLOAT_OPTIONS: { value: BloatFilter; label: string; dot: string }[] = [
  { value: ALL_BLOAT, label: "All bloat levels", dot: "bg-fg-subtle" },
  { value: "good", label: "No bloat", dot: "bg-success" },
  { value: "climbing", label: "Climbing", dot: "bg-warn" },
  { value: "poor", label: "Drift", dot: "bg-danger" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "cost-desc", label: "Cost (high to low)" },
  { value: "cost-asc", label: "Cost (low to high)" },
];

export interface ConversationEntry {
  conversation: ConversationSummary;
  hasChunks: boolean;
}

interface Props {
  entries: ConversationEntry[];
  header?: ReactNode;
  // Rendered after the sticky header, before the grid — for non-sticky panels
  // like the Kiro credit portfolio.
  beforeList?: ReactNode;
}

function branchKey(c: ConversationSummary): string {
  const b = c.gitBranch?.trim();
  return b && b.length > 0 ? b : NO_BRANCH;
}

export function ConversationsBrowser({ entries, header, beforeList }: Props) {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState<string>(ALL_PROJECTS);
  const [branch, setBranch] = useState<string>(ALL_BRANCHES);
  const [bloat, setBloat] = useState<BloatFilter>(ALL_BLOAT);
  const [labelledOnly, setLabelledOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const minCost = useMinConversationCost();
  const kiroPlan = useKiroPlan();

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
    const matches = entries.filter((e) => {
      const c = e.conversation;
      if (project !== ALL_PROJECTS && projectLabel(c) !== project) return false;
      if (branch !== ALL_BRANCHES && branchKey(c) !== branch) return false;
      if (bloat !== ALL_BLOAT && c.cacheHealth !== bloat) return false;
      if (labelledOnly && !e.hasChunks) return false;
      if (minCost !== null && c.totalCost < minCost) return false;
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
    if (sort === "recent") return matches;
    const sorted = matches.slice();
    sorted.sort((a, b) => {
      const diff = a.conversation.totalCost - b.conversation.totalCost;
      return sort === "cost-desc" ? -diff : diff;
    });
    return sorted;
  }, [entries, query, project, branch, bloat, labelledOnly, minCost, sort]);

  const totals = useMemo(() => {
    let cost = 0;
    let output = 0;
    let input = 0;
    let credits = 0;
    for (const e of filtered) {
      cost += e.conversation.totalCost;
      output += e.conversation.totalOutputTokens;
      input += e.conversation.totalInputTokens;
      credits += e.conversation.totalCredits ?? 0;
    }
    return { cost, output, input, credits };
  }, [filtered]);

  // Show the credit view when any filtered session comes from a credit-metered
  // harness (Kiro) — keyed off harness, not amount, so a batch of zero-credit
  // Kiro sessions still reads as credits rather than falling back to tokens.
  // The plan-aware account cost (flat fee + overage) only makes sense across a
  // whole billing month, so it's an account-level estimate, not a per-session sum.
  const hasCredits = useMemo(
    () => filtered.some((e) => isCreditHarness(e.conversation.harnessId)),
    [filtered],
  );
  const planCost = useMemo(
    () => kiroPlanCostForCredits(totals.credits, kiroPlan),
    [totals.credits, kiroPlan],
  );

  const isFiltered =
    query.trim().length > 0 ||
    project !== ALL_PROJECTS ||
    branch !== ALL_BRANCHES ||
    bloat !== ALL_BLOAT ||
    labelledOnly;

  const currentBloat =
    BLOAT_OPTIONS.find((o) => o.value === bloat) ?? BLOAT_OPTIONS[0];

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-20 bg-bg pt-4 pb-4">
        {header}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
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
            disabled={project === ALL_PROJECTS || branchOptions.length <= 1}
            options={branchOptions}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <Menu as="div" className="relative">
            <MenuButton
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-emphasis px-2.5 py-0.5 text-xs text-fg-muted transition-colors hover:bg-bg-subtle data-[open]:bg-bg-subtle"
              aria-label="Filter by bloat level"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${currentBloat.dot}`}
                aria-hidden
              />
              <span className="text-fg">{currentBloat.label}</span>
              <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden />
            </MenuButton>
            <MenuItems
              anchor="bottom start"
              className="z-40 mt-1 min-w-[12rem] rounded-md border border-border bg-bg shadow-lg outline-none"
            >
              {BLOAT_OPTIONS.map((opt) => (
                <MenuItem key={opt.value}>
                  {({ focus }) => (
                    <button
                      type="button"
                      onClick={() => setBloat(opt.value)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        focus ? "bg-bg-emphasis text-fg" : "text-fg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${opt.dot}`}
                        aria-hidden
                      />
                      <span className="flex-1">{opt.label}</span>
                      {bloat === opt.value ? (
                        <CheckIcon className="h-4 w-4 text-accent" aria-hidden />
                      ) : null}
                    </button>
                  )}
                </MenuItem>
              ))}
            </MenuItems>
          </Menu>
          {minCost !== null ? (
            <Badge variant="sky" className="pr-1" mono>
              Min cost {formatUSD(minCost)}
              <button
                type="button"
                onClick={() => setMinConversationCost(null)}
                aria-label="Clear minimum cost filter"
                className="-mr-0.5 ml-1 rounded-full p-0.5 transition-colors hover:bg-sky/20"
              >
                <XMarkIcon className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ) : null}
          <Menu as="div" className="relative ml-auto">
            <MenuButton
              className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-emphasis px-2.5 py-0.5 text-xs text-fg-muted transition-colors hover:bg-bg-subtle data-[open]:bg-bg-subtle"
              aria-label="Sort conversations"
            >
              <span className="text-fg-subtle">Sort:</span>
              <span className="text-fg">
                {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Recent"}
              </span>
              <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden />
            </MenuButton>
            <MenuItems
              anchor="bottom start"
              className="z-40 mt-1 min-w-[12rem] rounded-md border border-border bg-bg shadow-lg outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <MenuItem key={opt.value}>
                  {({ focus }) => (
                    <button
                      type="button"
                      onClick={() => setSort(opt.value)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                        focus ? "bg-bg-emphasis text-fg" : "text-fg-muted"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sort === opt.value ? (
                        <CheckIcon className="h-4 w-4 text-accent" aria-hidden />
                      ) : null}
                    </button>
                  )}
                </MenuItem>
              ))}
            </MenuItems>
          </Menu>
        </div>
      </div>

      {beforeList}

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
              {!hasCredits ? (
                <TotalStat
                  label="Cost"
                  value={formatUSD(totals.cost)}
                  accent
                  title="Sum of per-session token cost."
                />
              ) : null}
              {hasCredits ? (
                <>
                  <TotalStat
                    label="Credits"
                    value={formatCredits(totals.credits)}
                    title="Total Kiro credits used across the filtered sessions"
                  />
                  <div className="flex items-baseline gap-2">
                    {/* Inline plan picker so the assumed plan is visible and
                        changeable right where the estimate appears (also in
                        Settings → Kiro). */}
                    <label className="flex items-baseline gap-1.5">
                      <span className="text-xs uppercase tracking-wide text-fg-muted">
                        Plan
                      </span>
                      <select
                        value={kiroPlan}
                        onChange={(e) => setKiroPlan(e.target.value as KiroPlanId)}
                        aria-label="Kiro plan"
                        className="rounded-md border border-border bg-bg-subtle px-2 py-0.5 font-mono text-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                      >
                        {(Object.keys(KIRO_PLANS) as KiroPlanId[]).map((id) => (
                          <option key={id} value={id}>
                            {KIRO_PLANS[id].name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TotalStat
                      label="est. bill"
                      value={formatUSD(planCost.total)}
                      accent
                      title={
                        kiroPlan === "overage-only"
                          ? `No flat plan: all ${formatCredits(totals.credits)} credits × $${KIRO_CREDIT_RATE_USD.overage} overage = ${formatUSD(planCost.total)}.`
                          : `Your estimated bill on the ${KIRO_PLANS[kiroPlan].name} plan: $${planCost.monthlyFee}/mo flat fee + ${formatCredits(planCost.overageCredits)} credits over the ${KIRO_PLANS[kiroPlan].includedCredits.toLocaleString()} allotment × $${KIRO_CREDIT_RATE_USD.overage} = ${formatUSD(planCost.overageCost)} overage. Per billing month.`
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <TotalStat label="Output" value={formatTokens(totals.output)} />
                  <TotalStat label="Input" value={formatTokens(totals.input)} />
                </>
              )}
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
  title,
}: {
  label: string;
  value: string;
  accent?: boolean;
  title?: string;
}) {
  const color = accent ? "text-accent" : "text-fg";
  return (
    <div className="flex items-baseline gap-2" title={title}>
      <span className="text-xs uppercase tracking-wide text-fg-muted">
        {label}
      </span>
      <span className={`font-mono text-xl ${color}`}>{value}</span>
    </div>
  );
}
