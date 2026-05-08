"use client";

import {
  setModelComparisonEnabled,
  useModelComparisonEnabled,
} from "@/lib/preferences/modelComparison";
import { SettingToggle } from "./SettingToggle";

export function ModelComparisonToggle() {
  const enabled = useModelComparisonEnabled();

  return (
    <SettingToggle
      label="Show model comparison"
      description="When on, the conversation detail page shows a row of cards estimating total cost on Opus, Sonnet, and Haiku. The cards update with the selected chunk."
      enabled={enabled}
      onChange={setModelComparisonEnabled}
    />
  );
}
