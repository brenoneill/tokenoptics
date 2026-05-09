import type { ReactNode } from "react";

type Variant =
  | "neutral"
  | "accent"
  | "success"
  | "warn"
  | "danger"
  | "violet"
  | "sky";

const VARIANTS: Record<Variant, string> = {
  neutral: "border-border bg-bg-emphasis text-fg-muted",
  accent:  "border-accent/30 bg-accent-subtle text-accent",
  success: "border-success/30 bg-success-subtle text-success",
  warn:    "border-warn/30 bg-warn-subtle text-warn",
  danger:  "border-danger/30 bg-danger-subtle text-danger",
  violet:  "border-violet/30 bg-violet-subtle text-violet",
  sky:     "border-sky/30 bg-sky-subtle text-sky",
};

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  mono?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  mono = false,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
        mono ? "font-mono" : ""
      } ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
