"use client";

import type { ReactNode } from "react";

import { formatUSD } from "@/lib/pricing";
import type { RoutingRunSummary } from "@/lib/analyze/types";

interface Props {
  summary: RoutingRunSummary;
}

export function RoutingSummary({ summary }: Props) {
  const pct =
    summary.actualCost > 0 ? (summary.totalSavings / summary.actualCost) * 100 : 0;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card label="Estimated savings" hero={formatUSD(summary.totalSavings)}>
        <Row
          label="% of session cost"
          value={summary.actualCost > 0 ? `${pct.toFixed(1)}%` : "—"}
        />
        <Row label="Overspent prompts" value={summary.savingsCount.toString()} />
        <Row label="Aligned prompts" value={summary.alignedCount.toString()} />
      </Card>

      <Card label="Cost comparison" hero={formatUSD(summary.recommendedCost)}>
        <Row label="Actual" value={formatUSD(summary.actualCost)} />
        <Row label="If routed by recommendation" value={formatUSD(summary.recommendedCost)} />
        <Row label="Classifier" value={formatUSD(summary.classifierCost)} />
      </Card>

      <Card
        label="Coverage"
        hero={`${summary.classifiedCount}/${summary.totalUserPrompts}`}
      >
        <Row
          label="Possibly under-spec'd"
          value={summary.underSpeccedCount.toString()}
        />
        <Row
          label="Folded as continuation"
          value={summary.continuationCount.toString()}
        />
        <Row label="Failed to classify" value={summary.skippedCount.toString()} />
        <Row label="Classifier model" value={summary.classifierModel} />
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
