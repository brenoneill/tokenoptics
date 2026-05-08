"use client";

import {
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import { useState } from "react";

import { ConversationCard } from "@/components/conversation/ConversationCard";
import { StatBar } from "@/components/conversation/StatBar";
import { DemoFrame } from "@/components/landing/DemoFrame";
import { formatTokens, formatUSD } from "@/lib/pricing";
import {
  branchDemoBranch,
  branchDemoConversations,
  featuredConversation,
  featuredProject,
  mockFeaturedScopeStats,
} from "@/lib/mock/landingFixtures";
import type { ConversationSummary } from "@/lib/types";

type Level = "project" | "branch" | "conversation";

interface LevelMeta {
  id: Level;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  eyebrow: string;
  title: string;
  lede: string;
}

const LEVELS: LevelMeta[] = [
  {
    id: "project",
    label: "Project",
    icon: FolderIcon,
    eyebrow: "project level",
    title: "Where is your spend actually going?",
    lede: "Roll up every branch and session inside a project to see the real total — and which projects are quietly burning through your budget.",
  },
  {
    id: "branch",
    label: "Branch",
    icon: CodeBracketIcon,
    eyebrow: "branch level",
    title: "See what a feature actually cost.",
    lede: "Filter by git branch and watch the spend roll up across every Claude Code session you ran while shipping it.",
  },
  {
    id: "conversation",
    label: "Conversation",
    icon: ChatBubbleLeftRightIcon,
    eyebrow: "conversation level",
    title: "Every session, fully accounted for.",
    lede: "Cost, tokens, cache reads, duration, lines changed — all derived from a single Claude Code transcript on disk.",
  },
];

export function LevelDemo() {
  const [level, setLevel] = useState<Level>("branch");
  const meta = LEVELS.find((l) => l.id === level)!;

  return (
    <section className="space-y-8">
      <div className="max-w-2xl">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet">
          one dataset, three lenses
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
          Filter by project, branch, or single session.
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          The same on-disk transcripts, sliced at the level you care about.
          Click a chip to switch lenses.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Analysis level"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-subtle/60 p-1"
      >
        {LEVELS.map((l) => {
          const active = level === l.id;
          const Icon = l.icon;
          return (
            <button
              key={l.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setLevel(l.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-bg shadow-sm"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {l.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet">
          {meta.eyebrow}
        </div>
        <h3 className="text-2xl font-semibold tracking-tight text-fg">
          {meta.title}
        </h3>
        <p className="max-w-2xl text-sm text-fg-muted">{meta.lede}</p>
      </div>

      <DemoFrame>
        {level === "conversation" ? <ConversationView /> : null}
        {level === "branch" ? <BranchView /> : null}
        {level === "project" ? <ProjectView /> : null}
      </DemoFrame>
    </section>
  );
}

function ConversationView() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px),1fr] lg:items-start">
      <ConversationCard conversation={featuredConversation} hasChunks />
      <StatBar scopeLabel="Conversation" stats={mockFeaturedScopeStats} />
    </div>
  );
}

function BranchView() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {branchDemoConversations.map((c) => (
          <ConversationCard key={c.sessionId} conversation={c} />
        ))}
      </div>
      <TotalsStrip
        scopeLabel={branchDemoBranch}
        scopeKind="branch"
        conversations={branchDemoConversations}
      />
    </div>
  );
}

function ProjectView() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {featuredProject.conversations.map((c) => (
          <ConversationCard key={c.sessionId} conversation={c} />
        ))}
      </div>
      <TotalsStrip
        scopeLabel={featuredProject.label}
        scopeKind="project"
        conversations={featuredProject.conversations}
      />
    </div>
  );
}

function TotalsStrip({
  scopeLabel,
  scopeKind,
  conversations,
}: {
  scopeLabel: string;
  scopeKind: "branch" | "project";
  conversations: ConversationSummary[];
}) {
  const totals = conversations.reduce(
    (acc, c) => {
      acc.cost += c.totalCost;
      acc.output += c.totalOutputTokens;
      acc.input += c.totalInputTokens;
      return acc;
    },
    { cost: 0, output: 0, input: 0 },
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border border-accent/30 bg-bg-subtle/60 px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-fg-muted">
        <span className="font-mono normal-case text-fg">{scopeLabel}</span>{" "}
        · {conversations.length}{" "}
        {conversations.length === 1 ? "session" : "sessions"}
        {scopeKind === "project" ? " · project total" : ""}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <Total label="Cost" value={formatUSD(totals.cost)} accent />
        <Total label="Output" value={formatTokens(totals.output)} />
        <Total label="Input" value={formatTokens(totals.input)} />
      </div>
    </div>
  );
}

function Total({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const color = accent ? "text-accent" : "text-fg";
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs uppercase tracking-wide text-fg-muted">
        {label}
      </span>
      <span className={`font-mono text-xl ${color}`}>{value}</span>
    </div>
  );
}
