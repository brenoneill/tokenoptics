import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface Props {
  toolName?: string;
  isError: boolean;
  charCount: number;
}

function formatChars(n: number): string {
  if (n < 1000) return `${n} chars`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k chars`;
  return `${(n / 1_000_000).toFixed(2)}M chars`;
}

export function ToolResultBlock({ toolName, isError, charCount }: Props) {
  const Icon = isError ? XCircleIcon : CheckCircleIcon;
  const tone = isError
    ? "border-danger/40 bg-danger-subtle"
    : "border-border-muted bg-bg-subtle/40";
  const iconClass = isError ? "text-danger" : "text-success";

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${tone}`}
    >
      <Icon className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden />
      <span className="font-mono uppercase tracking-wider text-fg-muted">
        tool_result
      </span>
      {toolName ? (
        <span className="font-mono text-fg-muted">· {toolName}</span>
      ) : null}
      <span className="ml-auto font-mono text-fg-subtle">
        {formatChars(charCount)}
      </span>
      {isError ? (
        <span className="font-mono uppercase tracking-wider text-danger">
          error
        </span>
      ) : null}
    </div>
  );
}
