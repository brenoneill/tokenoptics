"use client";

import type { ReactNode } from "react";

import { formatUSD } from "@/lib/pricing";
import type { QualityRunSummary } from "@/lib/analyze/quality";

interface Props {
  summary: QualityRunSummary;
}

export function QualitySummary({ summary }: Props) {
  const pct =
    summary.sessionActualCost > 0
      ? (summary.totalWastedCost / summary.sessionActualCost) * 100
      : 0;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card label="Estimated waste" hero={formatUSD(summary.totalWastedCost)}>
        <Row
          label="% of session cost"
          value={summary.sessionActualCost > 0 ? `${pct.toFixed(1)}%` : "—"}
        />
        <Row
          label="Output tokens"
          value={summary.totalWastedOutputTokens.toLocaleString()}
        />
        <Row label="Session cost" value={formatUSD(summary.sessionActualCost)} />
      </Card>

      <Card
        label="Waste breakdown"
        hero={`${summary.wastefulTaskCount}/${summary.totalTasks}`}
      >
        <Row label="Info-gap tasks" value={summary.infoGapTaskCount.toString()} />
        <Row
          label="Direction-change tasks"
          value={summary.directionChangeTaskCount.toString()}
        />
        <Row label="Mixed" value={summary.mixedTaskCount.toString()} />
      </Card>

      <Card label="Run details" hero={formatUSD(summary.classifierCost)}>
        <Row label="Classifier" value={summary.classifierModel} />
        <Row label="Failed to classify" value={summary.skippedCount.toString()} />
        <Row label="Tasks analyzed" value={summary.totalTasks.toString()} />
      </Card>
    </div>
  );
}

function Card({
  label,
  hero,
  children,
}: {
  label: string;
  hero: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-bg-subtle/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="mt-1 font-mono text-2xl text-fg">{hero}</div>
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
