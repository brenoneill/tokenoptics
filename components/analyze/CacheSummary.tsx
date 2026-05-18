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
  const sharePct =
    report.totalCost > 0
      ? `${(report.aboveBaselineContextShare * 100).toFixed(0)}%`
      : "—";
  const rampLabel =
    report.baselineTurnCost > 0
      ? `${report.finalRampRatio.toFixed(1)}×`
      : "—";

  const driftDetected = report.recoverableBloatCost > 0;
  const headerLabel = driftDetected
    ? "Estimated unnecessary spend"
    : "Above-baseline context cost";
  const heroValue = driftDetected
    ? formatUSD(report.recoverableBloatCost)
    : formatUSD(report.aboveBaselineContextCost);
  const headerHint = driftDetected
    ? "Drift signals fired — this cost is likely recoverable with /clear or /compact at the topic boundary."
    : "Cache_read paid above the early-session baseline. In a focused session this is the natural cost of a growing context — not waste. Only counts as recoverable when drift signals fire.";
  const recoverableLabel = driftDetected
    ? "Likely recoverable"
    : "Recoverable (no drift)";
  const recoverableValue = driftDetected
    ? formatUSD(report.recoverableBloatCost)
    : "$0.00";

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card label={headerLabel} hero={heroValue} hint={headerHint}>
        <Row label="% of session cost" value={sharePct} />
        <Row label={recoverableLabel} value={recoverableValue} />
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
