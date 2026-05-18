# Analysis functions

This is a reference for the four analytical "products" tokenoptics computes over a Claude Code session. Each product is a pipeline over the same input — the session's `Message[]` after [normalize.ts](../lib/normalize.ts) — and produces a record stored in IndexedDB and rendered by the analyze page.

The four products:

1. **Cache analysis** — session-level cache health (no LLM, pure compute).
2. **Routing analysis** — per-prompt model-tier recommendation (LLM-classified).
3. **Quality analysis** — per-prompt "did the user cause rework" (LLM-classified).
4. **Efficiency analysis** — per-turn and per-span overspend detection (rule-based, with optional Stage-2 LLM labeller).

There are also two supporting computations used in multiple places — diff stats and scope stats — covered at the end.

---

## 1. Cache analysis

**Entrypoint:** [computeCacheReport(messages)](../lib/analyze/cache.ts#L224) in [lib/analyze/cache.ts](../lib/analyze/cache.ts).

Pure compute over `Message.usage`. No LLM, no worker, no persistence inside the function (the caller stores the result).

### Pipeline

1. **[buildTrajectory(messages)](../lib/analyze/cache.ts#L114)** — walk assistant messages in order, price each turn at its actual model's rate, return a `CacheTurnPoint[]` with per-turn cost, cumulative cost, and a `dominantBucket` field naming which token bucket (input / output / cache_read / cache_write_5m / cache_write_1h) drove the cost of that turn. This array backs the trajectory bar chart.

2. **Aggregate totals** — sum `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWrite5mTokens`, `cacheWrite1hTokens` across all assistant turns.

3. **Derived metrics:**
   - `cacheHitRatio = cacheReadTokens / (inputTokens + cacheReadTokens)` — share of inputs served from cache. >0.85 is healthy for long sessions.
   - `cacheReadCost` and `cacheReadCostShare` — dollars spent re-processing history, and that as a fraction of total session cost.
   - `baselineTurnCost` — median cost of the first 3 assistant turns. The "what a focused early-session turn looks like" anchor.
   - `finalRampRatio = mean(last 3 turn costs) / baselineTurnCost` — how much more expensive late turns got. >3× is the warn threshold, >6× critical.
   - `baselineCacheReadCost` — median cache_read cost of first 3 turns. The cache_read tax a short focused session would naturally pay (system prompt + small history).
   - `aboveBaselineContextCost` — sum over turns of `max(0, turnCacheReadCost - baselineCacheReadCost)`. Raw "above-baseline context cost" — the cost of carrying growing conversation history. **NOT inherently waste**: long focused sessions legitimately accumulate this.

4. **[buildRecommendations(report)](../lib/analyze/cache.ts#L175)** — generates `CacheRecommendation[]` from three drift signals:
   - **Critical**: long session (`>20` assistant turns) AND low cache hit ratio (`<0.7`).
   - **Critical/warn**: `finalRampRatio` ≥ 6 or ≥ 3.
   - **Info**: cache is churning (5-minute writes exceed reads — usually long pauses between turns or unstable prompt prefixes).

5. **`recoverableBloatCost`** — equals `aboveBaselineContextCost` when any critical or warn recommendation fires; otherwise 0. This is the "unnecessary spend" headline number — gated on actual evidence of drift so we don't cry wolf on every long session.

### Notes

- Tunable thresholds live at [lib/analyze/cache.ts:170-173](../lib/analyze/cache.ts#L170-L173).
- The function recomputes `totalCost` a second time via `costForUsage(model, usage)` and uses that as the source of truth (any rounding drift ends up in `totalCost`).

---

## 2. Routing analysis

**Entrypoint:** orchestrated in the analyze page; library functions in [lib/analyze/session.ts](../lib/analyze/session.ts), [lib/analyze/anthropic.ts](../lib/analyze/anthropic.ts), and [lib/analyze/routing.ts](../lib/analyze/routing.ts).

Per-prompt model-tier recommendation using a Haiku classifier. One API call per genuine user prompt.

### Pipeline

1. **[extractPromptSpans(messages)](../lib/analyze/session.ts#L106)** — walks the session, opens a new `PromptSpan` on every genuine user prompt (skips slash commands and tool-result-only user messages), and attaches every assistant message that followed it. Each span also carries `priorAssistantContext` — the last 1200 chars of the previous assistant message's visible text — so the classifier can recognize replies.

2. **[extractResponseFeatures(span)](../lib/analyze/session.ts#L74)** — distills the assistant work into numeric signals: `assistantTurnCount`, `toolUseCount`, `toolErrorCount`, `thinkingUsed`, `textChars`, `distinctToolNames`. Passed to the classifier so it judges intent in light of what the assistant actually had to do, not just the prompt text.

3. **[classifyUserMessage(prompt, features, priorContext)](../lib/analyze/anthropic.ts#L120)** — Haiku 4.5 call with a forced-tool schema. Returns one of:
   - `continuation` — reply/follow-up to the prior assistant message. Not independently routable (Claude Code can't switch model mid-task).
   - `planning` — deliberation, architecture, strategy docs.
   - `implementation` / `default_implementation` — real coding work.
   - `cleanup` — lint, format, single-line edits, trivial mechanical changes.

   System prompt explicitly tells the model: if the assistant used Edit/Write/MultiEdit/NotebookEdit, the label is almost certainly `implementation` (response-signal override).

4. **[mergeContinuations(items)](../lib/analyze/session.ts#L272)** — walks classified spans in order, opens a new "bucket" on each non-continuation, folds continuation spans into the current bucket (their `userMessage` becomes a `followUpReply`, their assistant messages append, their classifier tokens add). Each bucket produces exactly one `RoutingTurnRecord`. Edge case: if the first span is a continuation, degrade it to `default_implementation` so the prompt still surfaces.

5. **[buildTurnRecord(span, classification, features)](../lib/analyze/session.ts#L188)** — for each merged bucket:
   - **[dominantModel(messages)](../lib/analyze/session.ts#L152)** — group per-model usage and cost across the bucket's assistant messages, return the model that accounted for the most dollars. Used as the span's `actualModel`.
   - **[compareTiers(actual, recommended)](../lib/analyze/routing.ts#L56)** — returns `savings` (actual stronger than needed), `aligned`, or `under_specced`.
   - **[scaleUsageForTier(usage, fromTier, toTier)](../lib/analyze/routing.ts#L96)** — output tokens are scaled by an empirical tier-to-tier ratio (table at [lib/analyze/routing.ts:82-86](../lib/analyze/routing.ts#L82-L86)) because the recommended model would not produce the same output length. Input/cache stay constant since the prompt is unchanged.
   - `counterfactualCost = costForUsage(recommendedModel, scaledUsage)`.
   - `savings = max(0, actualCost - counterfactualCost)` when comparison is `savings`; `underspendDelta = max(0, counterfactualCost - actualCost)` when `under_specced`.

6. **[estimateClassifierCost(spans)](../lib/analyze/session.ts#L346)** — rough upfront estimate (Haiku input rate × prompt-char/4 token estimate + ~700-token fixed overhead per call) so the UI can preview "this run will cost ~$X" before kicking off the classifier.

### Notes

- Label→model mapping lives at [lib/analyze/routing.ts:11-16](../lib/analyze/routing.ts#L11-L16): planning→Opus 4.6, implementation/default→Sonnet 4.6, cleanup→Haiku 4.5.
- The output-ratio table is a seed estimate; the comment at [lib/analyze/routing.ts:79](../lib/analyze/routing.ts#L79) flags it as needing benchmark refinement before quoting externally.

---

## 3. Quality analysis

**Entrypoint:** orchestrated in the analyze page; library functions in [lib/analyze/quality.ts](../lib/analyze/quality.ts) and [lib/analyze/quality-classifier.ts](../lib/analyze/quality-classifier.ts).

Detects assistant work invalidated by **user-side information gaps** — info the user could have given upfront but only mentioned after the assistant had already done related work. One Haiku call per prompt, like routing, but with a different classification axis.

Scope is strictly user-side: assistant tool errors and natural design iteration are not waste. Only late-arriving user info or direction changes count.

### Pipeline

1. **Reuses `extractPromptSpans` from routing** — same span definition.

2. **[buildRecentTurnWindow(messages, startingIndex)](../lib/analyze/quality-classifier.ts#L235)** — for each span, builds an ordered list of up to 5 recent assistant turns (uuid, output tokens, ≤240-char text summary, distinct tool names) that the classifier can reference by index when flagging invalidated work.

3. **[classifySpanQuality(prompt, priorContext, recentTurns)](../lib/analyze/quality-classifier.ts#L99)** — Haiku call with a forced-tool schema. Returns:
   - **`relationship`** (one of):
     - `fresh_task` — new, unrelated work.
     - `clean_continuation` — reply, clarification, approval, option-pick, or natural iteration that did NOT cause rework.
     - `info_gap` — user supplied info they could have given upfront (file path, framework version, scope constraint) and prior assistant work got invalidated.
     - `direction_change` — user reversed or contradicted prior direction.
   - **`latentInfo`** — short bullet phrases naming the late-supplied info (only populated for info_gap / direction_change).
   - **`invalidatedTurnUuids`** — model returns indices into `recentTurns`; classifier maps them back to uuids. Caller will sum the output tokens of those messages.
   - **`usage`** — classifier API tokens (for run-level cost tally).

4. **[aggregateTasks(items)](../lib/analyze/quality.ts#L112)** — walks classified spans in order, opens a new task bucket on each `fresh_task`, folds the rest into the current bucket:
   - `clean_continuation` adds nothing but the follow-up count.
   - `info_gap` / `direction_change` add to the bucket's `invalidatedUuids` set and `latentInfo` list.
   - Severity rank (info_gap=2 > direction_change=1 > clean=0) tracks the "worst" reason seen in the task; that becomes the task's `reason`.
   - On finalize, look up each invalidated uuid in the bucket's assistant messages, sum `usage.outputTokens`, price each at its actual model's output rate → `wastedOutputTokens` and `wastedCost`.
   - **`category`**: `info_gap` / `direction_change` / `mixed` (both fired) / `none`.

5. **Run summary** — totals across all tasks: count of wasteful tasks, breakdown by category, `totalWastedOutputTokens`, `totalWastedCost`, and `sessionActualCost` (the denominator for the headline "% of cost wasted").

### Notes

- The system prompt at [lib/analyze/quality-classifier.ts:47-66](../lib/analyze/quality-classifier.ts#L47-L66) is explicit that tool errors and natural design iteration are NOT waste — only USER-side info gaps.
- `aggregateTasks` ignores `invalidatedTurnUuids` returned for `fresh_task` spans (fresh tasks by definition can't invalidate prior work in the same bucket) and any uuids that don't match assistant messages within the bucket (guards against the model hallucinating indices).

---

## 4. Efficiency analysis

**Entrypoint:** [analyzeSession(messages)](../lib/efficiency/index.ts#L27) in [lib/efficiency/index.ts](../lib/efficiency/index.ts).

Detects model-tier overspend per assistant turn and per request span. Rule-based ("Stage 1") with a deliberately Opus-default framing: Stage 1 only flags cases where shape itself is dispositive, deferring genuinely ambiguous turns to a Stage-2 LLM labeller (not yet wired here; the placeholder verdict is `needed_opus`).

### Per-turn pipeline

1. **[extractAssistantTurnShapes(messages)](../lib/efficiency/shape.ts#L74)** → calls [extractTurnShape(message, prevMessage)](../lib/efficiency/shape.ts#L15) for each assistant message. Returns a `TurnShape` with:
   - `hadThinking`, `thinkingTokensEstimate` (estimated as `outputTokens - ceil((textChars + toolUseInputChars) / 4)` when thinking happened — the slack between billed output and visible output).
   - `textChars`, `toolUseCount`.
   - `hadErrorRecovery` — true if the **prior** message contained any `tool_result` with `isError: true` (this turn had to recover).
   - All five token buckets from `usage` and the actual cost.

2. **[computeMechanicalSuccess(messages)](../lib/efficiency/validation.ts#L3)** — for each assistant turn that issued tool calls, look at the *next* user message: if every `tool_use_id` has a matching `tool_result` and none are errors, the turn `mechanicallySucceeded=true`. If any error or any id is missing, returns `false` or `null` (can't tell). Used as evidence the model actually got the mechanical task right.

3. **[classifyByShape(shape, {mechanicalSuccess})](../lib/efficiency/rules.ts#L31)** — Stage-1 rule-based per-turn classifier. Only one positive verdict at this stage:
   - **`haiku_sufficient`**: pure-text acknowledgement turn — no thinking, no error recovery, no tool calls, 0 < `textChars` < 100. The turn is essentially "ack"; no judgment required.
   - Otherwise **`needed_opus`** with reason "default: shape alone cannot prove triviality". Single-tool turns are explicitly deferred to Stage 2 because the choice of *what* to read or grep is itself an act of judgment that shape can't see.

4. **[isOverspend(actual, suggested)](../lib/efficiency/rules.ts#L18)** — true when actual tier outranks suggested (haiku<sonnet<opus).

5. **Costing** — for overspending turns:
   - **[counterfactualCost(shape, suggestedTier)](../lib/efficiency/pricing.ts#L30)** — prices the same input/cache tokens at the suggested tier, drops thinking tokens from output (cheaper tiers don't use extended thinking).
   - **[wasteBreakdown(shape, suggestedTier)](../lib/efficiency/pricing.ts#L43)** — decomposes overspend into three components:
     - `inputRatePremium` — input/cache tokens × (actual rate − target rate).
     - `outputRatePremium` — text output tokens × (actual output rate − target output rate).
     - `thinkingSurplus` — thinking tokens × actual output rate (the entire thinking spend is treated as surplus, since the cheap-tier counterfactual doesn't think).

### Per-span pipeline

1. **[extractRequestSpans(messages)](../lib/efficiency/spans.ts#L28)** — same span definition as routing/quality, but starts a new span only on the first user message that produces text via `userPromptText` (matches the rest of the codebase's span shape).

2. **[buildSpanShape({span, turnsByUuid})](../lib/efficiency/spans.ts#L69)** — aggregates per-turn shapes into a `RequestSpanShape`: sums tool uses / text chars / thinking tokens, ORs the thinking and error-recovery flags, derives `allMechanicalSuccess` (false if any turn failed, true if all evaluable turns succeeded, null otherwise), and computes diff stats for the span.

3. **[classifySpan(shape)](../lib/efficiency/spans.ts#L181)** — Stage-1 span classifier with diff size as the primary signal:
   - **Hard gate**: `anyHadErrorRecovery` → `needed_opus`. Direct evidence of real difficulty regardless of diff size.
   - **No-edit single-shot pure-text answer**: 1 turn, 0 tool uses, no thinking, `0 < textChars < 300` → `haiku_sufficient` (Q&A).
   - **No-edit multi-turn or tool-using**: → `needed_opus` (the choice of what to read/grep is judgment).
   - **Diff-size thresholds** ([SPAN_THRESHOLDS](../lib/efficiency/spans.ts#L152-L163)):
     - `≤1 edit, ≤1 file, ≤4 lines changed` → `haiku_sufficient`.
     - `≤3 edits, ≤1 file, ≤12 lines changed` → `sonnet_sufficient`.
     - Otherwise → `needed_opus`.

4. **Costing** — analogous to turn-level via [counterfactualCostForSpan](../lib/efficiency/pricing.ts#L77) and [spanWasteBreakdown](../lib/efficiency/pricing.ts#L95).

### Validation summary

[ValidationSummary](../lib/efficiency/types.ts#L50-L54) tracks how often Stage-1's `haiku_sufficient` verdicts were observed to mechanically succeed at first try, plus the total count of downgraded turns. This is the honesty-check loop — if Haiku-suggested turns frequently fail in practice, the thresholds are too loose.

### Auxiliary efficiency utilities

- **[computeCostByTierForMessages(messages)](../lib/efficiency/chunkCosts.ts#L102)** — alternative tier-cost view: returns "what this set of messages would have cost at haiku / sonnet / opus rates". Assumes the user would disable extended thinking on the cheaper tiers. Used for the comparison-canvas view, not the main efficiency record.

- **[computeScopeStats(messages)](../lib/efficiency/scopeStats.ts#L21)** — generic rollup at any scope (whole session, project, run-of-messages): cost, tokens, prompt count, lines added/removed/rewritten, duration. Drives the top-level summary cards.

---

## Supporting computations

### Diff stats

[computeDiffStatsForSpan(messages)](../lib/efficiency/diffs.ts#L88) and [computeDiffStatsFromBlocks(blocks, files)](../lib/efficiency/diffs.ts#L64) in [lib/efficiency/diffs.ts](../lib/efficiency/diffs.ts).

Walks every `tool_use` block whose name is in `DIFF_TOOLS` (Edit, MultiEdit, Write, NotebookEdit). For each:
- `Edit` / `NotebookEdit`: one pair of `(old_string, new_string)`.
- `MultiEdit`: one pair per item in `edits[]`.
- `Write`: `(old_string = "", new_string = content)` — treats the whole file as added.

Counts lines by splitting on `\n`. Returns `editsCount` (number of `(old, new)` pairs), `linesAdded`, `linesRemoved`, `linesChanged = linesAdded + linesRemoved`, and `filesAffected` (distinct file paths).

### Pricing

All token rates live in [lib/pricing.ts](../lib/pricing.ts). Cost computation goes through `pricingForModel(model)` (strips date suffixes, falls back to Sonnet with a warning for unknown models) and `costForUsage(model, usage)`. Per AGENTS.md rule 7, never inline model rates anywhere else.

---

## Where each product writes

All four products persist via the Dexie store in [lib/storage/browser/store.ts](../lib/storage/browser/store.ts). The cache report has no dedicated table — it's recomputed on demand because it's pure-compute and cheap. The other three each have their own record types ([EfficiencyDetectionRecord](../lib/efficiency/types.ts#L82), [RoutingRunRecord](../lib/analyze/types.ts#L71), [QualityRunRecord](../lib/analyze/quality.ts#L96)) keyed by `(projectId, sessionId)` plus a `contentHash` so cached results invalidate when the session file changes.
