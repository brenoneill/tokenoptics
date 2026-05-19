"use client";

import Link from "next/link";
import type { ComponentType, MouseEvent, SVGProps } from "react";
import {
  CheckIcon,
  ClockIcon,
  CodeBracketIcon,
  CpuChipIcon,
  FolderIcon,
  PlusIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { CacheHealthDot } from "@/components/conversation/CacheHealthDot";
import {
  addToComparison,
  isInComparison,
  removeFromComparison,
  useComparisonSelection,
} from "@/lib/comparisonCanvas/selectionStore";
import { useComparisonCanvasEnabled } from "@/lib/preferences/comparisonCanvas";
import { formatTokens, formatUSD } from "@/lib/pricing";
import { projectLabel } from "@/lib/conversation";
import type { ConversationSummary } from "@/lib/types";

interface MetaRowProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
}

function MetaRow({ icon: Icon, label, value }: MetaRowProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
      <span className="w-14 shrink-0 text-fg-subtle">{label}</span>
      <span className="truncate font-mono text-fg" title={value}>
        {value}
      </span>
    </div>
  );
}

interface Props {
  conversation: ConversationSummary;
  hasChunks?: boolean;
}

export function ConversationCard({ conversation, hasChunks = false }: Props) {
  const href = `/conversations/view?p=${encodeURIComponent(conversation.projectId)}&s=${encodeURIComponent(conversation.sessionId)}`;
  const title = conversation.title;
  const canvasEnabled = useComparisonCanvasEnabled();
  const selection = useComparisonSelection();
  const inCanvas = isInComparison(selection, conversation.projectId, conversation.sessionId);

  const onCanvasToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCanvas) {
      removeFromComparison(`${conversation.projectId}|${conversation.sessionId}`);
    } else {
      addToComparison(`${conversation.projectId}|${conversation.sessionId}`);
    }
  };

  return (
    <div className="relative h-full">
      <Link href={href} className="block h-full transition-transform hover:-translate-y-0.5">
        <Card className="flex h-full flex-col transition-colors hover:border-accent/50 hover:bg-bg-subtle">
          <CardHeader
            title={
              <span className="line-clamp-2 min-h-[2lh] text-sm font-medium text-fg">
                {title}
              </span>
            }
            right={
              <div className="flex items-center gap-1.5">
                <CacheHealthDot health={conversation.cacheHealth} />
                {hasChunks ? (
                  <Badge variant="violet" mono aria-label="Has chunks">
                    <SparklesIcon className="h-3 w-3" aria-hidden />
                  </Badge>
                ) : null}
                <Badge variant="accent" mono>
                  {formatUSD(conversation.totalCost)}
                </Badge>
              </div>
            }
          />
          <CardBody className="flex flex-1 flex-col space-y-3">
            <div className="flex flex-col gap-1.5">
              <MetaRow icon={FolderIcon} label="Project" value={projectLabel(conversation)} />
              <MetaRow icon={CpuChipIcon} label="Model" value={conversation.primaryModel} />
              <MetaRow
                icon={CodeBracketIcon}
                label="Branch"
                value={conversation.gitBranch || "—"}
              />
            </div>

            <div className="mt-auto grid grid-cols-3 gap-3 border-t border-border-muted pt-3 text-xs">
              <div>
                <div className="text-fg-subtle">Output</div>
                <div className="font-mono text-fg">
                  {formatTokens(conversation.totalOutputTokens)}
                </div>
              </div>
              <div>
                <div className="text-fg-subtle">Input</div>
                <div className="font-mono text-fg">
                  {formatTokens(conversation.totalInputTokens)}
                </div>
              </div>
              <div>
                <div className="text-fg-subtle">Messages</div>
                <div className="font-mono text-fg">{conversation.messageCount}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1 text-xs text-fg-subtle">
              <ClockIcon className="h-3 w-3" aria-hidden />
              <RelativeTime iso={conversation.endedAt} />
            </div>
          </CardBody>
        </Card>
      </Link>

      {canvasEnabled ? (
        <button
          type="button"
          onClick={onCanvasToggle}
          aria-pressed={inCanvas}
          aria-label={
            inCanvas
              ? "Remove from Comparison Canvas"
              : "Add to Comparison Canvas"
          }
          title={
            inCanvas
              ? "Remove from Comparison Canvas"
              : "Add to Comparison Canvas"
          }
          className={`absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors ${
            inCanvas
              ? "border-violet bg-violet text-bg hover:opacity-90"
              : "border-violet/40 bg-bg text-violet hover:bg-violet-subtle"
          }`}
        >
          {inCanvas ? (
            <CheckIcon className="h-4 w-4" aria-hidden />
          ) : (
            <PlusIcon className="h-4 w-4" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}
