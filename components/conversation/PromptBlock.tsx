"use client";

import { UserIcon, SparklesIcon } from "@heroicons/react/24/outline";

import type { Message } from "@/lib/types";
import { TriggerBody } from "./TriggerBody";
import { useSelection } from "./SelectionContext";

export interface ChunkBadge {
  id: string;
  title: string;
  color: string;
  active: boolean;
}

interface Props {
  text: string;
  message: Message;
  trigger?: { message: Message; text: string };
  chunkBadges?: ChunkBadge[];
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function PromptBlock({ text, message, trigger, chunkBadges }: Props) {
  const selection = useSelection();
  const selectable = selection !== null;
  const checked = selectable && selection!.selected.has(message.uuid);

  return (
    <div className="space-y-2">
      {trigger ? (
        <article
          className="rounded-md border border-border-muted bg-bg-subtle/30 px-4 py-3"
          aria-label="Assistant message that prompted the user"
        >
          <header className="mb-1.5 flex items-center gap-2 text-xs">
            <SparklesIcon className="h-3.5 w-3.5 text-accent" aria-hidden />
            <span className="font-mono uppercase tracking-wider text-fg-subtle">
              assistant
            </span>
            <span
              className="ml-auto font-mono text-[11px] text-fg-subtle"
              suppressHydrationWarning
            >
              {formatTime(trigger.message.timestamp)}
            </span>
          </header>
          <TriggerBody text={trigger.text} />
        </article>
      ) : null}

      <article
        className={`flex gap-3 rounded-md border px-4 py-3 transition-colors ${
          checked
            ? "border-accent bg-accent-subtle/70"
            : "border-accent/40 bg-accent-subtle/40"
        }`}
        aria-label="User prompt"
      >
        {selectable ? (
          <label className="flex shrink-0 cursor-pointer items-start pt-0.5">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-accent"
              checked={checked}
              onChange={() => selection!.toggle(message.uuid)}
              aria-label="Select prompt"
            />
          </label>
        ) : null}
        <div className="min-w-0 flex-1">
          <header className="mb-1.5 flex items-center gap-2 text-xs">
            <UserIcon className="h-3.5 w-3.5 text-accent" aria-hidden />
            <span className="font-mono uppercase tracking-wider text-fg">
              user
            </span>
            {chunkBadges && chunkBadges.length > 0 ? (
              <span className="flex items-center gap-1" aria-label="Chunk membership">
                {chunkBadges.map((badge) => (
                  <span
                    key={badge.id}
                    className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-bg transition-transform"
                    style={{
                      backgroundColor: badge.color,
                      transform: badge.active ? "scale(1.25)" : undefined,
                    }}
                    title={badge.title}
                    aria-label={badge.title}
                  />
                ))}
              </span>
            ) : null}
            <span
              className="ml-auto font-mono text-[11px] text-fg-subtle"
              suppressHydrationWarning
            >
              {formatTime(message.timestamp)}
            </span>
          </header>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
            {text}
          </div>
        </div>
      </article>
    </div>
  );
}
