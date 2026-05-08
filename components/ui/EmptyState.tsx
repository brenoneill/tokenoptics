import type { ComponentType, ReactNode, SVGProps } from "react";

interface EmptyStateProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-bg-subtle/30 px-6 py-16 text-center ${className}`}
    >
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg-emphasis">
          <Icon className="h-6 w-6 text-fg-muted" aria-hidden />
        </div>
      ) : null}
      <h3 className="text-sm font-medium text-fg">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
