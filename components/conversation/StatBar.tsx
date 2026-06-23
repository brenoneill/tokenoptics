"use client";

import type { CSSProperties, ReactNode } from "react";

import type { ChunkColor } from "@/lib/labeling/colors";
import type { ScopeStats } from "@/lib/efficiency/scopeStats";
import {
  KIRO_CREDIT_RATE_USD,
  formatCredits,
  formatTokens,
  formatUSD,
} from "@/lib/pricing";

interface Props {
  scopeLabel: string;
  stats: ScopeStats;
  color?: ChunkColor;
}

export function StatBar({ scopeLabel, stats, color }: Props) {
  const avgPerPromptMs =
    stats.promptCount > 0 ? stats.durationMs / stats.promptCount : 0;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {stats.isCredits ? (
        <Card color={color} label="Cost" hero={formatUSD(stats.cost)}>
          <Row label="Credits used" value={formatCredits(stats.credits)} />
          <Row label="Rate" value={`$${KIRO_CREDIT_RATE_USD.overage}/credit`} />
          <Row label="Basis" value="overage" />
        </Card>
      ) : (
        <Card color={color} label="Cost" hero={formatUSD(stats.cost)}>
          <Row label="Input" value={`${formatTokens(stats.inputTokens)} tok`} />
          <Row label="Output" value={`${formatTokens(stats.outputTokens)} tok`} />
          <Row label="Cache read" value={`${formatTokens(stats.cacheReadTokens)} tok`} />
          <Row label="Cache write" value={`${formatTokens(stats.cacheWriteTokens)} tok`} />
        </Card>
      )}

      <Card color={color} label="Duration" hero={formatDuration(stats.durationMs)}>
        <Row
          label="Started"
          value={<span suppressHydrationWarning>{formatTime(stats.startedAt)}</span>}
        />
        <Row
          label="Ended"
          value={<span suppressHydrationWarning>{formatTime(stats.endedAt)}</span>}
        />
        {stats.promptCount > 1 ? (
          <Row label="Avg / prompt" value={formatDuration(avgPerPromptMs)} />
        ) : null}
      </Card>

      <Card color={color} label={`${scopeLabel} overview`}>
        <Row label="Messages" value={stats.messageCount.toLocaleString()} />
        <Row label="Prompts" value={stats.promptCount.toLocaleString()} />
        <Row
          label="Lines"
          value={
            <>
              <span className="text-success">+{stats.linesAdded.toLocaleString()}</span>
              {"  "}
              <span className="text-danger">−{stats.linesRemoved.toLocaleString()}</span>
              {stats.linesRewritten > 0 ? (
                <>
                  {"  "}
                  <span className="text-fg-subtle">~{stats.linesRewritten.toLocaleString()}</span>
                </>
              ) : null}
            </>
          }
        />
        <Row label="Diffs" value={stats.diffCount.toLocaleString()} />
      </Card>
    </div>
  );
}

function Card({
  color,
  label,
  hero,
  children,
}: {
  color?: ChunkColor;
  label: string;
  hero?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = color
    ? { backgroundColor: color.bg, borderColor: color.border }
    : {};
  return (
    <div
      className={`rounded-md border px-4 py-3 transition-colors ${
        color ? "" : "border-border bg-bg-subtle/60"
      }`}
      style={style}
    >
      <div className="text-xs uppercase tracking-wide text-fg-muted">{label}</div>
      {hero ? (
        <div className="mt-1 font-mono text-2xl text-fg">{hero}</div>
      ) : null}
      <div className={`${hero ? "mt-2" : "mt-1"} space-y-1`}>{children}</div>
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

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) return `${totalMinutes}m ${seconds}s`;
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) return `${totalHours}h ${minutes}m`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}d ${hours}h`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
