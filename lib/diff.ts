export const DIFF_TOOLS = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);

export function isDiffTool(name: string): boolean {
  return DIFF_TOOLS.has(name);
}

interface EditInputShape {
  file_path?: string;
  old_string?: string;
  new_string?: string;
  edits?: Array<{ old_string?: string; new_string?: string }>;
  content?: string;
}

export interface EditPair {
  oldStr: string;
  newStr: string;
}

export function pairsForTool(toolName: string, input: unknown): EditPair[] {
  const shape = (input as EditInputShape | null) ?? {};
  if (toolName === "Edit" || toolName === "NotebookEdit") {
    return [{ oldStr: shape.old_string ?? "", newStr: shape.new_string ?? "" }];
  }
  if (toolName === "MultiEdit") {
    const edits = shape.edits ?? [];
    return edits.map((e) => ({
      oldStr: e.old_string ?? "",
      newStr: e.new_string ?? "",
    }));
  }
  if (toolName === "Write") {
    return [{ oldStr: "", newStr: shape.content ?? "" }];
  }
  return [];
}

export function filePathFor(input: unknown): string {
  const shape = (input as EditInputShape | null) ?? {};
  return shape.file_path ?? "(unknown file)";
}

export interface DiffLine {
  kind: "context" | "add" | "remove";
  line: string;
}

export function lcsDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      out.push({ kind: "context", line: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "remove", line: oldLines[i] });
      i++;
    } else {
      out.push({ kind: "add", line: newLines[j] });
      j++;
    }
  }
  while (i < m) out.push({ kind: "remove", line: oldLines[i++] });
  while (j < n) out.push({ kind: "add", line: newLines[j++] });
  return out;
}

export interface DiffStats {
  added: number;
  removed: number;
  context: number;
}

export function diffsForTool(toolName: string, input: unknown): DiffLine[][] {
  const pairs = pairsForTool(toolName, input);
  return pairs.map((p) => {
    const oldLines = p.oldStr === "" ? [] : p.oldStr.split("\n");
    const newLines = p.newStr === "" ? [] : p.newStr.split("\n");
    return lcsDiff(oldLines, newLines);
  });
}

export function statsFromDiffs(diffs: DiffLine[][]): DiffStats {
  let added = 0;
  let removed = 0;
  let context = 0;
  for (const diff of diffs) {
    for (const entry of diff) {
      if (entry.kind === "add") added++;
      else if (entry.kind === "remove") removed++;
      else context++;
    }
  }
  return { added, removed, context };
}

export function statsForTool(toolName: string, input: unknown): DiffStats {
  return statsFromDiffs(diffsForTool(toolName, input));
}
