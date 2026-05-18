"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SparklesIcon } from "@heroicons/react/24/outline";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageShell";
import { CacheRecommendations } from "@/components/analyze/CacheRecommendations";
import { CacheSummary } from "@/components/analyze/CacheSummary";
import { CacheTrajectory } from "@/components/analyze/CacheTrajectory";
import { QualitySummary } from "@/components/analyze/QualitySummary";
import { QualityTasksTable } from "@/components/analyze/QualityTasksTable";
import { RoutingSummary } from "@/components/analyze/RoutingSummary";
import { RoutingTurnsTable } from "@/components/analyze/RoutingTurnsTable";
import { getApiKey } from "@/lib/analyze/anthropic";
import { computeCacheReport } from "@/lib/analyze/cache";
import { submitCacheResults, submitRoutingResults } from "@/lib/analyze/formspree";
import type { QualityRunRecord } from "@/lib/analyze/quality";
import { extractPromptSpans, estimateClassifierCost } from "@/lib/analyze/session";
import { getQualityRun, getRoutingRun } from "@/lib/analyze/store";
import type { RoutingRunRecord } from "@/lib/analyze/types";
import { formatUSD } from "@/lib/pricing";
import { getBrowserConversationStore } from "@/lib/storage/browser";
import {
  runQualityAnalysisInWorker,
  runRoutingAnalysisInWorker,
  type QualityProgress,
  type QualityPromptEvent,
  type RoutingProgress,
  type RoutingPromptEvent,
} from "@/lib/storage/browser/syncClient";
import type { Conversation } from "@/lib/types";

interface PageState {
  conversation: Conversation;
  promptCount: number;
  estimatedCost: number;
  existingRun: RoutingRunRecord | null;
  existingQualityRun: QualityRunRecord | null;
}

function genRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SHOW_QUALITY: boolean = false;

