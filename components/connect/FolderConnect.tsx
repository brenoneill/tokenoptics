"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import {
  ArrowPathIcon,
  CheckIcon,
  ClipboardIcon,
  FolderOpenIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { HARNESSES } from "@/lib/harnesses";
import {
  clearMount,
  getMounts,
  setMount,
} from "@/lib/storage/browser";
import { getDexie } from "@/lib/storage/browser/db";
import { runSyncInWorker } from "@/lib/storage/browser/syncClient";
import type { SyncProgress } from "@/lib/storage/browser/sync";

interface MountState {
  harnessId: string;
  label: string;
  conversationCount: number;
}

interface ProgressState {
  harnessId: string;
  progress: SyncProgress;
}

type OS = "mac" | "windows" | "linux" | "other";

function detectOS(): OS {
  if (typeof navigator === "undefined") return "other";
  const ua = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return "other";
}

// Looks for any subfolder containing a .jsonl session file — the shape of a
// Claude Code projects directory.
async function containsJsonlInChild(handle: FileSystemDirectoryHandle): Promise<boolean> {
  for await (const [, entry] of handle.entries()) {
    if (entry.kind !== "directory") continue;
    try {
      for await (const [childName, childEntry] of entry.entries()) {
        if (childEntry.kind === "file" && childName.endsWith(".jsonl")) {
          return true;
        }
      }
    } catch {
      /* skip dirs we can't read */
    }
  }
  return false;
}

type ResolveResult =
  | { ok: true; handle: FileSystemDirectoryHandle }
  | { ok: false; message: string };

// Validates the picked folder is Claude Code's projects directory. Granting
// access to a parent folder also grants access to all descendants, so if the
// user picked `~/.claude` by mistake we transparently descend into
// `./projects` and use that handle instead — no second pick required.
async function resolveClaudeCodeFolder(
  handle: FileSystemDirectoryHandle,
): Promise<ResolveResult> {
  if (await containsJsonlInChild(handle)) return { ok: true, handle };

  try {
    const projects = await handle.getDirectoryHandle("projects");
    if (await containsJsonlInChild(projects)) {
      return { ok: true, handle: projects };
    }
  } catch {
    /* no projects subfolder */
  }

  return {
    ok: false,
    message: `"${handle.name}" doesn't look like a Claude Code projects folder. It should contain project subfolders with .jsonl session files — pick ~/.claude/projects.`,
  };
}

// Looks for .json session files directly in the folder — the shape of Kiro CLI's
// flat sessions/cli directory.
async function containsJsonInFolder(handle: FileSystemDirectoryHandle): Promise<boolean> {
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === "file" && name.endsWith(".json")) return true;
  }
  return false;
}

// Validates the picked folder is Kiro CLI's sessions/cli directory. As with
// Claude Code, access to a parent grants access to descendants, so if the user
// picked ~/.kiro (or ~/.kiro/sessions) we descend to sessions/cli for them.
async function resolveKiroCliFolder(
  handle: FileSystemDirectoryHandle,
): Promise<ResolveResult> {
  if (await containsJsonInFolder(handle)) return { ok: true, handle };

  for (const path of [["cli"], ["sessions", "cli"]]) {
    try {
      let dir = handle;
      for (const seg of path) dir = await dir.getDirectoryHandle(seg);
      if (await containsJsonInFolder(dir)) return { ok: true, handle: dir };
    } catch {
      /* path doesn't exist — try the next */
    }
  }

  return {
    ok: false,
    message: `"${handle.name}" doesn't look like a Kiro CLI sessions folder. It should contain .json session files — pick ~/.kiro/sessions/cli.`,
  };
}

function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can still select text manually */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title="Copy to clipboard"
      aria-label={copied ? "Copied" : `Copy ${path} to clipboard`}
      className="mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent-subtle px-2 py-0.5 align-middle font-mono text-sm text-fg transition-colors hover:border-accent hover:bg-accent/20"
    >
      <span>{path}</span>
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-success" aria-hidden />
      ) : (
        <ClipboardIcon className="h-3.5 w-3.5 text-accent" aria-hidden />
      )}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-muted bg-bg/40 px-3 py-4 text-center">
      <div className="font-mono text-3xl font-semibold tabular-nums text-fg">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="mx-0.5 inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-bg-emphasis px-2 py-1 font-mono text-sm font-semibold text-fg shadow-[0_2px_0_0_var(--color-border)]"
    >
      {children}
    </kbd>
  );
}

