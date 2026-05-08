import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

interface Props {
  name: string;
  input: unknown;
}

function summarizeInput(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input === "string") return input;
  if (typeof input !== "object") return String(input);

  const obj = input as Record<string, unknown>;
  // Common Claude Code tool inputs to highlight inline.
  for (const key of ["command", "file_path", "query", "path", "url", "pattern", "description"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return `${key}: ${value}`;
    }
  }
  try {
    const compact = JSON.stringify(obj);
    return compact.length > 140 ? compact.slice(0, 137) + "…" : compact;
  } catch {
    return "";
  }
}

export function ToolUseBlock({ name, input }: Props) {
  const summary = summarizeInput(input);
  return (
    <div className="rounded-md border border-border-muted bg-bg-subtle/60">
      <div className="flex items-center gap-2 border-b border-border-muted px-3 py-2 text-xs">
        <WrenchScrewdriverIcon className="h-3.5 w-3.5 text-accent" aria-hidden />
        <span className="font-mono uppercase tracking-wider text-fg-muted">
          tool_use
        </span>
        <span className="font-mono text-fg">{name}</span>
      </div>
      {summary ? (
        <div className="overflow-x-auto px-3 py-2">
          <pre className="font-mono text-xs text-fg-muted">{summary}</pre>
        </div>
      ) : null}
    </div>
  );
}
