"use client";

import type { CreditPortfolioReport } from "@/lib/analyze/creditPortfolio";
import {
  KIRO_PLANS,
  formatCredits,
  formatUSD,
  type KiroPlanId,
} from "@/lib/pricing";

interface Props {
  report: CreditPortfolioReport;
  planId: KiroPlanId;
}

// Portfolio-level monthly credit burn. Each month is a bar; the portion within
// the plan allotment is muted, the overage portion is highlighted, and the
// allotment line is drawn across. Maps directly to how Kiro bills (monthly reset).
export function CreditPortfolioBar({ report, planId }: Props) {
  const plan = KIRO_PLANS[planId];
  const allotment = plan.includedCredits;

  if (report.months.length === 0) {
    return (
      <div className="rounded-md border border-border bg-bg-subtle/60 px-4 py-6 text-center text-sm text-fg-muted">
        No Kiro credit usage recorded yet.
      </div>
    );
  }

  // Scale to the larger of the busiest month or the allotment, so the threshold
  // line is always visible even in months that never hit the cap.
  const maxCredits = Math.max(
    report.busiestMonth?.credits ?? 0,
    allotment > 0 ? allotment : 0,
    1,
  );

  return (
    <div className="rounded-md border border-border bg-bg-subtle/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-fg-muted">
          Credits per billing month
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-accent" aria-hidden />
            <span>within plan</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-warn" aria-hidden />
            <span>overage</span>
          </span>
          {allotment > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0 w-3 border-t border-dashed border-fg-subtle" aria-hidden />
              <span>{formatCredits(allotment)} allotment</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        {report.months.map((m) => {
          const withinPct = Math.min(m.credits, allotment > 0 ? allotment : m.credits);
          const overage = m.cost.overageCredits;
          const withinW = (withinPct / maxCredits) * 100;
          const overW = (overage / maxCredits) * 100;
          const allotW = allotment > 0 ? (allotment / maxCredits) * 100 : 0;
          return (
            <div key={m.month} className="flex items-center gap-3 text-xs">
              <div className="w-20 shrink-0 font-mono text-fg-muted">{m.label}</div>
              <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-bg-emphasis">
                <div
                  className="absolute inset-y-0 left-0 bg-accent"
                  style={{ width: `${withinW}%` }}
                />
                {overW > 0 ? (
                  <div
                    className="absolute inset-y-0 bg-warn"
                    style={{ left: `${withinW}%`, width: `${overW}%` }}
                  />
                ) : null}
                {allotment > 0 && allotW <= 100 ? (
                  <div
                    className="absolute inset-y-0 border-l border-dashed border-fg-subtle"
                    style={{ left: `${allotW}%` }}
                    aria-hidden
                  />
                ) : null}
              </div>
              <div
                className="w-44 shrink-0 text-right font-mono text-fg-muted"
                title={
                  planId === "overage-only"
                    ? `${formatCredits(m.credits)} credits × $0.04`
                    : `$${m.cost.monthlyFee}/mo + ${formatCredits(m.cost.overageCredits)} cr overage × $0.04`
                }
              >
                {formatCredits(m.credits)} cr · {formatUSD(m.cost.total)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border-muted pt-3 text-xs text-fg-muted">
        <span>
          {report.monthsActive} active month{report.monthsActive === 1 ? "" : "s"} ·{" "}
          {formatCredits(report.totalCredits)} credits total
        </span>
        <span title="Sum of each active month's plan-aware cost (flat fee + overage)">
          <span className="text-fg-subtle">est. all-in </span>
          <span className="font-mono text-fg">{formatUSD(report.totalCost)}</span>
        </span>
      </div>
    </div>
  );
}
