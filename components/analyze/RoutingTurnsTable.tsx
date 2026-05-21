"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

import { Badge } from "@/components/ui/Badge";
import { formatUSD } from "@/lib/pricing";
import type { RoutingComparison, RoutingLabel } from "@/lib/analyze/routing";
import type { RoutingTurnRecord } from "@/lib/analyze/types";

interface Props {
  turns: RoutingTurnRecord[];
}

const LABEL_VARIANT: Record<RoutingLabel, "violet" | "accent" | "sky" | "neutral"> = {
  planning: "violet",
  implementation: "accent",
  default_implementation: "sky",
  cleanup: "neutral",
};

const COMPARISON_VARIANT: Record<
  RoutingComparison,
  { variant: "success" | "neutral" | "warn"; text: string }
> = {
  savings: { variant: "success", text: "saved" },
  aligned: { variant: "neutral", text: "aligned" },
  under_specced: { variant: "warn", text: "under-spec'd" },
};

export function RoutingTurnsTable({ turns }: Props) {
  if (turns.length === 0) {
    return (
      <div className="rounded-md border border-border bg-bg-subtle/60 px-4 py-6 text-center text-sm text-fg-muted">
        No user prompts to analyze in this session.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg-subtle/40">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border-muted bg-bg-emphasis/40 text-[10px] uppercase tracking-wider text-fg-subtle">
          <tr>
            <th className="w-8 px-3 py-2"></th>
            <th className="px-3 py-2">Prompt</th>
            <th className="px-3 py-2">Label</th>
            <th className="px-3 py-2">Actual model</th>
            <th className="px-3 py-2">Recommended</th>
            <th className="px-3 py-2 text-right">Actual</th>
            <th className="px-3 py-2 text-right">Recommended cost</th>
            <th className="px-3 py-2 text-right">Delta</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {turns.map((turn, i) => (
            <Row key={turn.userMsgUuid} turn={turn} index={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ turn, index }: { turn: RoutingTurnRecord; index: number }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDownIcon : ChevronRightIcon;
  const status = COMPARISON_VARIANT[turn.comparison];

  const delta = turn.actualCost - turn.counterfactualCost;
  const deltaSign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const deltaClass =
    turn.comparison === "savings"
      ? "text-success"
      : turn.comparison === "under_specced"
        ? "text-warn"
        : "text-fg-muted";

  return (
    <>
      <tr
        className={`border-b border-border-muted ${index % 2 === 0 ? "" : "bg-bg-subtle/30"} cursor-pointer hover:bg-bg-hover`}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-3 py-2 align-top">
          <Icon className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
        </td>
        <td className="max-w-[26rem] truncate px-3 py-2 align-top text-fg">
          {turn.promptPreview || <span className="text-fg-subtle">(empty)</span>}
        </td>
        <td className="px-3 py-2 align-top">
          <Badge variant={LABEL_VARIANT[turn.label]} mono>
            {turn.label}
          </Badge>
        </td>
        <td className="px-3 py-2 align-top font-mono text-fg-muted">
          {turn.actualModel ?? "—"}
        </td>
        <td className="px-3 py-2 align-top font-mono text-fg-muted">
          {turn.recommendedModel}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-fg">
          {formatUSD(turn.actualCost)}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-fg">
          {formatUSD(turn.counterfactualCost)}
        </td>
        <td className={`px-3 py-2 text-right align-top font-mono ${deltaClass}`}>
          {deltaSign}
          {formatUSD(Math.abs(delta))}
        </td>
        <td className="px-3 py-2 align-top">
          <Badge variant={status.variant}>{status.text}</Badge>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-border-muted bg-bg-subtle/20">
          <td colSpan={9} className="px-4 py-3">
            <div className="gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  Full prompt
                </div>
                <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-md border border-border-muted bg-bg-emphasis/30 p-3 font-mono text-[11px] text-fg">
                  {turn.promptPreview}
                  {turn.promptCharCount > turn.promptPreview.length ? "\n…" : ""}
                </pre>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle mt-2">
                  Classifier reasoning
                </div>
                <p className="mt-1 text-xs italic text-fg-muted">
                  {turn.reasoning || "(no reasoning provided)"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                  <span className="text-fg-subtle">Assistant turns</span>
                  <span className="text-right text-fg">{turn.assistantTurnCount}</span>
                  {turn.followUpReplyCount > 0 ? (
                    <>
                      <span className="text-fg-subtle">Folded-in replies</span>
                      <span
                        className="text-right text-fg"
                        title="Short user replies to an assistant question, grouped into this span — they can't be routed to a different model mid-task."
                      >
                        {turn.followUpReplyCount}
                      </span>
                    </>
                  ) : null}
                  <span className="text-fg-subtle">Tool uses</span>
                  <span className="text-right text-fg">
                    {turn.features.toolUseCount}
                    {turn.features.toolErrorCount > 0 ? (
                      <span className="ml-1 text-danger">
                        ({turn.features.toolErrorCount} err)
                      </span>
                    ) : null}
                  </span>
                  <span className="text-fg-subtle">Thinking used</span>
                  <span className="text-right text-fg">
                    {turn.features.thinkingUsed ? "yes" : "no"}
                  </span>
                  <span className="text-fg-subtle">Output chars</span>
                  <span className="text-right text-fg">
                    {turn.features.textChars.toLocaleString()}
                  </span>
                  <span className="text-fg-subtle">Input tokens</span>
                  <span className="text-right text-fg">
                    {turn.usage.inputTokens.toLocaleString()}
                  </span>
                  <span className="text-fg-subtle">Output tokens (actual)</span>
                  <span className="text-right text-fg">
                    {turn.usage.outputTokens.toLocaleString()}
                  </span>
                  <span className="text-fg-subtle">
                    Output tokens (counterfactual)
                  </span>
                  <span className="text-right text-fg">
                    {turn.counterfactualUsage.outputTokens.toLocaleString()}{" "}
                    <span className="text-fg-subtle">
                      ({turn.outputRatio.toFixed(2)}×)
                    </span>
                  </span>
                  <span className="text-fg-subtle">Cache read</span>
                  <span className="text-right text-fg">
                    {turn.usage.cacheReadTokens.toLocaleString()}
                  </span>
                  <span className="text-fg-subtle">Cache write</span>
                  <span className="text-right text-fg">
                    {(
                      turn.usage.cacheWrite5mTokens + turn.usage.cacheWrite1hTokens
                    ).toLocaleString()}
                  </span>
                </div>
                {turn.features.distinctToolNames.length > 0 ? (
                  <div className="mt-2 text-[10px] text-fg-subtle">
                    Tools:{" "}
                    <span className="font-mono text-fg-muted">
                      {turn.features.distinctToolNames.join(", ")}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
