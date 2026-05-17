import type { Usage } from "../types";

export type RoutingLabel =
  | "planning"
  | "implementation"
  | "default_implementation"
  | "cleanup";

export type RoutingTier = "haiku" | "sonnet" | "opus";

export const LABEL_TO_MODEL: Record<RoutingLabel, string> = {
  planning: "claude-opus-4-6",
  implementation: "claude-sonnet-4-6",
  default_implementation: "claude-sonnet-4-6",
  cleanup: "claude-haiku-4-5",
};

export const LABEL_TO_TIER: Record<RoutingLabel, RoutingTier> = {
  planning: "opus",
  implementation: "sonnet",
  default_implementation: "sonnet",
  cleanup: "haiku",
};

export const LABEL_DESCRIPTIONS: Record<RoutingLabel, string> = {
  planning:
    "Planning, architecture, complex design decisions, security reviews — the kind of thinking that benefits from a frontier model.",
  implementation:
    "Serious implementation work: writing or reviewing real code, debugging, cross-file refactors, building features.",
  default_implementation:
    "Default coding tasks that don't clearly fall into planning or cleanup — the workhorse bucket.",
  cleanup:
    "Lint, format, single-line edits, fixing typos, renaming variables, trivial mechanical changes.",
};

export const LABEL_TRIGGERS: Record<RoutingLabel, string[]> = {
  planning: ["plan", "architect", "design system", "refactor architecture", "security review"],
  implementation: ["review", "debug", "cross-file refactor", "implement", "build feature"],
  default_implementation: [],
  cleanup: ["lint", "format", "fix typo", "rename variable"],
};

const TIER_ORDER: Record<RoutingTier, number> = { haiku: 0, sonnet: 1, opus: 2 };

export function tierForModel(model: string | undefined): RoutingTier | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.includes("haiku")) return "haiku";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("opus")) return "opus";
  return null;
}

export type RoutingComparison = "savings" | "aligned" | "under_specced";

export function compareTiers(
  actualTier: RoutingTier | null,
  recommendedTier: RoutingTier,
): RoutingComparison {
  if (actualTier === null) return "aligned";
  const a = TIER_ORDER[actualTier];
  const r = TIER_ORDER[recommendedTier];
  if (a > r) return "savings";
  if (a < r) return "under_specced";
  return "aligned";
}

export const ALL_LABELS: RoutingLabel[] = [
  "planning",
  "implementation",
  "default_implementation",
  "cleanup",
];

// Rough output-length ratios when re-routing the same task to a different
// tier. Cheaper models tend to produce shorter responses; stronger models
// tend to produce more thorough ones. These are seed estimates — refine with
// a benchmark dataset before quoting these numbers externally.
//
//   ratio[from][to] = expected ratio of (to-tier output tokens) /
//                                       (from-tier output tokens)
const OUTPUT_RATIOS: Record<RoutingTier, Record<RoutingTier, number>> = {
  haiku:  { haiku: 1.0,  sonnet: 1.4,  opus: 1.7  },
  sonnet: { haiku: 0.6,  sonnet: 1.0,  opus: 1.25 },
  opus:   { haiku: 0.45, sonnet: 0.8,  opus: 1.0  },
};

export function outputRatioForTier(
  fromTier: RoutingTier | null,
  toTier: RoutingTier,
): number {
  if (!fromTier) return 1.0;
  return OUTPUT_RATIOS[fromTier][toTier];
}

export function scaleUsageForTier(
  usage: Usage,
  fromTier: RoutingTier | null,
  toTier: RoutingTier,
): { usage: Usage; outputRatio: number } {
  const outputRatio = outputRatioForTier(fromTier, toTier);
  return {
    outputRatio,
    usage: {
      ...usage,
      outputTokens: Math.round(usage.outputTokens * outputRatio),
    },
  };
}
