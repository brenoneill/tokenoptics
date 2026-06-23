import { UserIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { Badge } from "@/components/ui/Badge";
import {
  KIRO_CREDIT_RATE_USD,
  formatCredits,
  formatTokens,
  formatUSD,
} from "@/lib/pricing";
import type { Message } from "@/lib/types";

import { TextBlock } from "./TextBlock";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolUseBlock } from "./ToolUseBlock";
import { ToolResultBlock } from "./ToolResultBlock";

interface Props {
  message: Message;
  hideText?: boolean;
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBlock({ message, hideText = false }: Props) {
  const isUser = message.role === "user";
  const Icon = isUser ? UserIcon : SparklesIcon;
  // A defined credits field (even 0) marks a credit-metered turn: the Kiro
  // normalizer always sets it, token harnesses never do. Drives credit-vs-token
  // display so Kiro turns never show "in 0 · out 0".
  const credits = message.usage?.credits;
  const isCredits = typeof credits === "number";

  return (
    <article
      className="rounded-md border border-border bg-bg-subtle/40"
      aria-label={`${message.role} message`}
    >
      <header className="flex items-center gap-2 border-b border-border-muted px-4 py-2">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
            isUser
              ? "border-border bg-bg-emphasis text-fg-muted"
              : "border-accent/40 bg-accent-subtle text-accent"
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </div>
        <span className="text-xs font-medium text-fg">
          {isUser ? "User" : "Assistant"}
        </span>
        {message.model ? (
          <Badge variant="violet" mono className="ml-1">
            {message.model}
          </Badge>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          {isCredits ? (
            <Badge mono>
              {formatCredits(credits)}{" "}
              <span className="text-fg-subtle">credits</span>
            </Badge>
          ) : message.usage ? (
            <Badge mono>
              <span className="text-fg-subtle">in</span>{" "}
              {formatTokens(message.usage.inputTokens)}
              <span className="text-fg-subtle">·out</span>{" "}
              {formatTokens(message.usage.outputTokens)}
            </Badge>
          ) : null}
          {typeof message.cost === "number" && message.cost > 0 ? (
            <Badge variant="accent" mono>
              <span
                title={
                  isCredits
                    ? `${formatCredits(credits)} credits × $${KIRO_CREDIT_RATE_USD.overage}/credit`
                    : undefined
                }
              >
                {formatUSD(message.cost)}
              </span>
            </Badge>
          ) : null}
          <span
            className="font-mono text-[11px] text-fg-subtle"
            suppressHydrationWarning
          >
            {formatTime(message.timestamp)}
          </span>
        </span>
      </header>

      <div className="space-y-3 px-4 py-3">
        {message.blocks.map((block, i) => {
          switch (block.kind) {
            case "text":
              if (hideText) return null;
              return <TextBlock key={i} text={block.text} />;
            case "thinking":
              return <ThinkingBlock key={i} text={block.text} />;
            case "tool_use":
              return (
                <ToolUseBlock key={i} name={block.name} input={block.input} />
              );
            case "tool_result":
              return (
                <ToolResultBlock
                  key={i}
                  toolName={block.toolName}
                  isError={block.isError}
                  charCount={block.charCount}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    </article>
  );
}