function AnalyzePageInner() {
  const params = useSearchParams();
  const projectId = params.get("p");
  const sessionId = params.get("s");

  const [state, setState] = useState<PageState | null | "missing">(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [progress, setProgress] = useState<RoutingProgress | null>(null);
  const [events, setEvents] = useState<RoutingPromptEvent[]>([]);
  const [run, setRun] = useState<RoutingRunRecord | null>(null);
  const [qualityRunning, setQualityRunning] = useState(false);
  const [qualityRunError, setQualityRunError] = useState<string | null>(null);
  const [qualityProgress, setQualityProgress] = useState<QualityProgress | null>(null);
  const [qualityEvents, setQualityEvents] = useState<QualityPromptEvent[]>([]);
  const [qualityRun, setQualityRun] = useState<QualityRunRecord | null>(null);

  const hasApiKey = useMemo(() => getApiKey() !== null, []);

  useEffect(() => {
    if (!projectId || !sessionId) {
      setState("missing");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const store = getBrowserConversationStore();
        const conversation = await store.getConversation(projectId, sessionId);
        if (cancelled) return;
        if (!conversation) {
          setState("missing");
          return;
        }
        const spans = extractPromptSpans(conversation.messages);
        const estimatedCost = estimateClassifierCost(spans);
        const [existingRun, existingQualityRun] = await Promise.all([
          getRoutingRun(projectId, sessionId),
          getQualityRun(projectId, sessionId),
        ]);
        if (cancelled) return;
        setState({
          conversation,
          promptCount: spans.length,
          estimatedCost,
          existingRun,
          existingQualityRun,
        });
        setRun(existingRun);
        setQualityRun(existingQualityRun);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, sessionId]);

  const runAnalysis = useCallback(async () => {
    if (!projectId || !sessionId) return;
    setRunning(true);
    setRunError(null);
    setProgress(null);
    setEvents([]);
    console.info("[analyze] starting routing analysis", { projectId, sessionId });
    try {
      const runId = genRunId();
      const dispatchResult = await runRoutingAnalysisInWorker(
        { projectId, sessionId, runId },
        (p) => {
          setProgress(p);
          if (p.event) {
            console.info("[analyze] prompt event", p.event);
            setEvents((prev) => [...prev, p.event!].slice(-50));
          }
        },
      );
      if (dispatchResult.error) {
        console.error("[analyze] dispatch error", dispatchResult.error);
        setRunError(dispatchResult.error);
      }
      // Always refresh — partial results may have been saved alongside an error.
      const fresh = await getRoutingRun(projectId, sessionId);
      setRun(fresh);
      if (fresh && state && state !== "missing") {
        const cacheReport = computeCacheReport(state.conversation.messages);
        void submitRoutingResults(fresh, state.conversation.primaryModel);
        void submitCacheResults(cacheReport, state.conversation.primaryModel);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[analyze] worker rejected", err);
      setRunError(message);
    } finally {
      setRunning(false);
    }
  }, [projectId, sessionId, state]);

  const runQualityAnalysis = useCallback(async () => {
    if (!projectId || !sessionId) return;
    setQualityRunning(true);
    setQualityRunError(null);
    setQualityProgress(null);
    setQualityEvents([]);
    console.info("[analyze] starting quality analysis", { projectId, sessionId });
    try {
      const runId = genRunId();
      const dispatchResult = await runQualityAnalysisInWorker(
        { projectId, sessionId, runId },
        (p) => {
          setQualityProgress(p);
          if (p.event) {
            console.info("[analyze] quality event", p.event);
            setQualityEvents((prev) => [...prev, p.event!].slice(-50));
          }
        },
      );
      if (dispatchResult.error) {
        console.error("[analyze] quality dispatch error", dispatchResult.error);
        setQualityRunError(dispatchResult.error);
      }
      const fresh = await getQualityRun(projectId, sessionId);
      setQualityRun(fresh);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[analyze] quality worker rejected", err);
      setQualityRunError(message);
    } finally {
      setQualityRunning(false);
    }
  }, [projectId, sessionId]);

  const shortSession = useMemo(
    () => (sessionId ? sessionId.slice(0, 8) : "—"),
    [sessionId],
  );

  const breadcrumb = (
    <Breadcrumbs
      items={[
        { label: "Home", href: "/" },
        { label: "Conversations", href: "/conversations" },
        {
          label: shortSession,
          href:
            projectId && sessionId
              ? `/conversations/view?p=${encodeURIComponent(projectId)}&s=${encodeURIComponent(sessionId)}`
              : undefined,
        },
        { label: "Analyze" },
      ]}
    />
  );

  if (loadError) {
    return (
      <div>
        {breadcrumb}
        <PageHeader title="Analyze routing" />
        <Alert variant="danger" title="Failed to load conversation">
          {loadError}
        </Alert>
      </div>
    );
  }

  if (state === null) {
    return (
      <div>
        {breadcrumb}
        <PageHeader title="Analyze routing" description="Loading session…" />
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div>
        {breadcrumb}
        <PageHeader title="Analyze routing" />
        <Alert variant="warn" title="Pick a session">
          Open a conversation first, then click <em>Analyze routing</em> from the
          conversation view.
        </Alert>
      </div>
    );
  }

  const { conversation, promptCount, estimatedCost } = state;
  const showRun = run;
  // Cache report is pure compute over usage fields — recompute on every
  // render. The op is cheap (sub-millisecond for typical sessions); no
  // memoization needed beyond what React naturally provides.
  const cacheReport = computeCacheReport(conversation.messages);
  const completed = progress?.completed ?? 0;
  const failed = progress?.failed ?? 0;
  const total = progress?.total ?? promptCount;
  const done = completed + failed;
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;

  const showQualityRun = qualityRun;
  const qCompleted = qualityProgress?.completed ?? 0;
  const qFailed = qualityProgress?.failed ?? 0;
  const qTotal = qualityProgress?.total ?? promptCount;
  const qDone = qCompleted + qFailed;
  const qPct = qTotal > 0 ? Math.min(100, (qDone / qTotal) * 100) : 0;

  return (
    <div>
      {breadcrumb}
      <PageHeader
        title="Analyze routing"
        description={
          <span>
            Per-prompt model-routing efficiency for{" "}
            <span className="font-mono">{conversation.title}</span>
          </span>
        }
        meta={
          <>
            <Badge variant="violet" mono>
              {conversation.primaryModel}
            </Badge>
            <Badge mono>
              <span className="text-fg-subtle">prompts</span> {promptCount}
            </Badge>
            <Badge mono>
              <span className="text-fg-subtle">session</span> {shortSession}
            </Badge>
          </>
        }
        actions={
          <button
            type="button"
            onClick={runAnalysis}
            disabled={running || !hasApiKey || promptCount === 0}
            className="inline-flex items-center gap-2 rounded-md border border-violet/40 bg-violet-subtle px-3 py-2 text-sm font-medium text-violet transition-colors hover:bg-violet/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SparklesIcon className="h-4 w-4" aria-hidden />
            {running ? "Running…" : run ? "Re-run analysis" : "Run analysis"}
          </button>
        }
      />

      {!hasApiKey ? (
        <Alert variant="warn" title="Missing API key" className="mb-4">
          Set <code className="font-mono">NEXT_PUBLIC_ANTHROPIC_API_KEY</code> in{" "}
          <code className="font-mono">.env.local</code> and restart the dev server.
          The key is read directly in the browser — testing only.
        </Alert>
      ) : null}

      {runError ? (
        <Alert variant="danger" title="Analysis failed" className="mb-4">
          <div className="font-mono text-xs break-all">{runError}</div>
          <div className="mt-2 text-xs text-fg-subtle">
            Check the browser devtools console for <code className="font-mono">[analyze]</code>{" "}
            log entries with the full error.
          </div>
        </Alert>
      ) : null}

      {!run && !running && !runError ? (
        <Alert variant="info" title="No run yet" className="mb-4">
          This will send {promptCount} user prompt
          {promptCount === 1 ? "" : "s"} to the Anthropic API for classification
          (Haiku 4.5). Estimated cost: <strong>{formatUSD(estimatedCost)}</strong>.
          Per AGENTS.md rule #2, this violates the no-egress invariant — testing
          only, not for main.
        </Alert>
      ) : null}

      {running ? (
        <div className="mb-4 rounded-md border border-accent/30 bg-accent-subtle px-4 py-3">
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

      {showRun ? (
        <div className="space-y-4">
          <Alert variant="info" className="!py-2 text-xs">
            Counterfactual output tokens are scaled by tier-to-tier ratios (e.g.
            Haiku ≈ 0.6× Sonnet output). Ratios are seed estimates pending a
            benchmark — numbers are calibrated but still directional.
          </Alert>
          <RoutingSummary summary={showRun.summary} />
          <div className="text-xs text-fg-subtle">
            Last run{" "}
            <span suppressHydrationWarning>
              {new Date(showRun.completedAt).toLocaleString()}
            </span>
          </div>
          <RoutingTurnsTable turns={showRun.turns} />
        </div>
      ) : null}

      {SHOW_QUALITY ? (
      <div className="mt-10 border-t border-border-muted pt-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-fg">Prompt quality</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Detects tasks where the user added info late (file paths,
              frameworks, patterns, constraints) or reversed direction,
              causing prior assistant work to be invalidated.
            </p>
          </div>
          <button
            type="button"
            onClick={runQualityAnalysis}
            disabled={qualityRunning || !hasApiKey || promptCount === 0}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-violet/40 bg-violet-subtle px-3 py-2 text-sm font-medium text-violet transition-colors hover:bg-violet/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SparklesIcon className="h-4 w-4" aria-hidden />
            {qualityRunning
              ? "Running…"
              : qualityRun
                ? "Re-run analysis"
                : "Run analysis"}
          </button>
        </div>

        {qualityRunError ? (
          <Alert variant="danger" title="Quality analysis failed" className="mb-4">
            <div className="font-mono text-xs break-all">{qualityRunError}</div>
            <div className="mt-2 text-xs text-fg-subtle">
              Check the browser devtools console for{" "}
              <code className="font-mono">[analyze]</code> log entries with the
              full error.
            </div>
          </Alert>
        ) : null}

        {!qualityRun && !qualityRunning && !qualityRunError ? (
          <Alert variant="info" title="No run yet" className="mb-4">
            This will send {promptCount} user prompt
            {promptCount === 1 ? "" : "s"} to the Anthropic API (Haiku 4.5) for
            quality classification. Estimated cost is similar to the routing
            run — roughly <strong>{formatUSD(estimatedCost)}</strong>, since
            both use the same model and per-call shape. Same no-egress caveat
            applies.
          </Alert>
        ) : null}

        {qualityRunning ? (
          <div className="mb-4 rounded-md border border-accent/30 bg-accent-subtle px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-medium text-fg">
                Classifying prompt quality
              </div>
              <div className="font-mono text-xs text-fg-muted">
                {qDone} / {qTotal}
                {qFailed > 0 ? (
                  <span className="ml-2 text-danger">({qFailed} failed)</span>
                ) : null}
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${qualityProgress ? qPct : 0}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-fg-subtle">
              {qualityProgress
                ? `Classifier: ${qualityRun?.classifierModel ?? "claude-haiku-4-5"} · 4 parallel requests`
                : "Spawning worker and dispatching first batch…"}
            </div>
            {qualityEvents.length > 0 ? (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-border-muted pt-2 font-mono text-[11px]">
                {qualityEvents
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
                        <span className="shrink-0 text-violet">
                          {ev.relationship}
                        </span>
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

        {showQualityRun ? (
          <div className="space-y-4">
            <Alert variant="info" className="!py-2 text-xs">
              Wasted output tokens are summed from assistant messages the
              classifier flagged as invalidated by a later user reply. Scope is
              user-side info gaps only — assistant errors and natural design
              iteration are not counted.
            </Alert>
            <QualitySummary summary={showQualityRun.summary} />
            <div className="text-xs text-fg-subtle">
              Last run{" "}
              <span suppressHydrationWarning>
                {new Date(showQualityRun.completedAt).toLocaleString()}
              </span>
            </div>
            <QualityTasksTable tasks={showQualityRun.tasks} />
          </div>
        ) : null}
      </div>
      ) : null}

      <div className="mt-10 border-t border-border-muted pt-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-fg">Cache &amp; context</h2>
          <p className="mt-1 text-sm text-fg-muted">
            How much of this session&apos;s cost went to re-processing the
            conversation&apos;s own history. Pure compute over usage fields —
            no API key needed.
          </p>
        </div>
        <div className="space-y-4">
          <CacheSummary report={cacheReport} />
          <CacheTrajectory report={cacheReport} />
          <CacheRecommendations recommendations={cacheReport.recommendations} />
        </div>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzePageInner />
    </Suspense>
  );
}
