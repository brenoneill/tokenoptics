import {
  kiroPlanCostForCredits,
  type KiroPlanId,
  type KiroPlanCost,
} from "../pricing";
import type { ConversationSummary } from "../types";

// Portfolio-level credit analysis across all Kiro sessions, grouped by billing
// month. Kiro's allotment + overage resets monthly, so a per-month view is the
// only one that maps to how you're actually billed. Each month shows total
// credits burned and the plan-aware cost (flat fee + overage past the allotment).

export interface CreditMonthPoint {
  // "YYYY-MM" — the billing month bucket.
  month: string;
  // Human label, e.g. "Mar 2026".
  label: string;
  credits: number;
  sessionCount: number;
  cost: KiroPlanCost;
}

export interface CreditPortfolioReport {
  months: CreditMonthPoint[];
  totalCredits: number;
  // Sum of each month's plan-aware cost (flat fee charged once per active month).
  totalCost: number;
  monthsActive: number;
  busiestMonth: CreditMonthPoint | null;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Bucket key + label from an ISO timestamp, without Date.now()/locale surprises.
function monthBucket(iso: string): { key: string; label: string } | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year = m[1];
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return null;
  return { key: `${year}-${m[2]}`, label: `${MONTH_LABELS[monthIdx]} ${year}` };
}

export function computeCreditPortfolio(
  conversations: ConversationSummary[],
  planId: KiroPlanId,
): CreditPortfolioReport {
  const buckets = new Map<
    string,
    { label: string; credits: number; sessionCount: number }
  >();

  for (const c of conversations) {
    const credits = c.totalCredits ?? 0;
    if (credits <= 0) continue;
    // Attribute a session to the month it ended in (when its credits were spent).
    const bucket = monthBucket(c.endedAt || c.startedAt);
    if (!bucket) continue;
    const entry =
      buckets.get(bucket.key) ?? { label: bucket.label, credits: 0, sessionCount: 0 };
    entry.credits += credits;
    entry.sessionCount += 1;
    buckets.set(bucket.key, entry);
  }

  const months: CreditMonthPoint[] = [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([month, v]) => ({
      month,
      label: v.label,
      credits: v.credits,
      sessionCount: v.sessionCount,
      cost: kiroPlanCostForCredits(v.credits, planId),
    }));

  const totalCredits = months.reduce((s, m) => s + m.credits, 0);
  const totalCost = months.reduce((s, m) => s + m.cost.total, 0);
  let busiestMonth: CreditMonthPoint | null = null;
  for (const m of months) {
    if (!busiestMonth || m.credits > busiestMonth.credits) busiestMonth = m;
  }

  return {
    months,
    totalCredits,
    totalCost,
    monthsActive: months.length,
    busiestMonth,
  };
}
