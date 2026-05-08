import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

export interface Crumb {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: Crumb[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-fg-muted">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="rounded px-1 py-0.5 transition-colors hover:bg-bg-emphasis hover:text-fg"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`px-1 py-0.5 ${isLast ? "text-fg" : ""}`}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
            {!isLast ? (
              <ChevronRightIcon
                className="mx-1 h-3 w-3 text-fg-subtle"
                aria-hidden
              />
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
