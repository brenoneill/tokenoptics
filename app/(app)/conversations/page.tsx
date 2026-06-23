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
import { ConversationsPageSkeleton } from "@/components/conversation/ConversationsPageSkeleton";
import { KiroCreditPortfolioPanel } from "@/components/analyze/KiroCreditPortfolioPanel";
import { computeCreditPortfolio } from "@/lib/analyze/creditPortfolio";
import { analysisKey } from "@/lib/labeling/keys";
import { useKiroPlan } from "@/lib/preferences/kiroPlan";
import { formatCredits, formatUSD, isCreditHarness } from "@/lib/pricing";
import {
  getBrowserConversationStore,
  getMounts,
} from "@/lib/storage/browser";
import type { ConversationEntry } from "@/components/conversation/ConversationsBrowser";

export default function ConversationsPage() {
  const kiroPlan = useKiroPlan();
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
        <ConversationsPageSkeleton />
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
  const summaries = safeEntries.map((e) => e.conversation);
  const labeledCount = safeEntries.filter((e) => e.hasChunks).length;

  // Header total must match the Kiro panel: token (Claude Code) sessions are
  // summed at their per-session cost, while Kiro sessions use the plan-aware
  // figure (flat fee + overage), NOT the marginal $0.04/credit sum — otherwise
  // the header and the credit panel would disagree.
  const tokenCost = summaries
    .filter((c) => !isCreditHarness(c.harnessId))
    .reduce((sum, c) => sum + c.totalCost, 0);
  const kiroPortfolio = computeCreditPortfolio(summaries, kiroPlan);
  const hasKiro = summaries.some((c) => isCreditHarness(c.harnessId));
  const totalCost = tokenCost + kiroPortfolio.totalCost;

  const pageHeader = (
    <PageHeader
      title="Conversations"
      description="Indexed locally from connected harness folders."
      meta={
        <>
          <Badge mono>
            <span className="text-fg-subtle">count</span> {safeEntries.length}
          </Badge>
          <Badge
            variant="accent"
            mono
            title={
              hasKiro
                ? `Token sessions at per-session cost + Kiro sessions at the ${kiroPlan} plan estimate (flat fee + overage). Matches the Kiro credit panel.`
                : "Sum of per-session cost."
            }
          >
            <span className="text-fg-subtle">total</span> {formatUSD(totalCost)}
          </Badge>
          {hasKiro ? (
            <Badge variant="sky" mono>
              <span className="text-fg-subtle">kiro</span>{" "}
              {formatCredits(kiroPortfolio.totalCredits)} cr
            </Badge>
          ) : null}
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
          description="Connect a Claude Code or Kiro CLI sessions folder to start indexing your conversations."
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
      <ConversationsBrowser
        entries={safeEntries}
        header={pageHeader}
        beforeList={<KiroCreditPortfolioPanel conversations={summaries} />}
      />
    </div>
  );
}
