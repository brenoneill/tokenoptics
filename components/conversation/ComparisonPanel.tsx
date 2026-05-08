"use client";

import {
  CodeBracketIcon,
  CpuChipIcon,
  FolderIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { projectLabel } from "@/lib/conversation";
import { formatTokens, formatUSD } from "@/lib/pricing";
import type { ConversationSummary } from "@/lib/types";

interface Props {
  conversation: ConversationSummary;
  onRemove?: () => void;
}

export function ComparisonPanel({ conversation, onRemove }: Props) {
  return (
    <article className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-violet/30 bg-bg shadow-md">
      <header className="flex items-start justify-between gap-3 border-b border-border-muted bg-gradient-to-r from-violet-subtle/30 to-transparent px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-violet">
            {projectLabel(conversation)}
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium text-fg">
            {conversation.title}
          </h3>
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove from canvas"
            title="Remove from canvas"
            className="-m-1 rounded-md p-1 text-fg-subtle transition-colors hover:bg-bg-emphasis hover:text-danger"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <HeadlineStat label="Total cost" value={formatUSD(conversation.totalCost)} />

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Output" value={formatTokens(conversation.totalOutputTokens)} />
          <Stat label="Input" value={formatTokens(conversation.totalInputTokens)} />
          <Stat
            label="Cache read"
            value={formatTokens(conversation.totalCacheReadTokens)}
          />
          <Stat
            label="Cache write"
            value={formatTokens(conversation.totalCacheWriteTokens)}
          />
        </div>

        <div className="space-y-2 border-t border-border-muted pt-3 text-xs">
          <Meta icon={CpuChipIcon} label="Model" value={conversation.primaryModel} />
          <Meta
            icon={FolderIcon}
            label="Project"
            value={projectLabel(conversation)}
          />
          <Meta
            icon={CodeBracketIcon}
            label="Branch"
            value={conversation.gitBranch || "—"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-border-muted pt-3 text-xs">
          <Stat label="Messages" value={String(conversation.messageCount)} />
          <Stat label="Started" value={formatDate(conversation.startedAt)} />
        </div>
      </div>

      <footer className="border-t border-border-muted bg-bg-subtle/40 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">
        session {conversation.sessionId.slice(0, 8)}
      </footer>
    </article>
  );
}

function HeadlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-accent/30 bg-accent-subtle/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-2xl text-accent">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="font-mono text-sm text-fg">{value}</div>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
      <span className="w-16 shrink-0 text-fg-subtle">{label}</span>
      <span className="truncate font-mono text-fg" title={value}>
        {value}
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
