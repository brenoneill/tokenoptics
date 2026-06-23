"use client";

import type { CreditSessionReport, CreditTurnPoint } from "@/lib/analyze/credits";
import { formatCredits, formatUSD, kiroModelMultiplier } from "@/lib/pricing";

interface Props {
  report: CreditSessionReport;
}

const CHART_HEIGHT = 160;
const CHART_PAD_TOP = 8;
const CHART_PAD_BOTTOM = 20;
const BAR_GAP = 2;

// Per-turn credit burn (bars) with the cumulative spend overlaid as a line.
// The credit-native analog of CacheTrajectory — Kiro meters credits, not tokens.
export function CreditTrajectory({ report }: Props) {
  const points = report.trajectory;
  if (points.length === 0) {
    return (
      <div className="rounded-md border border-border bg-bg-subtle/60 px-4 py-6 text-center text-sm text-fg-muted">
        No credit usage recorded for this session.
      </div>
    );
  }

  const maxCredits = Math.max(...points.map((p) => p.credits));
  const usableHeight = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const scaleY = (c: number) => (maxCredits > 0 ? (c / maxCredits) * usableHeight : 0);

  const bars = points.length;
  const totalWidth = bars * 100;
  const barWidth = 100 - BAR_GAP * 2;
  const meanY =
    CHART_PAD_TOP + (usableHeight - scaleY(report.meanCreditsPerTurn));

  // Cumulative line, scaled to its own max (the session total) across the height.
  const cumulativePath = points
    .map((p, i) => {
      const x = i * 100 + 50;
      const y =
        CHART_PAD_TOP +
        (usableHeight - (p.cumulativeCredits / report.totalCredits) * usableHeight);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-md border border-border bg-bg-subtle/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-fg-muted">
          Credits per turn
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-accent" aria-hidden />
            <span>credits / turn</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-violet" aria-hidden />
            <span>cumulative</span>
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${totalWidth} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-40 w-full"
        role="img"
        aria-label="Credits spent per turn, with cumulative credit spend overlaid"
      >
        {report.meanCreditsPerTurn > 0 ? (
          <line
            x1={0}
            x2={totalWidth}
            y1={meanY}
            y2={meanY}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="4 4"
            className="text-fg-subtle"
            opacity={0.5}
          />
        ) : null}
        {points.map((p, i) => (
          <Bar
            key={p.turnIndex}
            point={p}
            x={i * 100 + BAR_GAP}
            width={barWidth}
            chartHeight={CHART_HEIGHT}
            padBottom={CHART_PAD_BOTTOM}
            scaleY={scaleY}
          />
        ))}
        <path
          d={cumulativePath}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-violet"
          vectorEffect="non-scaling-stroke"
          opacity={0.9}
        />
      </svg>
      <div className="mt-1 flex items-baseline justify-between gap-2 text-[10px] text-fg-subtle">
        <span>turn 1</span>
        <span>dashed line = mean {formatCredits(report.meanCreditsPerTurn)} cr/turn</span>
        <span>turn {points.length}</span>
      </div>
    </div>
  );
}

function Bar({
  point,
  x,
  width,
  chartHeight,
  padBottom,
  scaleY,
}: {
  point: CreditTurnPoint;
  x: number;
  width: number;
  chartHeight: number;
  padBottom: number;
  scaleY: (c: number) => number;
}) {
  const h = scaleY(point.credits);
  const y = chartHeight - padBottom - h;
  const mult = kiroModelMultiplier(point.model);
  return (
    <g className="text-accent">
      <rect
        x={x}
        y={Math.min(y, chartHeight - padBottom - 1)}
        width={width}
        height={Math.max(h, 1)}
        fill="currentColor"
        opacity={0.85}
      >
        <title>
          {`Turn ${point.turnIndex} — ${formatCredits(point.credits)} credits (${formatUSD(point.cost)})\ncumulative ${formatCredits(point.cumulativeCredits)} cr${point.model ? `\nmodel ${point.model}${mult !== null ? ` (${mult}× credit rate)` : ""}` : ""}`}
        </title>
      </rect>
    </g>
  );
}
