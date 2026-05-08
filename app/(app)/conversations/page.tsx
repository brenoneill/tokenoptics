"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FolderOpenIcon } from "@heroicons/react/24/outline";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageShell";
import { ConversationsBrowser } from "@/components/conversation/ConversationsBrowser";
import { analysisKey } from "@/lib/labeling/keys";
import { formatUSD } from "@/lib/pricing";
import {
  getBrowserConversationStore,
  getMounts,
} from "@/lib/storage/browser";
import type { ConversationEntry } from "@/components/conversation/ConversationsBrowser";

export default function ConversationsPage() {
  const [entries, setEntries] = useState<ConversationEntry[] | null>(null);
  const [hasMount, setHasMount] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mounts = await getMounts();
        if (cancelled) return;
        if (mounts.length === 0) {
          setHasMount(false);
          setEntries([]);
          return;
        }
        setHasMount(true);
        const store = getBrowserConversationStore();
        const [conversations, sessionsWithChunks] = await Promise.all([
          store.listConversations(),
          store.getSessionsWithChunks(),
        ]);
        if (cancelled) return;
        const cardEntries: ConversationEntry[] = conversations.map((c) => ({
          conversation: c,
          hasChunks: sessionsWithChunks.has(analysisKey(c.projectId, c.sessionId)),
        }));
        setEntries(cardEntries);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (entries === null && !error) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Conversations" }]} />
        <PageHeader title="Conversations" description="Loading…" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Conversations" }]} />
        <PageHeader title="Conversations" />
        <Alert variant="danger" title="Failed to load conversations">
          {error}
        </Alert>
      </div>
    );
  }

  const safeEntries = entries ?? [];
  const totalCost = safeEntries.reduce((sum, e) => sum + e.conversation.totalCost, 0);
  const labeledCount = safeEntries.filter((e) => e.hasChunks).length;

  const pageHeader = (
    <PageHeader
      title="Conversations"
      description="Indexed locally from connected harness folders."
      meta={
        <>
          <Badge mono>
            <span className="text-fg-subtle">count</span> {safeEntries.length}
          </Badge>
          <Badge variant="accent" mono>
            <span className="text-fg-subtle">total</span> {formatUSD(totalCost)}
          </Badge>
          {labeledCount > 0 ? (
            <Badge variant="violet" mono>
              <span className="text-fg-subtle">labeled</span> {labeledCount}
            </Badge>
          ) : null}
        </>
      }
    />
  );

  if (hasMount === false) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Conversations" }]} />
        {pageHeader}
        <EmptyState
          icon={FolderOpenIcon}
          title="No folders connected"
          description="Connect a Claude Code projects folder to start indexing your conversations."
          action={
            <Link
              href="/connect"
              className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-4 py-2 text-sm text-bg hover:opacity-90"
            >
              Connect a folder
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Conversations" }]} />
      <ConversationsBrowser entries={safeEntries} header={pageHeader} />
    </div>
  );
}
