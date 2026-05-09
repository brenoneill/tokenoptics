"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageShell";
import { StickyHeader } from "@/components/ui/StickyHeader";
import { ConversationDetailSkeleton } from "@/components/conversation/ConversationDetailSkeleton";
import { ConversationView } from "@/components/conversation/ConversationView";
import { claudeCodeHarness } from "@/lib/harnesses/claudeCode";
import type { Chunk } from "@/lib/labeling/types";
import { getBrowserConversationStore } from "@/lib/storage/browser";
import { runAnalyzeInWorker } from "@/lib/storage/browser/syncClient";
import type { Conversation } from "@/lib/types";

interface LoadedState {
  conversation: Conversation;
  chunks: Chunk[];
}

function ConversationDetail() {
  const params = useSearchParams();
  const projectId = params.get("p");
  const sessionId = params.get("s");
  const [state, setState] = useState<LoadedState | null | "missing">(null);
  const [error, setError] = useState<string | null>(null);

  const reloadChunks = useCallback(async () => {
    if (!projectId || !sessionId) return;
    const store = getBrowserConversationStore();
    setState((prev) => {
      if (!prev || prev === "missing") return prev;
      // Schedule async reload but return current state synchronously.
      void (async () => {
        const fresh = await store.getChunks(projectId, sessionId, prev.conversation.messages);
        setState({ conversation: prev.conversation, chunks: fresh });
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
        if (cancelled) return;
        setState({ conversation, chunks });

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

  const { conversation, chunks } = state;

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
        />
      </StickyHeader>
      <ConversationView
        projectId={conversation.projectId}
        sessionId={conversation.sessionId}
        messages={conversation.messages}
        chunks={chunks}
        onChunksChanged={reloadChunks}
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
