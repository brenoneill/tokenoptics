import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
}

export function Card({ children, className = "", as: Tag = "div" }: CardProps) {
  return (
    <Tag
      className={`rounded-md border border-border bg-bg-subtle/60 backdrop-blur-sm ${className}`}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, right, className = "" }: CardHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-border-muted px-4 py-3 ${className}`}
    >
      <div className="min-w-0 flex-1">
        {title ? <div className="text-sm font-medium text-fg">{title}</div> : null}
        {subtitle ? (
          <div className="mt-0.5 text-xs text-fg-muted">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`px-4 py-3 ${className}`}>{children}</div>;
}
