"use client";

import { createBooleanPref } from "./booleanPref";

const includeTypePref = createBooleanPref("tokenoptics:include-chunk-type");
export const useIncludeChunkType = includeTypePref.use;
export const setIncludeChunkType = includeTypePref.set;

const includeSummaryPref = createBooleanPref(
  "tokenoptics:include-chunk-summary",
);
export const useIncludeChunkSummary = includeSummaryPref.use;
export const setIncludeChunkSummary = includeSummaryPref.set;
