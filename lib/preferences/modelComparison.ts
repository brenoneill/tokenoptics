"use client";

import { createBooleanPref } from "./booleanPref";

const enabledPref = createBooleanPref(
  "tokenoptics:model-comparison-enabled",
  true,
);
export const useModelComparisonEnabled = enabledPref.use;
export const setModelComparisonEnabled = enabledPref.set;
