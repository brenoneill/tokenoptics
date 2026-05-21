"use client";

import { useState } from "react";

import { CacheRecommendations } from "@/components/analyze/CacheRecommendations";
import { CacheTrajectory } from "@/components/analyze/CacheTrajectory";
import { CacheHealthDot } from "@/components/conversation/CacheHealthDot";
import { cacheHealthFromReport, type CacheHealth } from "@/lib/analyze/cache";
import { bloatDemoSessions } from "@/lib/mock/landingFixtures";
import { formatUSD } from "@/lib/pricing";

// Default to the worst session — the steep ramp is the clearest read on
// what the chart is showing.
const DEFAULT_SESSION = "bloated";

const HEALTH_CHIP: Record<
  CacheHealth,
  { dot: string; activeBorder: string; activeBg: string }
> = {
  good: {
    dot: "bg-success",
    activeBorder: "border-success/50",
    activeBg: "bg-success/10",
  },
  climbing: {
    dot: "bg-warn",
    activeBorder: "border-warn/50",
    activeBg: "bg-warn/10",
  },
  poor: {
    dot: "bg-danger",
    activeBorder: "border-danger/50",
    activeBg: "bg-danger/10",
  },
};

const HEALTH_LABEL: Record<CacheHealth, string> = {
  good: "Healthy",
  climbing: "Drifting",
  poor: "Bloated",
};

const HEALTH_TEXT: Record<CacheHealth, string> = {
  good: "text-success",
  climbing: "text-warn",
  poor: "text-danger",
};

export function BloatSection() {
  const [activeId, setActiveId] = useState<string>(DEFAULT_SESSION);
  const active =
    bloatDemoSessions.find((s) => s.id === activeId) ?? bloatDemoSessions[0];
  const { report } = active;
  // Every demo session is long enough to classify, so this is never null.
  const health = cacheHealthFromReport(report) ?? "good";

  return (
    <section className="space-y-8">
      <div className="max-w-2xl">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet">
          context bloat
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
          Catch a session bloating before the bill does.
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Every assistant turn re-reads the whole conversation so far. As one
          session drifts across topics, that{" "}
          <span className="font-mono text-fg">cache_read</span> stack keeps
          growing — and cost per turn climbs with it. Tokenoptics re-prices
          every turn straight from the on-disk usage numbers, charts the ramp,
          and flags the drift with a traffic light before you ever feel it.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-border-muted bg-bg-subtle/40 p-6">
        <div className="flex flex-wrap items-center gap-2">
          {bloatDemoSessions.map((s) => {
            const h = cacheHealthFromReport(s.report) ?? "good";
            const isActive = s.id === activeId;
            const chip = HEALTH_CHIP[h];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs text-fg transition-colors ${
                  isActive
                    ? `${chip.activeBorder} ${chip.activeBg}`
                    : "border-border bg-transparent hover:border-border-muted"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${chip.dot} ${
                    isActive ? "scale-125 ring-2 ring-bg" : ""
                  }`}
                  aria-hidden
                />
                <span className={isActive ? "font-medium" : ""}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-2.5 border-b border-border-muted pb-4">
          <CacheHealthDot health={health} className="mt-[5px] shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-fg">
              <span className={HEALTH_TEXT[health]}>{HEALTH_LABEL[health]}</span>
              <span className="text-fg-subtle"> · {active.meta}</span>
            </div>
            <p className="mt-0.5 text-sm text-fg-muted">{active.verdict}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Session cost" value={formatUSD(report.totalCost)} />
          <Stat
            label="Cost-per-turn ramp"
            value={`${report.finalRampRatio.toFixed(1)}×`}
            valueClass={HEALTH_TEXT[health]}
          />
          <Stat
            label="Recoverable spend"
            value={formatUSD(report.recoverableBloatCost)}
            valueClass={
              report.recoverableBloatCost > 0 ? "text-danger" : "text-fg-subtle"
            }
          />
        </div>

        <CacheTrajectory report={report} />
        <CacheRecommendations recommendations={report.recommendations} />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  valueClass = "text-fg",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-bg-subtle/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-fg-muted">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl ${valueClass}`}>{value}</div>
    </div>
  );
}
