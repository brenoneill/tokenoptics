"use client";

import type { ComponentProps } from "react";

export type SelectOption = {
  value: string;
  label: string;
  count?: number;
};

type Props = Omit<ComponentProps<"select">, "children"> & {
  options: SelectOption[];
};

export function Select({ options, className = "", ...rest }: Props) {
  return (
    <select
      {...rest}
      className={`rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.count === undefined ? opt.label : `${opt.label} (${opt.count})`}
        </option>
      ))}
    </select>
  );
}
