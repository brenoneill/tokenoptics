"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getDexie } from "@/lib/storage/browser/db";
import { runSyncInWorker } from "@/lib/storage/browser/syncClient";

const STALE_MS = 24 * 60 * 60 * 1000;

type State =
  | { phase: "idle" }
  | { phase: "syncing" }
  | { phase: "done" }
  | { phase: "needs-permission"; harnessIds: string[] }
  | { phase: "error"; message: string };

export function AutoSyncBanner() {
  const [state, setState] = useState<State>({ phase: "idle" });

  useEffect(() => {
    async function check() {
      try {
        const db = getDexie();
        const rows = await db.mounts.toArray();
        if (rows.length === 0) return;

        const now = Date.now();
        const stale = rows.filter((r) => {
          if (!r.lastSyncedAt) return false;
          return now - new Date(r.lastSyncedAt).getTime() > STALE_MS;
        });
        if (stale.length === 0) return;

        const withPerm = await Promise.all(
          stale.map(async (r) => ({
            harnessId: r.harnessId,
            handle: r.handle,
            perm: await r.handle.queryPermission({ mode: "read" }),
          })),
        );

        const granted = withPerm.filter((r) => r.perm === "granted");
        const needsPrompt = withPerm.filter((r) => r.perm !== "granted");

        if (granted.length > 0) {
          setState({ phase: "syncing" });
          await runSyncInWorker(
            granted.map((r) => ({ harnessId: r.harnessId, handle: r.handle })),
            () => {},
          );
        }

        if (needsPrompt.length > 0) {
          setState({ phase: "needs-permission", harnessIds: needsPrompt.map((r) => r.harnessId) });
        } else if (granted.length > 0) {
          setState({ phase: "done" });
          setTimeout(() => location.reload(), 1500);
        }
      } catch {
        // Silent — don't surface background-check errors to the user
      }
    }

    void check();
  }, []);

  const handleSyncNow = useCallback(async () => {
    if (state.phase !== "needs-permission") return;
    const { harnessIds } = state;
    try {
      const db = getDexie();
      const permitted: Array<{ harnessId: string; handle: FileSystemDirectoryHandle }> = [];
      for (const harnessId of harnessIds) {
        const row = await db.mounts.get(harnessId);
        if (!row) continue;
        const perm = await row.handle.requestPermission({ mode: "read" });
        if (perm === "granted") permitted.push({ harnessId, handle: row.handle });
      }
      if (permitted.length === 0) {
        setState({ phase: "idle" });
        return;
      }
      setState({ phase: "syncing" });
      const result = await runSyncInWorker(permitted, () => {});
      const firstError = Object.values(result.errors)[0];
      if (firstError) {
        setState({ phase: "error", message: firstError });
        return;
      }
      setState({ phase: "done" });
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : "Sync failed" });
    }
  }, [state]);

  if (state.phase === "idle") return null;

  if (state.phase === "syncing") {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-bg-subtle px-8 py-1.5 text-xs text-fg-muted">
        <ArrowPathIcon className="h-3 w-3 animate-spin" aria-hidden />
        Syncing conversations…
      </div>
    );
  }

  if (state.phase === "done") {
    return (
      <div className="border-b border-border bg-bg-subtle px-8 py-1.5 text-xs text-fg-muted">
        Sync complete
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border bg-bg-subtle px-8 py-1.5 text-xs">
        <span className="text-danger">{state.message}</span>
        <button
          type="button"
          onClick={() => setState({ phase: "idle" })}
          aria-label="Dismiss"
          className="rounded-md p-0.5 text-fg-muted hover:text-fg"
        >
          <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  // needs-permission
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-bg-subtle px-8 py-1.5 text-xs">
      <span className="text-fg-muted">
        You haven&rsquo;t synced in over a day — new conversations may be missing.
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSyncNow()}
          className="inline-flex items-center gap-1 rounded-md border border-accent bg-accent/10 px-2.5 py-1 font-medium text-accent hover:bg-accent/20"
        >
          <ArrowPathIcon className="h-3 w-3" aria-hidden />
          Sync now
        </button>
        <button
          type="button"
          onClick={() => setState({ phase: "idle" })}
          aria-label="Dismiss"
          className="rounded-md p-0.5 text-fg-muted hover:text-fg"
        >
          <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
