import type { ChunkType } from "./types";

// Stable hue palette for chunk identification. Cycled by chunk ord so that
// the same chunk gets the same color across renders. Hexes are tuned for the
// GitHub-Dark surface used elsewhere — the existing semantic tokens (success,
// warn, danger, violet, accent) are not reused so chunk color never collides
// with status meaning.
export interface ChunkColor {
  readonly id: string;
  readonly dot: string;
  readonly border: string;
  readonly bg: string;
}

const PALETTE: readonly ChunkColor[] = [
  { id: "violet", dot: "#a371f7", border: "rgba(163, 113, 247, 0.55)", bg: "rgba(163, 113, 247, 0.15)" },
  { id: "cyan", dot: "#39c5cf", border: "rgba(57, 197, 207, 0.55)", bg: "rgba(57, 197, 207, 0.15)" },
  { id: "amber", dot: "#e3b341", border: "rgba(227, 179, 65, 0.55)", bg: "rgba(227, 179, 65, 0.15)" },
  { id: "emerald", dot: "#3fb950", border: "rgba(63, 185, 80, 0.55)", bg: "rgba(63, 185, 80, 0.15)" },
  { id: "pink", dot: "#f778ba", border: "rgba(247, 120, 186, 0.55)", bg: "rgba(247, 120, 186, 0.15)" },
  { id: "sky", dot: "#58a6ff", border: "rgba(88, 166, 255, 0.55)", bg: "rgba(88, 166, 255, 0.15)" },
  { id: "lime", dot: "#bef264", border: "rgba(190, 242, 100, 0.55)", bg: "rgba(190, 242, 100, 0.15)" },
  { id: "rose", dot: "#f97583", border: "rgba(249, 117, 131, 0.55)", bg: "rgba(249, 117, 131, 0.15)" },
];

export function colorForChunkIndex(index: number): ChunkColor {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]!;
}

// Tailwind text-color class for the type badge, when a type is set. Only
// meaningful types get a hue — neutral types (chore, other, missing) return
// null so callers can fall back to the default subtle color.
const TYPE_TEXT_CLASS: Partial<Record<ChunkType, string>> = {
  create: "text-success",
  refactor: "text-violet",
  bugfix: "text-warn",
  debug: "text-warn",
  explain: "text-accent",
  error_loop: "text-danger",
};

export function textClassForChunkType(
  type: ChunkType | null | undefined,
): string | null {
  if (!type) return null;
  return TYPE_TEXT_CLASS[type] ?? null;
}

// Optional surface override (border + bg) for type-driven highlighting.
// Used on the landing page only — the conversation detail page sticks with
// the rotating per-chunk palette so adjacent chunks stay distinguishable.
const TYPE_SURFACE_COLOR: Partial<Record<ChunkType, ChunkColor>> = {
  error_loop: {
    id: "danger",
    dot: "#f85149",
    border: "rgba(248, 81, 73, 0.5)",
    bg: "rgba(248, 81, 73, 0.18)",
  },
};

export function surfaceColorForChunkType(
  type: ChunkType | null | undefined,
): ChunkColor | null {
  if (!type) return null;
  return TYPE_SURFACE_COLOR[type] ?? null;
}
