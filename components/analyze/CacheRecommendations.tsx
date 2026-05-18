"use client";

import { Alert } from "@/components/ui/Alert";
import type {
  CacheRecommendation,
  RecommendationSeverity,
} from "@/lib/analyze/cache";

interface Props {
  recommendations: CacheRecommendation[];
}

const SEVERITY_VARIANT: Record<RecommendationSeverity, "info" | "warn" | "danger"> = {
  info: "info",
  warn: "warn",
  critical: "danger",
};

export function CacheRecommendations({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <Alert variant="success" title="No bloat signals">
        Cache usage looks healthy for this session — no /clear or split
        recommendations triggered.
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec, i) => (
        <Alert
          key={i}
          variant={SEVERITY_VARIANT[rec.severity]}
          title={rec.title}
        >
          {rec.message}
        </Alert>
      ))}
    </div>
  );
}
