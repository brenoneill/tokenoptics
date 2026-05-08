"use client";

import {
  setComparisonCanvasEnabled,
  useComparisonCanvasEnabled,
} from "@/lib/preferences/comparisonCanvas";
import { SettingToggle } from "./SettingToggle";

export function ComparisonCanvasToggle() {
  const enabled = useComparisonCanvasEnabled();

  return (
    <SettingToggle
      label="Enable Comparison Canvas"
      description="When on, conversation cards show a + button that adds them to a side-by-side modal — handy for screenshots and articles."
      enabled={enabled}
      onChange={setComparisonCanvasEnabled}
    />
  );
}
