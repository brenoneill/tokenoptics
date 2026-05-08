import type { ContentBlock, Message } from "../types";

export const DIFF_TOOLS = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);

export interface DiffStats {
  editsCount: number;
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
  filesAffected: number;
}

interface EditInputShape {
  file_path?: string;
  old_string?: string;
  new_string?: string;
  edits?: Array<{ old_string?: string; new_string?: string }>;
  content?: string;
  notebook_path?: string;
}

function countLines(s: string | undefined): number {
  if (!s) return 0;
  return s.split("\n").length;
}

interface PerEdit {
  oldStr: string;
  newStr: string;
}

function pairsFor(toolName: string, input: EditInputShape): PerEdit[] {
  if (toolName === "Edit") {
    return [{ oldStr: input.old_string ?? "", newStr: input.new_string ?? "" }];
  }
  if (toolName === "NotebookEdit") {
    return [{ oldStr: input.old_string ?? "", newStr: input.new_string ?? "" }];
  }
  if (toolName === "MultiEdit") {
    return (input.edits ?? []).map((e) => ({
      oldStr: e.old_string ?? "",
      newStr: e.new_string ?? "",
    }));
  }
  if (toolName === "Write") {
    return [{ oldStr: "", newStr: input.content ?? "" }];
  }
  return [];
}

function pathFor(toolName: string, input: EditInputShape): string | undefined {
  if (toolName === "NotebookEdit") return input.notebook_path ?? input.file_path;
  return input.file_path;
}

export const ZERO_DIFF_STATS: DiffStats = {
  editsCount: 0,
  linesAdded: 0,
  linesRemoved: 0,
  linesChanged: 0,
  filesAffected: 0,
};

export function computeDiffStatsFromBlocks(
  blocks: Iterable<ContentBlock>,
  files: Set<string>,
): Pick<DiffStats, "editsCount" | "linesAdded" | "linesRemoved"> {
  let editsCount = 0;
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const block of blocks) {
    if (block.kind !== "tool_use") continue;
    if (!DIFF_TOOLS.has(block.name)) continue;
    const input = (block.input ?? {}) as EditInputShape;
    const filePath = pathFor(block.name, input);
    if (filePath) files.add(filePath);
    for (const pair of pairsFor(block.name, input)) {
      editsCount += 1;
      linesAdded += countLines(pair.newStr);
      linesRemoved += countLines(pair.oldStr);
    }
  }

  return { editsCount, linesAdded, linesRemoved };
}

export function computeDiffStatsForSpan(messages: Iterable<Message>): DiffStats {
  const files = new Set<string>();
  let editsCount = 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const stats = computeDiffStatsFromBlocks(msg.blocks, files);
    editsCount += stats.editsCount;
    linesAdded += stats.linesAdded;
    linesRemoved += stats.linesRemoved;
  }
  return {
    editsCount,
    linesAdded,
    linesRemoved,
    linesChanged: linesAdded + linesRemoved,
    filesAffected: files.size,
  };
}
