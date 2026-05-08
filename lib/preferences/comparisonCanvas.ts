"use client";

import { createBooleanPref } from "./booleanPref";

const enabledPref = createBooleanPref("tokenoptics:comparison-canvas-enabled");
export const useComparisonCanvasEnabled = enabledPref.use;
export const setComparisonCanvasEnabled = enabledPref.set;
