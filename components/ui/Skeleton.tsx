import type { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
}

export function Skeleton({
  className = "",
  children,
  "aria-label": ariaLabel,
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      className={`animate-pulse rounded-md bg-bg-emphasis ${className}`}
    >
      {children ? <span className="sr-only">{children}</span> : null}
    </div>
  );
}

export function SkeletonText({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-3 ${className}`} />;
}

export function SkeletonBadge({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-5 w-20 rounded-full ${className}`} />;
}
