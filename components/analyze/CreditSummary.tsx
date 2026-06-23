"use client";

import type { CreditSessionReport } from "@/lib/analyze/credits";
import {
  KIRO_CREDIT_RATE_USD,
  formatCredits,
  formatUSD,
  kiroModelMultiplier,
} from "@/lib/pricing";

interface Props {
  report: CreditSessionReport;
}

// Credit-native headline stats for a Kiro session — the analog of CacheSummary.
export function CreditSummary({ report }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Credits used"
          hero={formatCredits(report.totalCredits)}
          sub={`across ${report.turnCount} metered turn${report.turnCount === 1 ? "" : "s"}`}
        />
        <Stat
          label="Cost"
          hero={formatUSD(report.totalCost)}
          sub={`@ $${KIRO_CREDIT_RATE_USD.overage}/credit (overage)`}
        />
        <Stat
          label="Mean / turn"
          hero={`${formatCredits(report.meanCreditsPerTurn)} cr`}
          sub={formatUSD(report.meanCreditsPerTurn * KIRO_CREDIT_RATE_USD.overage)}
        />
        <Stat
          label="Peak turn"
          hero={report.peakTurnIndex ? `${formatCredits(report.peakCredits)} cr` : "—"}
          sub={report.peakTurnIndex ? `turn ${report.peakTurnIndex}` : "no data"}
        />
      </div>

      {report.byModel.length > 0 ? (
        <div className="rounded-md border border-border bg-bg-subtle/40 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-fg-muted">
            Credits by model
          </div>
          <div className="space-y-1.5">
            {report.byModel.map((m) => {
              const mult = kiroModelMultiplier(m.model);
              const pct =
                report.totalCredits > 0
                  ? (m.credits / report.totalCredits) * 100
                  : 0;
              return (
                <div key={m.model} className="flex items-center gap-3 text-xs">
                  <div className="w-48 shrink-0 truncate font-mono text-fg" title={m.model}>
                    {m.model}
                    {mult !== null ? (
                      <span className="ml-1 text-fg-subtle">{mult}×</span>
                    ) : null}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-bg-emphasis">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <div className="w-28 shrink-0 text-right font-mono text-fg-muted">
                    {formatCredits(m.credits)} cr · {m.turns}t
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, hero, sub }: { label: string; hero: string; sub: string }) {
  return (
    <div className="rounded-md border border-border bg-bg-subtle/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="mt-1 font-mono text-2xl text-fg">{hero}</div>
      <div className="mt-0.5 text-[11px] text-fg-subtle">{sub}</div>
    </div>
  );
}
