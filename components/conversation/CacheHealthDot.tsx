import type { CacheHealth } from "@/lib/analyze/cache";

const COLOR: Record<CacheHealth, string> = {
  good: "bg-success",
  climbing: "bg-warn",
  poor: "bg-danger",
};

const RING: Record<CacheHealth, string> = {
  good: "ring-success/30",
  climbing: "ring-warn/30",
  poor: "ring-danger/30",
};

const LABEL: Record<CacheHealth, string> = {
  good: "Cache & context: healthy",
  climbing: "Cache & context: cost per turn climbing",
  poor: "Cache & context: drift / low cache hit",
};

interface Props {
  health: CacheHealth | null;
  className?: string;
}

export function CacheHealthDot({ health, className = "" }: Props) {
  if (!health) return null;
  return (
    <span
      role="img"
      aria-label={LABEL[health]}
      title={LABEL[health]}
      className={`inline-block h-2 w-2 rounded-full ring-2 ${COLOR[health]} ${RING[health]} ${className}`}
    />
  );
}
