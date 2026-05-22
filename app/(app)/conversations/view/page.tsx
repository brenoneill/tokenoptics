"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownTrayIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageShell";
import { StickyHeader } from "@/components/ui/StickyHeader";
import { CacheRecommendations } from "@/components/analyze/CacheRecommendations";
import { CacheSummary } from "@/components/analyze/CacheSummary";
import { CacheTrajectory } from "@/components/analyze/CacheTrajectory";
import { RoutingAnalysisPanel } from "@/components/analyze/RoutingAnalysisPanel";
import { ConversationDetailSkeleton } from "@/components/conversation/ConversationDetailSkeleton";
import { ConversationView } from "@/components/conversation/ConversationView";
import { ExportDialog } from "@/components/conversation/ExportDialog";
import { getApiKey } from "@/lib/analyze/anthropic";
import { computeCacheReport } from "@/lib/analyze/cache";
import { submitCacheResults, submitRoutingResults } from "@/lib/analyze/formspree";
import type { QualityRunRecord } from "@/lib/analyze/quality";
import { extractPromptSpans, estimateClassifierCost } from "@/lib/analyze/session";
import { getQualityRun, getRoutingRun } from "@/lib/analyze/store";
import type { RoutingRunRecord } from "@/lib/analyze/types";
import { claudeCodeHarness } from "@/lib/harnesses/claudeCode";
import type { Chunk } from "@/lib/labeling/types";
import { getBrowserConversationStore } from "@/lib/storage/browser";
import {
  runAnalyzeInWorker,
  runRoutingAnalysisInWorker,
  type RoutingProgress,
  type RoutingPromptEvent,
} from "@/lib/storage/browser/syncClient";
import type { Conversation } from "@/lib/types";

interface LoadedState {
  conversation: Conversation;
  chunks: Chunk[];
  // Precomputed once on load — routing analysis uses these for its cost
  // estimate and the disabled-state of the run button.
  promptCount: number;
  estimatedCost: number;
}

type TabId = "conversation" | "cache" | "analysis";

function genRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function ConversationDetail() {
  const params = useSearchParams();
  const projectId = params.get("p");
  const sessionId = params.get("s");
  const [state, setState] = useState<LoadedState | null | "missing">(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("conversation");
  const [exportOpen, setExportOpen] = useState(false);

  // Routing analysis state. This used to be its own /analyze page; it now
  // lives as the "Analysis" tab. The page owns the state so the tab can
  // appear (and switch into focus) the moment a run is kicked off.
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [progress, setProgress] = useState<RoutingProgress | null>(null);
  const [events, setEvents] = useState<RoutingPromptEvent[]>([]);
  const [run, setRun] = useState<RoutingRunRecord | null>(null);
  // Loaded on mount so the export can include a prior quality run if one
  // exists. Quality runs are never triggered from this page.
  const [qualityRun, setQualityRun] = useState<QualityRunRecord | null>(null);

  const reloadChunks = useCallback(async () => {
    if (!projectId || !sessionId) return;
    const store = getBrowserConversationStore();
    setState((prev) => {
      if (!prev || prev === "missing") return prev;
      // Schedule async reload but return current state synchronously.
      void (async () => {
        const fresh = await store.getChunks(projectId, sessionId, prev.conversation.messages);
        setState({ ...prev, chunks: fresh });
      })();
      return prev;
    });
  }, [projectId, sessionId]);

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
        const chunks = await store.getChunks(projectId, sessionId, conversation.messages);
        const spans = extractPromptSpans(conversation.messages);
        // Surface any prior routing run so the "Analysis" tab is shown on load.
        // The quality run, if any, is loaded purely so the export can include it.
        const [existingRun, existingQuality] = await Promise.all([
          getRoutingRun(projectId, sessionId),
          getQualityRun(projectId, sessionId),
        ]);
        if (cancelled) return;
        setState({
          conversation,
          chunks,
          promptCount: spans.length,
          estimatedCost: estimateClassifierCost(spans),
        });
        setRun(existingRun);
        setQualityRun(existingQuality);

        // Run efficiency analysis off the main thread. The worker reads
        // messages from IndexedDB, hashes them against the cached row, and
        // skips the recompute when nothing changed. Fire-and-forget — current
        // UI doesn't display results, but they're persisted for later use.
        void runAnalyzeInWorker([{ projectId, sessionId }]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, sessionId]);

  const runAnalysis = useCallback(async () => {
    if (!projectId || !sessionId) return;
    setActiveTab("analysis");
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

  const shortSession = useMemo(
    () => (sessionId ? sessionId.slice(0, 8) : "—"),
    [sessionId],
  );

  const breadcrumb = (
    <Breadcrumbs
      items={[
        { label: "Home", href: "/" },
        { label: "Conversations", href: "/conversations" },
        { label: shortSession },
      ]}
    />
  );

  if (error) {
    return (
      <div>
        {breadcrumb}
        <PageHeader title="Conversation" />
        <Alert variant="danger" title="Failed to load conversation">{error}</Alert>
      </div>
    );
  }

  if (state === null) {
    return (
      <div>
        {breadcrumb}
        <ConversationDetailSkeleton />
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div>
        {breadcrumb}
        <PageHeader title="Conversation not found" />
        <Alert variant="warn" title="No matching conversation">
          The selected conversation isn&apos;t indexed locally. Check that the
          right folder is connected on the Connect page.
        </Alert>
      </div>
    );
  }

  const { conversation, chunks, promptCount, estimatedCost } = state;
  // Routing analysis hits the Anthropic API, so its entry point only makes
  // sense when a key is configured. The cache report is pure compute over
  // usage fields — no key needed — so its tab always renders.
  const hasApiKey = getApiKey() !== null;
  const cacheReport = computeCacheReport(conversation.messages);
  // The "Analysis" tab exists once a run has been started, is in flight, or
  // failed — i.e. there is something to show beyond the run button.
  const analysisStarted = run !== null || running || runError !== null;

  const tabs: { id: TabId; label: string }[] = [
    { id: "conversation", label: "Conversation" },
    { id: "cache", label: "Cache & context" },
    ...(analysisStarted
      ? [{ id: "analysis" as const, label: "Analysis" }]
      : []),
  ];

  return (
    <div>
      {breadcrumb}
      <StickyHeader>
        <PageHeader
          title={conversation.title}
          description={
            <span className="font-mono text-xs">
              {claudeCodeHarness.decodeProjectLabel(conversation.projectId)}
            </span>
          }
          meta={
            <>
              <Badge variant="violet" mono>{conversation.primaryModel}</Badge>
              {conversation.gitBranch ? <Badge mono>{conversation.gitBranch}</Badge> : null}
              <Badge mono>
                <span className="text-fg-subtle">session</span> {shortSession}
              </Badge>
              <Badge mono>
                <span className="text-fg-subtle">messages</span> {conversation.messageCount}
              </Badge>
            </>
          }
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-bg-emphasis hover:text-fg"
              >
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
                Export
              </button>
              {/*
                The "Analyze routing" button is NEVER shipped to production.
                It's a personal experiment — it calls the Anthropic API with
                the user's own key and submits anonymous aggregate stats to
                Formspree (see lib/analyze/formspree.ts). It only renders when
                a local NEXT_PUBLIC_ANTHROPIC_API_KEY is present (hasApiKey),
                so it cannot appear in the public Vercel deployment.
              */}
              {hasApiKey && !analysisStarted ? (
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={promptCount === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-violet/40 bg-violet-subtle px-3 py-2 text-sm font-medium text-violet transition-colors hover:bg-violet/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SparklesIcon className="h-4 w-4" aria-hidden />
                  Analyze routing
                </button>
              ) : null}
            </div>
          }
        />
        <nav
          role="tablist"
          aria-label="Conversation views"
          className="-mt-2 flex gap-1 border-b border-border-muted"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-violet text-violet"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </StickyHeader>

      <div className="mt-6">
        {activeTab === "conversation" ? (
          <ConversationView
            projectId={conversation.projectId}
            sessionId={conversation.sessionId}
            messages={conversation.messages}
            chunks={chunks}
            onChunksChanged={reloadChunks}
          />
        ) : null}

        {activeTab === "cache" ? (
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-medium text-fg">Cache &amp; context</h2>
              <p className="mt-1 text-sm text-fg-muted">
                How much of this session&apos;s cost went to re-processing the
                conversation&apos;s own history. Pure compute over usage fields
                — no API key needed.
              </p>
            </div>
            <div className="space-y-4">
              <CacheSummary report={cacheReport} />
              <CacheTrajectory report={cacheReport} />
              <CacheRecommendations recommendations={cacheReport.recommendations} />
            </div>
          </section>
        ) : null}

        {activeTab === "analysis" ? (
          <RoutingAnalysisPanel
            hasApiKey={hasApiKey}
            promptCount={promptCount}
            estimatedCost={estimatedCost}
            running={running}
            runError={runError}
            progress={progress}
            events={events}
            run={run}
            onRun={runAnalysis}
          />
        ) : null}
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        conversation={conversation}
        chunks={chunks}
        cacheReport={cacheReport}
        routingRun={run}
        qualityRun={qualityRun}
      />
    </div>
  );
}

export default function ConversationDetailPage() {
  // useSearchParams() requires a Suspense boundary in Next 16 client routes.
  return (
    <Suspense fallback={null}>
      <ConversationDetail />
    </Suspense>
  );
}