function UnsupportedBrowser() {
  const [showWhy, setShowWhy] = useState(false);
  return (
    <div className="space-y-3">
      <Alert variant="warn" title="Open tokenoptics in a Chromium browser">
        <p>
          This browser can&rsquo;t read folders from your machine.
          tokenoptics needs Chrome, Edge, Arc, Brave, or another
          Chromium-based browser to work.
        </p>
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          aria-expanded={showWhy}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-bg-emphasis px-2.5 py-1 text-xs font-medium text-fg hover:bg-bg-hover"
        >
          {showWhy ? "Hide details" : "Why?"}
        </button>
      </Alert>
      {showWhy ? (
        <Alert variant="info" title="Why a Chromium browser?">
          <div className="space-y-2">
            <p>
              tokenoptics indexes your Claude Code conversations entirely
              inside the browser tab — nothing is uploaded to a server. To do
              that, the app reads <span className="font-mono">.jsonl</span>{" "}
              session files directly from{" "}
              <span className="font-mono">~/.claude/projects</span> on your
              machine.
            </p>
            <p>
              Reading a local folder from a web page requires the{" "}
              <strong>File System Access API</strong> (
              <span className="font-mono">showDirectoryPicker</span>,{" "}
              <span className="font-mono">FileSystemDirectoryHandle</span>).
              That API is only shipped by Chromium-based browsers today —
              Firefox and Safari haven&rsquo;t implemented it, so the picker
              and the permission model it depends on simply don&rsquo;t exist
              in those browsers.
            </p>
            <p>
              Without it, there&rsquo;s no way for the app to access your
              local files without sending them somewhere — which would defeat
              the privacy guarantee. So the workaround is to open this page
              in a Chromium browser.
            </p>
          </div>
        </Alert>
      ) : null}
    </div>
  );
}

