"use client";

import { SparklesIcon } from "@heroicons/react/24/outline";

import { Alert } from "@/components/ui/Alert";
import { RoutingSummary } from "@/components/analyze/RoutingSummary";
import { RoutingTurnsTable } from "@/components/analyze/RoutingTurnsTable";
import type { RoutingRunRecord } from "@/lib/analyze/types";
import { formatUSD } from "@/lib/pricing";
import type {
  RoutingProgress,
  RoutingPromptEvent,
} from "@/lib/storage/browser/syncClient";

interface RoutingAnalysisPanelProps {
  hasApiKey: boolean;
  promptCount: number;
  estimatedCost: number;
  running: boolean;
  runError: string | null;
  progress: RoutingProgress | null;
  events: RoutingPromptEvent[];
  run: RoutingRunRecord | null;
  onRun: () => void;
}

/**
 * The "Analysis" tab body. Routing analysis used to be its own /analyze page;
 * it now lives as a tab on the conversation view. State and the run callback
 * are owned by the page so the tab can be revealed the moment a run starts.
 */
export function RoutingAnalysisPanel({
  hasApiKey,
  promptCount,
  estimatedCost,
  running,
  runError,
  progress,
  events,
  run,
  onRun,
}: RoutingAnalysisPanelProps) {
  const completed = progress?.completed ?? 0;
  const failed = progress?.failed ?? 0;
  const total = progress?.total ?? promptCount;
  const done = completed + failed;
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-fg">Routing analysis</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Per-prompt model-routing efficiency — whether each turn could have
            run on a cheaper or stronger tier.
          </p>
          <p className="mt-1 text-xs text-fg-subtle">
            Each run sends {promptCount} user prompt
            {promptCount === 1 ? "" : "s"} to the Anthropic API for
            classification (Haiku 4.5) · est.{" "}
            <strong>{formatUSD(estimatedCost)}</strong>. Per AGENTS.md rule #2
            this violates the no-egress invariant — testing only, not for main.
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={running || !hasApiKey || promptCount === 0}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-violet/40 bg-violet-subtle px-3 py-2 text-sm font-medium text-violet transition-colors hover:bg-violet/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SparklesIcon className="h-4 w-4" aria-hidden />
          {running ? "Running…" : run ? "Re-run analysis" : "Run analysis"}
        </button>
      </div>

      {!hasApiKey ? (
        <Alert variant="warn" title="Missing API key">
          Set <code className="font-mono">NEXT_PUBLIC_ANTHROPIC_API_KEY</code>{" "}
          in <code className="font-mono">.env.local</code> and restart the dev
          server. The key is read directly in the browser — testing only.
        </Alert>
      ) : null}

      {runError ? (
        <Alert variant="danger" title="Analysis failed">
          <div className="font-mono text-xs break-all">{runError}</div>
          <div className="mt-2 text-xs text-fg-subtle">
            Check the browser devtools console for{" "}
            <code className="font-mono">[analyze]</code> log entries with the
            full error.
          </div>
        </Alert>
      ) : null}

      {running ? (
        <div className="rounded-md border border-accent/30 bg-accent-subtle px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-fg">
              Classifying user prompts
            </div>
            <div className="font-mono text-xs text-fg-muted">
              {done} / {total}
              {failed > 0 ? (
                <span className="ml-2 text-danger">({failed} failed)</span>
              ) : null}
            </div>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${progress ? pct : 0}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-fg-subtle">
            {progress
              ? `Classifier: ${run?.classifierModel ?? "claude-haiku-4-5"} · 4 parallel requests`
              : "Spawning worker and dispatching first batch…"}
          </div>
          {events.length > 0 ? (
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-border-muted pt-2 font-mono text-[11px]">
              {events
                .slice()
                .reverse()
                .map((ev, i) => (
                  <li
                    key={`${ev.index}-${i}`}
                    className="flex items-baseline gap-2"
                  >
                    <span className="w-8 shrink-0 text-fg-subtle">
                      #{ev.index + 1}
                    </span>
                    {ev.error ? (
                      <span className="shrink-0 text-danger">error</span>
                    ) : (
                      <span className="shrink-0 text-violet">{ev.label}</span>
                    )}
                    <span className="truncate text-fg-muted">
                      {ev.error ?? ev.promptPreview}
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {run ? (
        <div className="space-y-4">
          <Alert variant="info" className="!py-2 text-xs">
            Counterfactual output tokens are scaled by tier-to-tier ratios (e.g.
            Haiku ≈ 0.6× Sonnet output). Ratios are seed estimates pending a
            benchmark — numbers are calibrated but still directional.
          </Alert>
          <RoutingSummary summary={run.summary} />
          <div className="text-xs text-fg-subtle">
            Last run{" "}
            <span suppressHydrationWarning>
              {new Date(run.completedAt).toLocaleString()}
            </span>
          </div>
          <RoutingTurnsTable turns={run.turns} />
        </div>
      ) : null}
    </section>
  );
}
