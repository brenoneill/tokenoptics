<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Project rules for AI agents

The Next.js warning above is the most common foot-gun. The rules below are the rest — project-specific constraints that aren't obvious from a quick read of the files. Keep this list honest: when a rule stops being true, update it in the same PR.

## 1. There is no server

[`next.config.ts`](next.config.ts) sets `output: "export"`. The whole app builds to static HTML/JS and runs entirely in the browser. That means:

- No API routes, route handlers, or server actions.
- No async `cookies()` / `headers()` / `draftMode()`.
- No middleware, no `revalidate`, no ISR.
- No server-side redirects — use `useRouter().replace()` inside a `useEffect` (see [`app/page.tsx`](app/page.tsx)).
- Layouts can stay server components (they're inert wrappers); pages with hooks or browser APIs need `"use client"`.

If a feature seems to need a server, the answer is almost always "do it in a Web Worker" — see rule 4.

## 2. Privacy is an invariant, not a guideline

The product's pitch is that user transcripts never leave the machine. A change that violates that is a P0 bug regardless of how convenient the feature is.

- No transcript content, prompt text, token counts, costs, project names, or session IDs may be sent to any network endpoint.
- The only network call from a user's browser is Vercel Analytics, which receives anonymised pageviews only — see [`app/layout.tsx`](app/layout.tsx).
- Persistent storage is **IndexedDB only** (via Dexie). No `localStorage`, no cookies, no remote sync.

When adding any feature that touches user data, ask: does this open a new network path? If yes, redesign before writing code.

## 3. Folder access is via the File System Access API (Chromium only)

Users mount their `~/.claude/projects` folder via `showDirectoryPicker` ([`components/connect/FolderConnect.tsx`](components/connect/FolderConnect.tsx)). The `FileSystemDirectoryHandle` is persisted in IndexedDB so mounts survive reloads, though the browser re-prompts for permission each session.

The API is Chromium-only — Firefox and Safari don't ship it. Don't add features that depend on `showDirectoryPicker` without keeping the existing unsupported-browser fallback intact.

## 4. Heavy work goes in the Web Worker

Sync (folder walk → JSONL parse → IndexedDB write) and efficiency analysis run in [`lib/storage/browser/worker.ts`](lib/storage/browser/worker.ts), not on the main thread. Any new work that's CPU-heavy or iterates over every message in a conversation should follow the same pattern. UI components kick off jobs and read results — they don't do the work themselves.

## 5. Harnesses are the extension point for new sources

Today only `claudeCodeHarness` exists ([`lib/harnesses/claudeCode.ts`](lib/harnesses/claudeCode.ts)), but the architecture is built for more (Codex, Cursor, etc.). To add a source, implement the `Harness` interface in [`lib/harnesses/types.ts`](lib/harnesses/types.ts) and register it in [`lib/harnesses/index.ts`](lib/harnesses/index.ts). Don't bypass the harness layer by special-casing source-specific logic in components or the worker.

## 6. Storage: composite Dexie keys are lexicographic

Conversations are keyed by `(harnessId, projectId, sessionId)`. A `between()` query that pins `projectId` and `sessionId` while leaving `harnessId` open will not give you "this session, any harness" — Dexie compound ranges are lexicographic. When you don't know the harness, iterate `HARNESSES` and call `db.conversations.get(sessionKey(...))` per harness. See [`lib/storage/browser/store.ts`](lib/storage/browser/store.ts) and [`lib/storage/browser/worker.ts`](lib/storage/browser/worker.ts) for the existing pattern; copy it rather than inventing a new lookup.

## 7. Pricing is centralized — never inline model rates

All per-model token prices live in [`lib/pricing.ts`](lib/pricing.ts). Cost computation goes through `pricingForModel()` and `costForUsage()`. Two reasons:

- Model IDs in the wild include date suffixes (`claude-opus-4-7-20260101`) that `pricingForModel()` strips for you.
- Unknown models fall back to Sonnet pricing with a warning, so the UI never crashes on a new model.

If you add a model, add it to `PRICING`. If pricing is wrong somewhere, fix it in `pricing.ts` — not at the call site.

## 8. Don't drop "empty" thinking blocks during normalization

In [`lib/normalize.ts`](lib/normalize.ts), thinking blocks parsed from stored transcripts often have an empty `text` field — only the signature survives the round-trip. The block's *presence* is still the signal that thinking happened. Filtering by `text.length > 0` will silently drop thinking-only assistant turns and break chunk counts. The code has an inline comment saying the same; don't "clean it up."

## 9. Sync skips files by mtime

[`lib/storage/browser/sync.ts`](lib/storage/browser/sync.ts) treats the file's `mtimeMs` as a cache key — if it matches the stored row, the session is not re-parsed. This is safe because Claude Code only ever appends to its session files. If you change the parser, the analyzer, or anything else that makes existing rows stale, you must invalidate them explicitly (delete the row or bump `mtimeMs` to 0). Don't rely on mtime alone to pick up your code change.

## 10. UI tokens

The theme is dark-only (`color-scheme: dark`). Colors are CSS variables defined in `:root` in [`app/globals.css`](app/globals.css) and exposed to Tailwind via `@theme inline`. Use the variable-backed utilities (`bg-bg`, `text-fg`, `text-fg-muted`, `text-violet`, `border-border-muted`, etc.) instead of hex literals, and don't add a light-mode branch.
