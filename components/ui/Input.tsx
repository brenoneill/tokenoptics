"use client";

import type { ComponentProps, ComponentType, SVGProps } from "react";

type Props = ComponentProps<"input"> & {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

export function Input({ icon: Icon, className = "", ...rest }: Props) {
  return (
    <div className="relative w-full">
      {Icon ? (
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
          aria-hidden
        />
      ) : null}
      <input
        {...rest}
        className={`w-full rounded-md border border-border bg-bg-subtle py-2 pr-3 text-sm text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 ${
          Icon ? "pl-9" : "pl-3"
        } ${className}`}
      />
    </div>
  );
}
