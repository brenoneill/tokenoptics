"use client";

import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

export function DemoFrame({ children, className }: Props) {
  const onClickCapture = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div onClickCapture={onClickCapture} className={className}>
      {children}
    </div>
  );
}
