import type { Conversation } from "../types";

export interface SessionLocator {
  projectId: string;
  sessionId: string;
}

export interface DiscoveredSession extends SessionLocator {
  // Opaque path the FolderReader understands. Lets the storage layer fetch the
  // bytes later without the harness needing a Node/browser-specific path type.
  locatorPath: string[];
  mtimeMs?: number;
}

// Minimal directory + file abstraction so harnesses can describe discovery
// without depending on Node fs or the browser File System Access API directly.
export interface FolderReader {
  list(path: string[]): Promise<FolderEntry[]>;
  readFile(path: string[]): Promise<string | null>;
  stat?(path: string[]): Promise<{ mtimeMs: number } | null>;
}

export interface FolderEntry {
  name: string;
  isDirectory: boolean;
}

export interface Harness {
  id: string;
  name: string;

  // Walk the connected folder and yield every session the harness recognizes.
  discover(reader: FolderReader): AsyncIterable<DiscoveredSession>;

  // Parse a session file's raw contents. Returns null if the file doesn't
  // contain renderable content. May be async and read sibling files via the
  // optional reader — Kiro CLI splits the message stream (.jsonl) from per-turn
  // usage/credit metadata (.json), so its parser fetches the sibling file.
  // Token-based harnesses (Claude Code) ignore the reader and stay synchronous.
  parse(
    raw: string,
    locator: SessionLocator,
    reader?: FolderReader,
  ): Conversation | null | Promise<Conversation | null>;

  // Direct lookup of a known (projectId, sessionId) without walking the tree.
  // Harnesses whose layout is deterministic (e.g. Claude Code) implement this;
  // others can return null and force a discover() fallback.
  locate(reader: FolderReader, locator: SessionLocator): Promise<string[] | null>;

  // Render a projectId for display. Some harnesses encode the cwd into the
  // project folder name (Claude Code mangles "/" → "-"); others store it
  // verbatim. Default is identity.
  decodeProjectLabel(projectId: string): string;
}
