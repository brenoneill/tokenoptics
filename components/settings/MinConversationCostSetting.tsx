"use client";

import { useEffect, useState } from "react";

import {
  setMinConversationCost,
  useMinConversationCost,
} from "@/lib/preferences/minConversationCost";

export function MinConversationCostSetting() {
  const stored = useMinConversationCost();
  const [draft, setDraft] = useState<string>(stored === null ? "" : String(stored));

  useEffect(() => {
    setDraft(stored === null ? "" : String(stored));
  }, [stored]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setMinConversationCost(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      setMinConversationCost(null);
      setDraft("");
      return;
    }
    setMinConversationCost(n);
  };

  return (
    <div className="flex items-start justify-between gap-6 rounded-md border border-border bg-bg-subtle/40 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">
          Hide low-cost conversations
        </div>
        <p className="mt-1 text-xs text-fg-muted">
          Hide conversations whose total cost is below this threshold. Leave
          empty to show all.
        </p>
      </div>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-fg-subtle"
          aria-hidden
        >
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Minimum conversation cost"
          placeholder="0.00"
          className="w-28 rounded-md border border-border bg-bg-subtle py-1.5 pl-5 pr-2 text-sm text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
    </div>
  );
}
