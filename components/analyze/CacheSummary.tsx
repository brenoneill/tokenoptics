"use client";

import type { ReactNode } from "react";

import { formatUSD } from "@/lib/pricing";
import type { CacheSessionReport } from "@/lib/analyze/cache";

interface Props {
  report: CacheSessionReport;
}

export function CacheSummary({ report }: Props) {
  const hitPct =
    report.inputTokens + report.cacheReadTokens > 0
      ? `${(report.cacheHitRatio * 100).toFixed(0)}%`
      : "—";
  const rampLabel =
    report.baselineTurnCost > 0
      ? `${report.finalRampRatio.toFixed(1)}×`
      : "—";

  const driftDetected = report.recoverableBloatCost > 0;
  const driftSignalCount = report.recommendations.filter(
    (r) => r.severity === "critical" || r.severity === "warn",
  ).length;
  // Recoverable spend as a share of total session cost — $0.00 / 0% when no
  // drift fired, so this tracks the hero rather than the raw above-baseline.
  const recoverableSharePct =
    report.totalCost > 0
      ? `${((report.recoverableBloatCost / report.totalCost) * 100).toFixed(0)}%`
      : "—";
  const headerLabel = driftDetected
    ? "Likely recoverable"
    : "Recoverable spend";
  // Hero is always the drift-gated recoverable number — $0.00 when no drift
  // signals fired. We intentionally don't surface the raw "above-baseline
  // context cost" on this card: it reads as money lost when it's usually just
  // the natural cost of a growing context. Only the drift-gated figure is
  // actionable.
  const heroValue = formatUSD(report.recoverableBloatCost);
  const headerHint = driftDetected
    ? "Drift signals fired — this cost is likely recoverable with /clear or /compact at the topic boundary."
    : "No drift signals fired — nothing here looks recoverable. A long, focused session re-reading its own context is expected, not waste.";

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card label={headerLabel} hero={heroValue} hint={headerHint}>
        <Row label="% of session cost" value={recoverableSharePct} />
        <Row
          label="Drift signals"
          value={driftSignalCount === 0 ? "None" : String(driftSignalCount)}
        />
        <Row label="Session total" value={formatUSD(report.totalCost)} />
      </Card>

      <Card label="Cache hit ratio" hero={hitPct}>
        <Row
          label="Cache reads"
          value={report.cacheReadTokens.toLocaleString()}
        />
        <Row
          label="Fresh input"
          value={report.inputTokens.toLocaleString()}
        />
        <Row
          label="Assistant turns"
          value={report.assistantTurnCount.toString()}
        />
      </Card>

      <Card label="Cost-per-turn ramp" hero={rampLabel}>
        <Row
          label="Early-turn baseline"
          value={formatUSD(report.baselineTurnCost)}
        />
        <Row
          label="Baseline cache_read"
          value={formatUSD(report.baselineCacheReadCost)}
        />
        <Row
          label="Cache 5m / 1h"
          value={`${report.cacheWrite5mTokens.toLocaleString()} / ${report.cacheWrite1hTokens.toLocaleString()}`}
        />
      </Card>
    </div>
  );
}

function Card({
  label,
  hero,
  hint,
  children,
}: {
  label: string;
  hero: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-bg-subtle/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="mt-1 font-mono text-2xl text-fg" title={hint}>
        {hero}
      </div>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-fg-subtle">{label}</span>
      <span className="font-mono text-fg">{value}</span>
    </div>
  );
}
