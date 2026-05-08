import type { SVGProps } from "react";

export function LogoMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="miter"
      aria-hidden
      className={className}
      {...props}
    >
      <path d="M8 2 L16 2 L22 8 L22 16 L16 22 L8 22 L2 16 L2 8 Z" />
      <path d="M10 7 L14 7 L17 10 L17 14 L14 17 L10 17 L7 14 L7 10 Z" />
    </svg>
  );
}