export function FolderConnect() {
  const router = useRouter();
  const [supported, setSupported] = useState(true);
  const [os, setOs] = useState<OS>("other");
  const [mounts, setMounts] = useState<MountState[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // harnessId of in-flight op
  const [connecting, setConnecting] = useState(false); // true only for initial-connect (drives the full-screen modal)
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "showDirectoryPicker" in window);
    setOs(detectOS());
    track("connect_page_viewed");
  }, []);

  const refresh = useCallback(async () => {
    const db = getDexie();
    const rows = await getMounts();
    const states: MountState[] = await Promise.all(
      rows.map(async (m) => {
        const count = await db.conversations.where("harnessId").equals(m.harnessId).count();
        return { harnessId: m.harnessId, label: m.label, conversationCount: count };
      }),
    );
    setMounts(states);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connectHarness = useCallback(
    async (harnessId: string) => {
      setError(null);
      track("connect_button_pressed", { harnessId });
      let succeeded = false;
      try {
        const picked = await window.showDirectoryPicker({ mode: "read" });
        // Set busy + connecting immediately so the modal opens for the
        // validation + sync window (validation is fast, sync can take a while).
        setBusy(harnessId);
        setConnecting(true);

        let handle = picked;
        if (harnessId === "claude-code") {
          const resolved = await resolveClaudeCodeFolder(picked);
          if (!resolved.ok) {
            setError(resolved.message);
            return;
          }
          handle = resolved.handle;
        } else if (harnessId === "kiro-cli") {
          const resolved = await resolveKiroCliFolder(picked);
          if (!resolved.ok) {
            setError(resolved.message);
            return;
          }
          handle = resolved.handle;
        }

        await setMount(harnessId, handle, handle.name);
        const result = await runSyncInWorker(
          [{ harnessId, handle }],
          (id, p) => setProgress({ harnessId: id, progress: p }),
        );
        if (result.errors[harnessId]) {
          setError(result.errors[harnessId]);
        } else {
          succeeded = true;
          track("connect_succeeded", { harnessId });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return; // user cancelled picker
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
        setConnecting(false);
        setProgress(null);
        await refresh();
        if (succeeded) router.push("/conversations");
      }
    },
    [refresh, router],
  );

  const resyncHarness = useCallback(
    async (harnessId: string) => {
      setError(null);
      try {
        const db = getDexie();
        const row = await db.mounts.get(harnessId);
        if (!row) return;
        // Re-verify permission. queryPermission/requestPermission must run on
        // the main thread (and requestPermission needs a user gesture).
        const perm = await row.handle.queryPermission({ mode: "read" });
        if (perm !== "granted") {
          const req = await row.handle.requestPermission({ mode: "read" });
          if (req !== "granted") {
            setError("Permission to read the folder was denied.");
            return;
          }
        }
        setBusy(harnessId);
        const result = await runSyncInWorker(
          [{ harnessId, handle: row.handle }],
          (id, p) => setProgress({ harnessId: id, progress: p }),
        );
        if (result.errors[harnessId]) setError(result.errors[harnessId]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
        setProgress(null);
        await refresh();
      }
    },
    [refresh],
  );

  const disconnectHarness = useCallback(
    async (harnessId: string) => {
      setError(null);
      await clearMount(harnessId);
      // Also clear the cached conversations + messages for this harness so the
      // list page doesn't show stale rows after a disconnect.
      const db = getDexie();
      await db.transaction("rw", [db.conversations, db.messages], async () => {
        const keys = (await db.conversations
          .where("harnessId")
          .equals(harnessId)
          .primaryKeys()) as string[];
        await db.conversations.bulkDelete(keys);
        for (const k of keys) {
          await db.messages.where("sessionKey").equals(k).delete();
        }
      });
      await refresh();
    },
    [refresh],
  );

  if (!supported) {
    return <UnsupportedBrowser />;
  }

  if (mounts === null) {
    return <div className="text-sm text-fg-muted">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="danger" title="Couldn't connect folder">
          {error}
        </Alert>
      ) : null}

      {mounts.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title="No folders connected"
          description={
            <>
              Tokenoptics reads the session logs already on your machine. Connect
              whichever tool(s) you use:{" "}
              <strong>Claude Code</strong> (
              <span className="font-mono">~/.claude/projects</span>) or{" "}
              <strong>Kiro CLI</strong> (
              <span className="font-mono">~/.kiro/sessions/cli</span>). See{" "}
              <strong>How to connect</strong> below for the fastest way to find
              either.
            </>
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {HARNESSES.map((h, i) => {
                const isBusy = busy === h.id;
                // First harness gets the filled accent treatment, the rest an
                // outline — equal prominence, just one visual primary.
                const primary = i === 0;
                return (
                  <button
                    key={h.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => void connectHarness(h.id)}
                    aria-busy={isBusy}
                    className={
                      primary
                        ? "inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:cursor-wait disabled:opacity-80"
                        : "inline-flex items-center gap-2 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-subtle disabled:cursor-wait disabled:opacity-80"
                    }
                  >
                    {isBusy ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <FolderOpenIcon className="h-4 w-4" aria-hidden />
                    )}
                    {isBusy ? `Connecting ${h.name}…` : `Connect ${h.name}`}
                  </button>
                );
              })}
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {mounts.map((m) => {
            const harness = HARNESSES.find((h) => h.id === m.harnessId);
            const isBusy = busy === m.harnessId;
            const showProgress = isBusy && progress?.harnessId === m.harnessId;
            return (
              <div
                key={m.harnessId}
                className="rounded-md border border-border bg-bg-subtle/40 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-fg">
                      {harness?.name ?? m.harnessId}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-fg-muted">
                      {m.label}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge mono>
                      <span className="text-fg-subtle">indexed</span>{" "}
                      {m.conversationCount}
                    </Badge>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void resyncHarness(m.harnessId)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-emphasis px-2.5 py-1 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} aria-hidden />
                      Resync
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void disconnectHarness(m.harnessId)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-fg-muted hover:text-danger disabled:opacity-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" aria-hidden />
                      Disconnect
                    </button>
                  </div>
                </div>
                {showProgress ? (
                  <div className="mt-3 font-mono text-xs text-fg-muted">
                    scanned {progress.progress.scanned} ·{" "}
                    parsed {progress.progress.parsed} ·{" "}
                    skipped {progress.progress.skipped} ·{" "}
                    removed {progress.progress.removed}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {HARNESSES.some((h) => !mounts.some((m) => m.harnessId === h.id)) ? (
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-fg-subtle">
            Available harnesses
          </div>

          <Alert variant="info" title="How to connect">
            Both folders are hidden by the OS. Click a{" "}
            <strong>Connect</strong> button below to open the picker, then jump
            straight to the right folder:
            <ol className="mt-2 space-y-1.5 text-fg">
              {os === "windows" ? (
                <li>
                  <strong>1.</strong> Click the address bar at the top of the
                  picker.
                </li>
              ) : os === "linux" ? (
                <li>
                  <strong>1.</strong> Press <Kbd>Ctrl</Kbd> <Kbd>L</Kbd> to open
                  the path bar.
                </li>
              ) : (
                <li>
                  <strong>1.</strong> Press <Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>G</Kbd>{" "}
                  to open &ldquo;Go to folder&rdquo;.
                </li>
              )}
              <li>
                <strong>2.</strong> Paste the path for your tool, then press{" "}
                <Kbd>↵</Kbd>:
                <ul className="mt-1.5 ml-4 space-y-1">
                  <li>
                    <span className="text-fg-subtle">Claude Code —</span>{" "}
                    <CopyPath
                      path={
                        os === "windows"
                          ? "%USERPROFILE%\\.claude\\projects"
                          : "~/.claude/projects"
                      }
                    />
                  </li>
                  <li>
                    <span className="text-fg-subtle">Kiro CLI —</span>{" "}
                    <CopyPath
                      path={
                        os === "windows"
                          ? "%USERPROFILE%\\.kiro\\sessions\\cli"
                          : "~/.kiro/sessions/cli"
                      }
                    />
                  </li>
                </ul>
              </li>
              <li>
                <strong>3.</strong> Click <strong>Select</strong>.
              </li>
            </ol>
          </Alert>

          {HARNESSES.map((h) => {
            const already = mounts.some((m) => m.harnessId === h.id);
            if (already) return null;
            const isBusy = busy === h.id;
            const showProgress = isBusy && progress?.harnessId === h.id;
            return (
              <button
                key={h.id}
                type="button"
                disabled={isBusy}
                onClick={() => void connectHarness(h.id)}
                aria-busy={isBusy}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-bg-emphasis px-4 py-3 text-left text-sm hover:bg-bg-hover disabled:cursor-wait disabled:opacity-80 disabled:hover:bg-bg-emphasis"
              >
                <div className="min-w-0">
                  <div className="font-medium text-fg">
                    {isBusy ? `Connecting ${h.name}…` : `Connect ${h.name} Folder`}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-fg-muted">
                    {showProgress
                      ? `scanned ${progress.progress.scanned} · parsed ${progress.progress.parsed} · skipped ${progress.progress.skipped}`
                      : isBusy
                        ? "Reading folder…"
                        : "Pick a folder to index"}
                  </div>
                </div>
                {isBusy ? (
                  <ArrowPathIcon
                    className="h-5 w-5 shrink-0 animate-spin text-accent"
                    aria-hidden
                  />
                ) : (
                  <FolderOpenIcon className="h-5 w-5 shrink-0 text-fg-subtle" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {connecting ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-6 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-bg-subtle p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <ArrowPathIcon
                className="h-12 w-12 animate-spin text-accent"
                aria-hidden
              />
              <h2
                id="connect-modal-title"
                className="mt-4 text-xl font-semibold text-fg"
              >
                Connecting {HARNESSES.find((h) => h.id === busy)?.name ?? "folder"}
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                Indexing conversations locally. This stays on your machine —
                you&rsquo;ll be redirected when it&rsquo;s done.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-4 gap-3">
              <Stat label="Scanned" value={progress?.progress.scanned ?? 0} />
              <Stat label="Parsed" value={progress?.progress.parsed ?? 0} />
              <Stat label="Skipped" value={progress?.progress.skipped ?? 0} />
              <Stat label="Removed" value={progress?.progress.removed ?? 0} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
