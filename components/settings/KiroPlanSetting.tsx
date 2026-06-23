"use client";

import { setKiroPlan, useKiroPlan } from "@/lib/preferences/kiroPlan";
import { KIRO_PLANS, type KiroPlanId } from "@/lib/pricing";

const PLAN_ORDER: KiroPlanId[] = ["free", "pro", "pro-plus", "power", "overage-only"];

export function KiroPlanSetting() {
  const plan = useKiroPlan();
  const selected = KIRO_PLANS[plan];

  return (
    <div className="flex items-start justify-between gap-6 rounded-md border border-border bg-bg-subtle/40 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">Kiro plan</div>
        <p className="mt-1 text-xs text-fg-muted">
          Kiro bills in credits against a flat monthly plan. Your plan sets how
          account cost is estimated: the monthly fee plus $0.04 per credit over
          the included allotment. Per-session dollar figures always use the
          marginal $0.04/credit overage rate.
        </p>
        {selected.id !== "overage-only" ? (
          <p className="mt-1 text-xs text-fg-subtle">
            {selected.name}: ${selected.monthlyUSD}/mo ·{" "}
            {selected.includedCredits.toLocaleString()} credits included
            {selected.overageUSDPerCredit > 0
              ? ` · $${selected.overageUSDPerCredit.toFixed(2)}/credit overage`
              : " · no overage"}
          </p>
        ) : (
          <p className="mt-1 text-xs text-fg-subtle">
            Every credit billed at the $0.04 marginal overage rate — no flat fee
            modeled.
          </p>
        )}
      </div>
      <select
        value={plan}
        onChange={(e) => setKiroPlan(e.target.value as KiroPlanId)}
        aria-label="Kiro plan"
        className="shrink-0 rounded-md border border-border bg-bg-subtle px-3 py-1.5 text-sm text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
      >
        {PLAN_ORDER.map((id) => (
          <option key={id} value={id}>
            {KIRO_PLANS[id].name}
          </option>
        ))}
      </select>
    </div>
  );
}
