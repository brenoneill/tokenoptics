"use client";

import { useMemo, useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

import { CreditPortfolioBar } from "@/components/analyze/CreditPortfolioBar";
import { computeCreditPortfolio } from "@/lib/analyze/creditPortfolio";
import { useKiroPlan } from "@/lib/preferences/kiroPlan";
import { formatCredits, formatUSD, isCreditHarness } from "@/lib/pricing";
import type { ConversationSummary } from "@/lib/types";

interface Props {
  conversations: ConversationSummary[];
}

// Collapsible portfolio-level Kiro credit view, shown above the conversation
// list when any Kiro credit sessions are present. Aggregates across ALL
// sessions (not the list's filters) since billing is account-wide and monthly.
export function KiroCreditPortfolioPanel({ conversations }: Props) {
  const plan = useKiroPlan();
  const [open, setOpen] = useState(false);

  const hasCredits = useMemo(
    () => conversations.some((c) => isCreditHarness(c.harnessId)),
    [conversations],
  );

  const report = useMemo(
    () => computeCreditPortfolio(conversations, plan),
    [conversations, plan],
  );

  if (!hasCredits) return null;

  return (
    <div className="mb-5 rounded-lg border border-accent/30 bg-bg-subtle/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-bg-emphasis"
      >
        <ChevronRightIcon
          className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <span className="text-sm font-medium text-fg">Kiro credit usage</span>
        <span className="ml-auto flex items-baseline gap-3 font-mono text-xs text-fg-muted">
          <span>{formatCredits(report.totalCredits)} cr</span>
          <span>·</span>
          <span>
            {report.monthsActive} mo · est. {formatUSD(report.totalCost)}
          </span>
        </span>
      </button>
      {open ? (
        <div className="border-t border-border-muted p-4">
          <p className="mb-3 text-xs text-fg-muted">
            Credits burned per billing month across all Kiro sessions, against
            your plan&apos;s monthly allotment. Allotment + overage reset each
            month — change your plan in the totals bar below or in Settings.
          </p>
          <CreditPortfolioBar report={report} planId={plan} />
        </div>
      ) : null}
    </div>
  );
}
