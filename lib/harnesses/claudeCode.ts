import { normalizeJsonl } from "../normalize";
import type { Conversation } from "../types";
import type {
  DiscoveredSession,
  FolderReader,
  Harness,
  SessionLocator,
} from "./types";

const SESSION_FILE_SUFFIX = ".jsonl";

function sessionIdFromFile(filename: string): string | null {
  if (!filename.endsWith(SESSION_FILE_SUFFIX)) return null;
  return filename.slice(0, -SESSION_FILE_SUFFIX.length);
}

export const claudeCodeHarness: Harness = {
  id: "claude-code",
  name: "Claude Code",

  async *discover(reader: FolderReader): AsyncGenerator<DiscoveredSession> {
    const projectEntries = await reader.list([]);
    for (const project of projectEntries) {
      if (!project.isDirectory) continue;
      const projectId = project.name;
      const sessionEntries = await reader.list([projectId]);
      for (const file of sessionEntries) {
        if (file.isDirectory) continue;
        const sessionId = sessionIdFromFile(file.name);
        if (!sessionId) continue;
        const locatorPath = [projectId, file.name];
        const stat = reader.stat ? await reader.stat(locatorPath) : null;
        yield {
          projectId,
          sessionId,
          locatorPath,
          mtimeMs: stat?.mtimeMs,
        };
      }
    }
  },

  parse(raw: string, locator: SessionLocator): Conversation | null {
    const conversation = normalizeJsonl(raw, locator);
    if (conversation.messageCount === 0) return null;
    return conversation;
  },

  async locate(_reader, locator): Promise<string[] | null> {
    return [locator.projectId, `${locator.sessionId}${SESSION_FILE_SUFFIX}`];
  },

  decodeProjectLabel(projectId: string): string {
    // Claude Code encodes the cwd by replacing "/" with "-". We don't know
    // where the original "-" characters were, so this is a best-effort
    // display-only decode.
    return projectId.startsWith("-") ? projectId.replace(/-/g, "/") : projectId;
  },
};
