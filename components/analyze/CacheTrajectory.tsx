"use client";

import { formatUSD } from "@/lib/pricing";
import type { CacheSessionReport, CacheTurnPoint, TokenBucket } from "@/lib/analyze/cache";

interface Props {
  report: CacheSessionReport;
}

// Color per dominant token bucket. We pull from the project's Tailwind
// tokens via text-* classes and let the SVG rect inherit via currentColor —
// keeping rendering consistent with the dark-only theme defined in CLAUDE.md.
const BUCKET_CLASS: Record<TokenBucket, string> = {
  output: "text-violet",
  cache_read: "text-sky",
  input: "text-warn",
  cache_write_5m: "text-accent",
  cache_write_1h: "text-success",
};

const BUCKET_LABEL: Record<TokenBucket, string> = {
  output: "output",
  cache_read: "cache read",
  input: "fresh input",
  cache_write_5m: "cache write (5m)",
  cache_write_1h: "cache write (1h)",
};

const CHART_HEIGHT = 160;
const CHART_PAD_TOP = 8;
const CHART_PAD_BOTTOM = 20;
const BAR_GAP = 2;

export function CacheTrajectory({ report }: Props) {
  const points = report.trajectory;
  if (points.length === 0) {
    return (
      <div className="rounded-md border border-border bg-bg-subtle/60 px-4 py-6 text-center text-sm text-fg-muted">
        No usage data recorded for this session.
      </div>
    );
  }

  const maxCost = Math.max(...points.map((p) => p.cost), report.baselineTurnCost);
  const usableHeight = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const scaleY = (cost: number) =>
    maxCost > 0 ? (cost / maxCost) * usableHeight : 0;

  // Bars fill the available width — chart is responsive via viewBox.
  const bars = points.length;
  const totalWidth = bars * 100; // arbitrary viewBox units; one bar = 100u
  const barWidth = 100 - BAR_GAP * 2;
  const baselineY =
    CHART_PAD_TOP + (usableHeight - scaleY(report.baselineTurnCost));

  return (
    <div className="rounded-md border border-border bg-bg-subtle/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-fg-muted">
          Cost per assistant turn
        </div>
        <Legend />
      </div>
      <svg
        viewBox={`0 0 ${totalWidth} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-40 w-full"
        role="img"
        aria-label="Cost per assistant turn, colored by dominant token bucket"
      >
        {report.baselineTurnCost > 0 ? (
          <line
            x1={0}
            x2={totalWidth}
            y1={baselineY}
            y2={baselineY}
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
      </svg>
      <div className="mt-1 flex items-baseline justify-between gap-2 text-[10px] text-fg-subtle">
        <span>turn 1</span>
        {report.baselineTurnCost > 0 ? (
          <span>
            dashed line = baseline {formatUSD(report.baselineTurnCost)}
          </span>
        ) : null}
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
  point: CacheTurnPoint;
  x: number;
  width: number;
  chartHeight: number;
  padBottom: number;
  scaleY: (cost: number) => number;
}) {
  const h = scaleY(point.cost);
  const y = chartHeight - padBottom - h;
  return (
    <g className={BUCKET_CLASS[point.dominantBucket]}>
      <rect
        x={x}
        y={Math.min(y, chartHeight - padBottom - 1)}
        width={width}
        height={Math.max(h, 1)}
        fill="currentColor"
        opacity={0.85}
      >
        <title>
          {`Turn ${point.turnIndex} — ${formatUSD(point.cost)}\nDominant: ${BUCKET_LABEL[point.dominantBucket]}\ninput=${point.inputTokens.toLocaleString()} cache_read=${point.cacheReadTokens.toLocaleString()} output=${point.outputTokens.toLocaleString()}`}
        </title>
      </rect>
    </g>
  );
}

function Legend() {
  const entries: TokenBucket[] = [
    "output",
    "cache_read",
    "input",
    "cache_write_5m",
    "cache_write_1h",
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-fg-muted">
      {entries.map((bucket) => (
        <span key={bucket} className="inline-flex items-center gap-1">
          <span
            className={`inline-block h-2 w-2 rounded-sm bg-current ${BUCKET_CLASS[bucket]}`}
            aria-hidden
          />
          <span>{BUCKET_LABEL[bucket]}</span>
        </span>
      ))}
    </div>
  );
}
