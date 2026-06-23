import { normalizeKiroCli, parseKiroSessionJson } from "../normalizeKiroCli";
import type { Conversation } from "../types";
import type {
  DiscoveredSession,
  FolderReader,
  Harness,
  SessionLocator,
} from "./types";

// Kiro CLI stores sessions flat in ~/.kiro/sessions/cli/ as <uuid>.json (full
// state + usage) alongside <uuid>.jsonl (message stream). We treat the .jsonl as
// the session file (it has the renderable conversation) and read the sibling
// .json for usage/credits/model. projectId is the session's cwd — sessions are
// flat on disk, so we group by working directory the way Claude Code groups by
// project folder.

const STREAM_SUFFIX = ".jsonl";
const STATE_SUFFIX = ".json";

// Sessions with no cwd recorded are grouped under this synthetic project.
const UNKNOWN_PROJECT = "(unknown)";

function sessionIdFromStream(filename: string): string | null {
  if (!filename.endsWith(STREAM_SUFFIX)) return null;
  return filename.slice(0, -STREAM_SUFFIX.length);
}

async function readSessionJson(reader: FolderReader, sessionId: string) {
  const raw = await reader.readFile([`${sessionId}${STATE_SUFFIX}`]);
  return raw ? parseKiroSessionJson(raw) : null;
}

export const kiroCliHarness: Harness = {
  id: "kiro-cli",
  name: "Kiro CLI",

  async *discover(reader: FolderReader): AsyncGenerator<DiscoveredSession> {
    const entries = await reader.list([]);
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const sessionId = sessionIdFromStream(entry.name);
      if (!sessionId) continue;

      // projectId comes from the session's cwd, which lives in the sibling .json.
      const sessionJson = await readSessionJson(reader, sessionId);
      const projectId = sessionJson?.cwd?.trim() || UNKNOWN_PROJECT;

      const locatorPath = [entry.name];
      // Stat the .json too: it's rewritten on every turn, so it's the better
      // staleness signal than the append-only .jsonl. Use the max of both.
      const streamStat = reader.stat ? await reader.stat(locatorPath) : null;
      const stateStat = reader.stat
        ? await reader.stat([`${sessionId}${STATE_SUFFIX}`])
        : null;
      const mtimeMs = Math.max(streamStat?.mtimeMs ?? 0, stateStat?.mtimeMs ?? 0) || undefined;

      yield { projectId, sessionId, locatorPath, mtimeMs };
    }
  },

  async parse(
    raw: string,
    locator: SessionLocator,
    reader?: FolderReader,
  ): Promise<Conversation | null> {
    const sessionJson = reader
      ? await readSessionJson(reader, locator.sessionId)
      : null;

    const conversation = normalizeKiroCli({
      jsonl: raw,
      sessionJson,
      projectId: locator.projectId,
      sessionId: locator.sessionId,
    });
    if (conversation.messageCount === 0) return null;
    return conversation;
  },

  async locate(_reader, locator): Promise<string[] | null> {
    return [`${locator.sessionId}${STREAM_SUFFIX}`];
  },

  decodeProjectLabel(projectId: string): string {
    // Kiro CLI stores the cwd verbatim — already a readable path.
    return projectId;
  },
};
