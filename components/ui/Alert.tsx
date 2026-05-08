import type { ReactNode } from "react";
import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

type Variant = "info" | "warn" | "danger" | "success";

const VARIANTS: Record<
  Variant,
  { wrap: string; icon: typeof InformationCircleIcon; iconClass: string }
> = {
  info:    { wrap: "border-accent/30 bg-accent-subtle text-fg",    icon: InformationCircleIcon,    iconClass: "text-accent" },
  warn:    { wrap: "border-warn/30 bg-warn-subtle text-fg",        icon: ExclamationTriangleIcon, iconClass: "text-warn" },
  danger:  { wrap: "border-danger/30 bg-danger-subtle text-fg",    icon: XCircleIcon,             iconClass: "text-danger" },
  success: { wrap: "border-success/30 bg-success-subtle text-fg",  icon: CheckCircleIcon,         iconClass: "text-success" },
};

interface AlertProps {
  variant?: Variant;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Alert({ variant = "info", title, children, className = "" }: AlertProps) {
  const { wrap, icon: Icon, iconClass } = VARIANTS[variant];
  return (
    <div className={`flex items-start gap-3 rounded-md border px-4 py-3 ${wrap} ${className}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        {title ? <div className="font-medium">{title}</div> : null}
        {children ? <div className={title ? "mt-1 text-fg-muted" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}
